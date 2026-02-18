import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import type Database from 'better-sqlite3';
import { classifySpecialMessage } from '../lib/specialMessages';
import { fixMetaEncoding } from '../lib/utils';
import { ensureMediaDir, getMediaDir } from './mediaStorage';
import type { ImportProgress, ImportSummary, ZipInspectResult } from '../types/import';

function openZipWithYauzl(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: false, autoClose: false },
      (err, zipfile) => {
        if (err) reject(err);
        else resolve(zipfile);
      }
    );
  });
}

function getEntriesFromYauzl(zipfile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((resolve) => {
    const entries: yauzl.Entry[] = [];
    zipfile.on('entry', (entry: yauzl.Entry) => entries.push(entry));
    zipfile.on('end', () => resolve(entries));
  });
}

function readEntryAsBuffer(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

type MediaType = 'photo' | 'video' | 'gif' | 'audio' | 'file' | 'sticker';

interface MediaItem {
  uri: string;
}

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
  photos?: MediaItem[];
  videos?: MediaItem[];
  gifs?: MediaItem[];
  audio_files?: MediaItem[];
  files?: MediaItem[];
  sticker?: MediaItem | { uri?: string };
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
  return parseMessageBuffer(buffer, entry.entryName);
}

function parseMessageBuffer(buffer: Buffer, entryName: string): MetaMessageFile {
  if (!buffer || buffer.length === 0) {
    throw new Error(`Failed to read: ${entryName}`);
  }
  const rawText = buffer.toString('utf-8');
  const data = JSON.parse(rawText) as MetaMessageFile;
  if (!data || !Array.isArray(data.participants) || !Array.isArray(data.messages)) {
    throw new Error(`Invalid structure in ${entryName}`);
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

function getMimeTypeFromUri(uri: string): string | null {
  const ext = path.extname(uri).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}

function collectMediaItems(m: MetaMessage): { uri: string; type: MediaType }[] {
  const items: { uri: string; type: MediaType }[] = [];
  for (const p of m.photos ?? []) {
    if (p?.uri) items.push({ uri: p.uri, type: 'photo' });
  }
  for (const v of m.videos ?? []) {
    if (v?.uri) items.push({ uri: v.uri, type: 'video' });
  }
  for (const g of m.gifs ?? []) {
    if (g?.uri) items.push({ uri: g.uri, type: 'gif' });
  }
  for (const a of m.audio_files ?? []) {
    if (a?.uri) items.push({ uri: a.uri, type: 'audio' });
  }
  for (const f of m.files ?? []) {
    if (f?.uri) items.push({ uri: f.uri, type: 'file' });
  }
  const sticker = m.sticker;
  if (sticker && typeof sticker === 'object' && 'uri' in sticker && sticker.uri) {
    items.push({ uri: sticker.uri, type: 'sticker' });
  }
  return items;
}

function extractMediaFromZip(
  zip: AdmZip,
  messageId: number,
  items: { uri: string; type: MediaType }[],
  mediaDir: string,
  insertMedia: { run: (...args: unknown[]) => void }
): void {
  for (let i = 0; i < items.length; i++) {
    const { uri, type } = items[i];
    const normalizedUri = uri.replace(/\\/g, '/');
    const entry = zip.getEntry(normalizedUri);
    if (!entry || entry.isDirectory) continue;
    try {
      const buffer = zip.readFile(entry);
      if (!buffer || buffer.length === 0) continue;
      const ext = path.extname(normalizedUri) || '.bin';
      const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '_').slice(0, 16) || '.bin';
      const filename = `${messageId}_${i}_${type}${safeExt}`;
      const outPath = path.join(mediaDir, filename);
      fs.writeFileSync(outPath, buffer);
      const mimeType = getMimeTypeFromUri(uri);
      insertMedia.run(messageId, type, filename, mimeType, i);
    } catch {
      // Skip corrupt/missing media
    }
  }
}

async function extractMediaFromZipYauzl(
  pooledMap: Map<string, { zipfile: yauzl.ZipFile; entry: yauzl.Entry }>,
  messageId: number,
  items: { uri: string; type: MediaType }[],
  mediaDir: string,
  insertMedia: { run: (...args: unknown[]) => void }
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const { uri, type } = items[i];
    const normalizedUri = uri.replace(/\\/g, '/');
    const pooled = pooledMap.get(normalizedUri);
    if (!pooled) continue;
    const { zipfile, entry } = pooled;
    if (entry.fileName.endsWith('/')) continue;
    try {
      const buffer = await readEntryAsBuffer(zipfile, entry);
      if (!buffer || buffer.length === 0) continue;
      const ext = path.extname(normalizedUri) || '.bin';
      const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '_').slice(0, 16) || '.bin';
      const filename = `${messageId}_${i}_${type}${safeExt}`;
      const outPath = path.join(mediaDir, filename);
      fs.writeFileSync(outPath, buffer);
      const mimeType = getMimeTypeFromUri(uri);
      insertMedia.run(messageId, type, filename, mimeType, i);
    } catch {
      // Skip corrupt/missing media
    }
  }
}

function isMessageEntry(fileName: string): boolean {
  return (
    INBOX_MESSAGE_PATTERN.test(fileName) ||
    ENCRYPTED_MESSAGE_PATTERN.test(fileName) ||
    E2EE_CUTOVER_MESSAGE_PATTERN.test(fileName)
  );
}

/** Check if path is under messages/inbox, e2ee_cutover, or encrypted (Meta export structure) */
function isMetaMessagesPath(fileName: string): boolean {
  const n = fileName.replace(/\\/g, '/');
  return (
    n.includes('messages/inbox/') ||
    n.includes('messages/e2ee_cutover/') ||
    n.includes('messages/encrypted/')
  );
}

export async function inspectZip(zipPath: string): Promise<ZipInspectResult> {
  if (!zipPath || typeof zipPath !== 'string') {
    return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
  }

  const normalizedPath = path.normalize(zipPath);
  if (!normalizedPath.toLowerCase().endsWith('.zip')) {
    return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
  }

  if (!fs.existsSync(normalizedPath)) {
    return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
  }

  try {
    const zipfile = await openZipWithYauzl(normalizedPath);
    try {
      const entries = await getEntriesFromYauzl(zipfile);
      zipfile.close();

      const messageEntries = entries.filter(
        (e) => !e.fileName.endsWith('/') && isMessageEntry(e.fileName)
      );

      if (messageEntries.length > 0) {
        const byThread = groupEntriesByThreadYauzl(messageEntries);
        return {
          threadCount: byThread.size,
          messageFileCount: messageEntries.length,
          format: 'valid',
        };
      }

      // No message files - check if it has Meta structure (media-only zip)
      const hasMetaStructure = entries.some(
        (e) => !e.fileName.endsWith('/') && isMetaMessagesPath(e.fileName)
      );
      if (hasMetaStructure) {
        return {
          threadCount: 0,
          messageFileCount: 0,
          format: 'valid',
          mediaOnly: true,
        };
      }

      return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
    } catch {
      zipfile.close();
      return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
    }
  } catch {
    return { threadCount: 0, messageFileCount: 0, format: 'invalid' };
  }
}

interface EntryWithSortYauzl {
  entry: yauzl.Entry;
  sortNum: number;
}

function groupEntriesByThreadYauzl(
  entries: yauzl.Entry[]
): Map<string, EntryWithSortYauzl[]> {
  const byThread = new Map<string, EntryWithSortYauzl[]>();
  for (const entry of entries) {
    const inboxMatch = entry.fileName.match(INBOX_MESSAGE_PATTERN);
    const encryptedMatch = entry.fileName.match(ENCRYPTED_MESSAGE_PATTERN);
    const e2eeCutoverMatch = entry.fileName.match(E2EE_CUTOVER_MESSAGE_PATTERN);
    const match = inboxMatch ?? encryptedMatch ?? e2eeCutoverMatch;
    if (!match) continue;
    const threadKey = extractThreadKey(entry.fileName);
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

async function importZipWithYauzl(
  normalizedPath: string,
  database: Database.Database,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  const zipfile = await openZipWithYauzl(normalizedPath);
  const allEntries = await getEntriesFromYauzl(zipfile);

  const pooledEntryMap = new Map<
    string,
    { zipfile: yauzl.ZipFile; entry: yauzl.Entry }
  >();
  for (const e of allEntries) {
    if (!e.fileName.endsWith('/')) {
      const key = e.fileName.replace(/\\/g, '/');
      pooledEntryMap.set(key, { zipfile, entry: e });
    }
  }

  const messageEntries = allEntries.filter(
    (e) => !e.fileName.endsWith('/') && isMessageEntry(e.fileName)
  );

  if (messageEntries.length === 0) {
    zipfile.close();
    throw new Error(
      'Unrecognized format. Expected a Meta Messenger export with messages/inbox/, encrypted/, or e2ee_cutover/ message files.'
    );
  }

  onProgress?.({ phase: 'extracting', current: 0, total: messageEntries.length });

  const byThread = groupEntriesByThreadYauzl(messageEntries);
  const threadIds = Array.from(byThread.keys());
  const totalThreads = threadIds.length;

  let threadsImported = 0;
  let messagesImported = 0;
  let reactionsImported = 0;

  ensureMediaDir();
  const mediaDir = getMediaDir();

  const insertThread = database.prepare(`
    INSERT OR REPLACE INTO threads (id, title, thread_type, participants_json, created_at)
    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
  `);
  const deleteMediaForThread = database.prepare(`
    DELETE FROM media WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)
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
  const insertMedia = database.prepare(`
    INSERT INTO media (message_id, media_type, relative_path, mime_type, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  try {
    database.exec('BEGIN TRANSACTION');

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
        const buffer = await readEntryAsBuffer(zipfile, entry);
        const data = parseMessageBuffer(buffer, entry.fileName);
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

      allMessages.sort((a, b) => (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0));
      const stableThreadId = threadPath;
      const messagesToInsert = filterEditedDuplicates(allMessages);

      onProgress?.({
        phase: 'writing',
        current: threadsImported + 1,
        total: totalThreads,
        threadName: title,
      });

      insertThread.run(stableThreadId, title, threadType, participantsJson);
      deleteMediaForThread.run(stableThreadId);
      deleteReactionsForThread.run(stableThreadId);
      deleteMessages.run(stableThreadId);

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

        const mediaItems = collectMediaItems(m);
        await extractMediaFromZipYauzl(
          pooledEntryMap,
          messageId,
          mediaItems,
          mediaDir,
          insertMedia
        );

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

    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    zipfile.close();
    throw err;
  }

  zipfile.close();
  return { threadsImported, messagesImported, reactionsImported };
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

  // Try AdmZip first (faster for small files); fall back to yauzl for files > 2GB
  let zip: AdmZip | null = null;
  try {
    zip = new AdmZip(normalizedPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ERR_FS_FILE_TOO_LARGE') || msg.includes('2 GiB')) {
      return importZipWithYauzl(normalizedPath, database, onProgress);
    }
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

  ensureMediaDir();
  const mediaDir = getMediaDir();

  const insertThread = database.prepare(`
    INSERT OR REPLACE INTO threads (id, title, thread_type, participants_json, created_at)
    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
  `);
  const deleteMediaForThread = database.prepare(`
    DELETE FROM media WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)
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
  const insertMedia = database.prepare(`
    INSERT INTO media (message_id, media_type, relative_path, mime_type, sort_order)
    VALUES (?, ?, ?, ?, ?)
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

      allMessages.sort((a, b) => (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0));

      const stableThreadId = threadPath;

      onProgress?.({
        phase: 'writing',
        current: threadsImported + 1,
        total: totalThreads,
        threadName: title,
      });

      insertThread.run(stableThreadId, title, threadType, participantsJson);

      deleteMediaForThread.run(stableThreadId);
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

        const mediaItems = collectMediaItems(m);
        extractMediaFromZip(zip, messageId, mediaItems, mediaDir, insertMedia);

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

interface MessageWithSourceZip {
  message: MetaMessage;
  sourceZipPath: string;
}

export async function importZips(
  zipPaths: string[],
  database: Database.Database,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  if (!zipPaths?.length) {
    throw new Error('No ZIP files selected.');
  }

  const validPaths = zipPaths.filter(
    (p) => p && typeof p === 'string' && path.normalize(p).toLowerCase().endsWith('.zip') && fs.existsSync(path.normalize(p))
  );
  if (validPaths.length === 0) {
    throw new Error('No valid ZIP files found.');
  }

  // Use yauzl for multi-zip import (handles files > 2GB)
  return importZipsWithYauzl(validPaths, database, onProgress);
}

async function importZipsWithYauzl(
  validPaths: string[],
  database: Database.Database,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportSummary> {
  const zipTotal = validPaths.length;
  const mergedByThread = new Map<
    string,
    { zipPath: string; entries: EntryWithSortYauzl[] }[]
  >();
  const zipfiles: yauzl.ZipFile[] = [];
  const entryMaps: Map<string, yauzl.Entry>[] = [];

  /** Pooled map: path -> { zipfile, entry } from ALL zips, for media lookup */
  const pooledEntryMap = new Map<
    string,
    { zipfile: yauzl.ZipFile; entry: yauzl.Entry }
  >();

  try {
    let hasAnyMessages = false;

    for (let zi = 0; zi < validPaths.length; zi++) {
      const normalizedPath = path.normalize(validPaths[zi]);
      const zipfile = await openZipWithYauzl(normalizedPath);
      zipfiles.push(zipfile);

      const allEntries = await getEntriesFromYauzl(zipfile);
      const entryMap = new Map<string, yauzl.Entry>();
      for (const e of allEntries) {
        if (!e.fileName.endsWith('/')) {
          const key = e.fileName.replace(/\\/g, '/');
          entryMap.set(key, e);
          // Add to pooled map (first zip wins if duplicate path)
          if (!pooledEntryMap.has(key)) {
            pooledEntryMap.set(key, { zipfile, entry: e });
          }
        }
      }
      entryMaps.push(entryMap);

      const messageEntries = allEntries.filter(
        (e) => !e.fileName.endsWith('/') && isMessageEntry(e.fileName)
      );

      onProgress?.({
        phase: 'extracting',
        current: zi + 1,
        total: zipTotal,
        zipIndex: zi + 1,
        zipTotal,
      });

      if (messageEntries.length > 0) {
        hasAnyMessages = true;
        const byThread = groupEntriesByThreadYauzl(messageEntries);
        for (const [threadKey, fileEntries] of byThread) {
          const existing = mergedByThread.get(threadKey) ?? [];
          existing.push({ zipPath: normalizedPath, entries: fileEntries });
          mergedByThread.set(threadKey, existing);
        }
      }
      // Media-only zips: no messages, but entries already added to pooledEntryMap
    }

    if (!hasAnyMessages) {
      throw new Error(
        'No message data found. At least one ZIP must contain message files (not just media).'
      );
    }

    const threadIds = Array.from(mergedByThread.keys());
  const totalThreads = threadIds.length;
  let threadsImported = 0;
  let messagesImported = 0;
  let reactionsImported = 0;

  ensureMediaDir();
  const mediaDir = getMediaDir();

  const insertThread = database.prepare(`
    INSERT OR REPLACE INTO threads (id, title, thread_type, participants_json, created_at)
    VALUES (?, ?, ?, ?, strftime('%s', 'now'))
  `);
  const deleteMediaForThread = database.prepare(`
    DELETE FROM media WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?)
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
  const insertMedia = database.prepare(`
    INSERT INTO media (message_id, media_type, relative_path, mime_type, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const zipPathToIndex = new Map(
    validPaths.map((p, i) => [path.normalize(p), i])
  );

  database.exec('BEGIN TRANSACTION');

  try {
    for (let i = 0; i < threadIds.length; i++) {
      const folderThreadId = threadIds[i];
      const sources = mergedByThread.get(folderThreadId)!;

      onProgress?.({
        phase: 'parsing',
        current: i + 1,
        total: totalThreads,
        zipIndex: 1,
        zipTotal,
      });

      let threadPath: string = folderThreadId;
      let title = 'Unknown';
      let threadType = 'Unknown';
      let participantsJson = '[]';
      const seenKeys = new Set<string>();
      const messagesWithSource: MessageWithSourceZip[] = [];

      for (const { zipPath, entries: fileEntries } of sources) {
        const zipIndex = zipPathToIndex.get(zipPath) ?? 0;
        const zipfile = zipfiles[zipIndex];

        for (const { entry } of fileEntries) {
          const buffer = await readEntryAsBuffer(zipfile, entry);
          const data = parseMessageBuffer(buffer, entry.fileName);
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
            messagesWithSource.push({ message: m, sourceZipPath: zipPath });
          }
        }
      }

      messagesWithSource.sort(
        (a, b) => (a.message.timestamp_ms ?? 0) - (b.message.timestamp_ms ?? 0)
      );

      const stableThreadId = threadPath;
      const allMessages = messagesWithSource.map((m) => m.message);
      const messagesToInsert = filterEditedDuplicates(allMessages);

      const byKey = new Map<string, MessageWithSourceZip>();
      for (const mws of messagesWithSource) {
        const key = `${mws.message.timestamp_ms ?? 0}\t${mws.message.sender_name ?? ''}\t${(mws.message.content ?? '').slice(0, 100)}`;
        byKey.set(key, mws);
      }
      const finalToInsert: MessageWithSourceZip[] = [];
      for (const m of messagesToInsert) {
        const key = `${m.timestamp_ms ?? 0}\t${m.sender_name ?? ''}\t${(m.content ?? '').slice(0, 100)}`;
        const mws = byKey.get(key);
        if (mws) finalToInsert.push(mws);
      }

      onProgress?.({
        phase: 'writing',
        current: threadsImported + 1,
        total: totalThreads,
        threadName: title,
        zipIndex: zipTotal,
        zipTotal,
      });

      insertThread.run(stableThreadId, title, threadType, participantsJson);
      deleteMediaForThread.run(stableThreadId);
      deleteReactionsForThread.run(stableThreadId);
      deleteMessages.run(stableThreadId);

      for (const { message: m } of finalToInsert) {
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

        const mediaItems = collectMediaItems(m);
        await extractMediaFromZipYauzl(
          pooledEntryMap,
          messageId,
          mediaItems,
          mediaDir,
          insertMedia
        );

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

    database.exec('COMMIT');
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    } finally {
      for (const zf of zipfiles) {
        zf.close();
      }
    }

    return { threadsImported, messagesImported, reactionsImported };
  } catch (err) {
    for (const zf of zipfiles) {
      zf.close();
    }
    throw err;
  }
}
