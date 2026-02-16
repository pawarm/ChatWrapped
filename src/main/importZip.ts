import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { classifySpecialMessage } from '../lib/specialMessages';
import { fixMetaEncoding } from '../lib/utils';
import type { ImportProgress, ImportSummary } from '../types/import';

const INBOX_MESSAGE_PATTERN =
  /messages[/\\]inbox[/\\][^/\\]+[/\\]message_(\d+)\.json$/i;
const ENCRYPTED_MESSAGE_PATTERN =
  /messages[/\\]encrypted[/\\][^/\\]+[/\\]message_(\d+)\.json$/i;
const E2EE_CUTOVER_MESSAGE_PATTERN =
  /messages[/\\]e2ee_cutover[/\\][^/\\]+[/\\]message_(\d+)\.json$/i;

interface MetaMessage {
  sender_name?: string;
  timestamp_ms?: number;
  content?: string;
  type?: string;
  share?: unknown;
  reactions?: { reaction?: string; actor?: string }[];
}

interface MetaMessageFile {
  participants?: { name: string }[];
  messages?: MetaMessage[];
  title?: string;
  thread_type?: string;
  thread_path?: string;
}

function parseMessageFile(zip: AdmZip, entry: AdmZip.IZipEntry): MetaMessageFile {
  const buffer = zip.readFile(entry);
  if (!buffer || buffer.length === 0) {
    throw new Error(`Failed to read: ${entry.entryName}`);
  }
  const rawText = buffer.toString('utf-8');
  const data = JSON.parse(rawText) as MetaMessageFile;
  if (!data || !Array.isArray(data.participants) || !Array.isArray(data.messages)) {
    throw new Error(`Invalid structure in ${entry.entryName}`);
  }
  return data;
}

function extractThreadKey(entryName: string): string {
  const parts = entryName.split(/[/\\]/);
  const threadFolder = parts[parts.length - 2];
  const parent = parts.includes('inbox')
    ? 'inbox'
    : parts.includes('encrypted')
      ? 'encrypted'
      : parts.includes('e2ee_cutover')
        ? 'e2ee_cutover'
        : 'unknown';
  return `${parent}/${threadFolder ?? 'unknown'}`;
}

interface EntryWithSort {
  entry: AdmZip.IZipEntry;
  sortNum: number;
}

const EDITED_SUFFIX = ' (edited)';
const EDIT_DEDUP_WINDOW_MS = 60_000;

/**
 * Meta exports both the original and edited version of a message as separate entries.
 * Remove originals when we have an edited counterpart (same sender, within time window).
 */
function filterEditedDuplicates(messages: MetaMessage[]): MetaMessage[] {
  if (messages.length === 0) return messages;
  const byTs = [...messages].sort((a, b) => (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0));
  const toRemove = new Set<number>();

  for (let i = 0; i < byTs.length; i++) {
    const m = byTs[i];
    const content = m.content ?? '';
    if (content.endsWith(EDITED_SUFFIX)) continue; // keep edited

    const sender = m.sender_name ?? '';
    const ts = m.timestamp_ms ?? 0;

    for (let j = 0; j < byTs.length; j++) {
      if (i === j) continue;
      const other = byTs[j];
      const otherContent = other.content ?? '';
      if (!otherContent.endsWith(EDITED_SUFFIX)) continue;
      if ((other.sender_name ?? '') !== sender) continue;

      const otherTs = other.timestamp_ms ?? 0;
      if (Math.abs(otherTs - ts) > EDIT_DEDUP_WINDOW_MS) continue;

      const editedContent = otherContent.slice(0, -EDITED_SUFFIX.length);
      const minLen = Math.min(content.length, editedContent.length);
      let prefixLen = 0;
      while (prefixLen < content.length && prefixLen < editedContent.length && content[prefixLen] === editedContent[prefixLen]) {
        prefixLen++;
      }
      if (minLen >= 5 && prefixLen >= 0.5 * minLen) {
        toRemove.add(i);
        break;
      }
    }
  }

  return byTs.filter((_, i) => !toRemove.has(i));
}

function groupEntriesByThread(
  entries: AdmZip.IZipEntry[]
): Map<string, EntryWithSort[]> {
  const byThread = new Map<string, EntryWithSort[]>();
  for (const entry of entries) {
    const inboxMatch = entry.entryName.match(INBOX_MESSAGE_PATTERN);
    const encryptedMatch = entry.entryName.match(ENCRYPTED_MESSAGE_PATTERN);
    const e2eeCutoverMatch = entry.entryName.match(E2EE_CUTOVER_MESSAGE_PATTERN);
    const match = inboxMatch ?? encryptedMatch ?? e2eeCutoverMatch;
    if (!match) continue;
    const threadKey = extractThreadKey(entry.entryName);
    const num = parseInt(match[1], 10);
    const list = byThread.get(threadKey) ?? [];
    list.push({ entry, sortNum: num });
    byThread.set(threadKey, list);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => a.sortNum - b.sortNum);
  }
  return byThread;
}

export async function importZip(
  zipPath: string,
  database: Database.Database,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  if (!zipPath || typeof zipPath !== 'string') {
    throw new Error('Could not access file path. Try using Select ZIP file instead.');
  }

  const normalizedPath = path.normalize(zipPath);
  if (!normalizedPath.toLowerCase().endsWith('.zip')) {
    throw new Error('Please select a ZIP file.');
  }

  if (!fs.existsSync(normalizedPath)) {
    throw new Error('File not found.');
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(normalizedPath);
  } catch {
    throw new Error('Invalid or corrupted ZIP file.');
  }

  const entries = zip.getEntries();
  const messageEntries = entries.filter(
    (e) =>
      !e.isDirectory &&
      (INBOX_MESSAGE_PATTERN.test(e.entryName) ||
        ENCRYPTED_MESSAGE_PATTERN.test(e.entryName) ||
        E2EE_CUTOVER_MESSAGE_PATTERN.test(e.entryName))
  );

  if (messageEntries.length === 0) {
    throw new Error(
      'Unrecognized format. Expected a Meta Messenger export with messages/inbox/, encrypted/, or e2ee_cutover/ message files.'
    );
  }

  onProgress?.({ phase: 'extracting', current: 0, total: messageEntries.length });

  const byThread = groupEntriesByThread(messageEntries);
  const threadIds = Array.from(byThread.keys());
  const totalThreads = threadIds.length;

  let threadsImported = 0;
  let messagesImported = 0;
  let reactionsImported = 0;

  const insertThread = database.prepare(`
    INSERT OR REPLACE INTO threads (id, title, thread_type, participants_json, created_at)
    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
  `);
  const deleteMessages = database.prepare('DELETE FROM messages WHERE thread_id = ?');
  const deleteReactionsForThread = database.prepare(`
    DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)
  `);
  const insertMessage = database.prepare(`
    INSERT INTO messages (thread_id, sender_name, timestamp_ms, content, content_type, special_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertReaction = database.prepare(`
    INSERT INTO reactions (message_id, actor, reaction)
    VALUES (?, ?, ?)
  `);

  const transaction = database.transaction(() => {
    for (let i = 0; i < threadIds.length; i++) {
      const folderThreadId = threadIds[i];
      const fileEntries = byThread.get(folderThreadId)!;

      onProgress?.({
        phase: 'parsing',
        current: i + 1,
        total: totalThreads,
        threadName: undefined,
      });

      let threadPath: string = folderThreadId;
      let title = 'Unknown';
      let threadType = 'Unknown';
      let participantsJson = '[]';
      const seenKeys = new Set<string>();
      const allMessages: MetaMessage[] = [];

      for (const { entry } of fileEntries) {
        const data = parseMessageFile(zip, entry);
        if (data.thread_path) threadPath = data.thread_path;
        if (data.title) title = fixMetaEncoding(data.title);
        if (data.thread_type) threadType = data.thread_type;
        if (data.participants?.length) {
          participantsJson = JSON.stringify(
            data.participants.map((p) => ({
              name: fixMetaEncoding(p.name ?? ''),
            }))
          );
        }
        for (const m of data.messages ?? []) {
          const key = `${m.timestamp_ms ?? 0}\t${m.sender_name ?? ''}\t${(m.content ?? '').slice(0, 100)}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          allMessages.push(m);
        }
      }

      const stableThreadId = threadPath;

      onProgress?.({
        phase: 'writing',
        current: threadsImported + 1,
        total: totalThreads,
        threadName: title,
      });

      insertThread.run(stableThreadId, title, threadType, participantsJson);

      deleteReactionsForThread.run(stableThreadId);
      deleteMessages.run(stableThreadId);

      const messagesToInsert = filterEditedDuplicates(allMessages);

      for (const m of messagesToInsert) {
        const content = m.content != null ? fixMetaEncoding(String(m.content)) : null;
        const senderName = fixMetaEncoding(m.sender_name ?? 'Unknown');
        const type = m.type ?? 'Generic';
        const specialType = classifySpecialMessage({
          content: m.content,
          type: m.type,
          share: m.share,
        });
        insertMessage.run(
          stableThreadId,
          senderName,
          m.timestamp_ms ?? 0,
          content,
          type,
          specialType === 'generic' ? null : specialType
        );
        const row = database.prepare('SELECT last_insert_rowid() as id').get() as {
          id: number;
        };
        const messageId = row.id;

        for (const r of m.reactions ?? []) {
          insertReaction.run(
            messageId,
            fixMetaEncoding(r.actor ?? ''),
            fixMetaEncoding(r.reaction ?? '')
          );
          reactionsImported++;
        }
        messagesImported++;
      }
      threadsImported++;
    }
  });

  transaction();

  return { threadsImported, messagesImported, reactionsImported };
}
