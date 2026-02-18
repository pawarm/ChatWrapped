import { ipcMain } from 'electron';
import type Database from 'better-sqlite3';
import { fixMetaEncoding } from '../lib/utils';
import { clearMediaStorage, getStorageSizeBytes } from './mediaStorage';
import type { MediaItem, Message, SearchResult, StatsSummary, Thread } from '../types/conversation';

function attachMediaToMessages(
  db: Database.Database,
  messages: (Message & { reactions?: { actor: string; reaction: string }[] })[]
): (Message & { reactions?: { actor: string; reaction: string }[] })[] {
  if (messages.length === 0) return messages;
  const messageIds = messages.map((m) => m.id);
  const placeholders = messageIds.map(() => '?').join(',');
  const mediaRows = db
    .prepare(
      `SELECT id, message_id, media_type, relative_path, mime_type, sort_order
       FROM media WHERE message_id IN (${placeholders}) ORDER BY message_id, sort_order`
    )
    .all(...messageIds) as {
    id: number;
    message_id: number;
    media_type: string;
    relative_path: string;
    mime_type: string | null;
    sort_order: number;
  }[];
  const mediaByMessage = new Map<number, MediaItem[]>();
  for (const row of mediaRows) {
    const list = mediaByMessage.get(row.message_id) ?? [];
    list.push({
      id: row.id,
      media_type: row.media_type,
      relative_path: row.relative_path,
      mime_type: row.mime_type,
    });
    mediaByMessage.set(row.message_id, list);
  }
  return messages.map((m) => ({
    ...m,
    media: mediaByMessage.get(m.id),
  }));
}

export function registerDbHandlers(getDbInstance: () => Database.Database): void {
  ipcMain.handle('db:getStats', (): StatsSummary => {
    const db = getDbInstance();
    const row = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM threads) as thread_count,
          (SELECT COUNT(*) FROM messages) as message_count,
          (SELECT COUNT(*) FROM reactions) as reaction_count,
          (SELECT COALESCE(SUM(1 + LENGTH(COALESCE(content,'')) - LENGTH(REPLACE(COALESCE(content,''), ' ', ''))), 0) FROM messages WHERE content IS NOT NULL AND content != '') as word_count,
          (SELECT MIN(timestamp_ms) FROM messages) as first_message_at,
          (SELECT MAX(timestamp_ms) FROM messages) as last_message_at`
      )
      .get() as {
      thread_count: number;
      message_count: number;
      reaction_count: number;
      word_count: number;
      first_message_at: number | null;
      last_message_at: number | null;
    };
    return {
      threadCount: row.thread_count ?? 0,
      messageCount: row.message_count ?? 0,
      reactionCount: row.reaction_count ?? 0,
      wordCount: row.word_count ?? 0,
      firstMessageAt: row.first_message_at ?? null,
      lastMessageAt: row.last_message_at ?? null,
    };
  });

  ipcMain.handle('db:getStorageSize', (): number => {
    return getStorageSizeBytes();
  });

  ipcMain.handle('db:clearAllData', (): void => {
    const db = getDbInstance();
    db.exec('DELETE FROM media; DELETE FROM reactions; DELETE FROM messages; DELETE FROM threads;');
    clearMediaStorage();
  });

  ipcMain.handle(
    'db:getThreads',
    (
      _: unknown,
      payload: { search?: string; sort?: 'recent' | 'name' }
    ): Thread[] => {
      const db = getDbInstance();
      const { search = '', sort = 'recent' } = payload ?? {};
      const searchPattern = search.trim()
        ? `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
        : null;

      const orderBy =
        sort === 'name'
          ? 't.title COLLATE NOCASE ASC'
          : 'COALESCE(MAX(m.timestamp_ms), 0) DESC';

      let sql = `
        SELECT
          t.id,
          t.title,
          t.thread_type,
          t.participants_json,
          COUNT(m.id) as message_count,
          MAX(m.timestamp_ms) as last_message_at
        FROM threads t
        LEFT JOIN messages m ON m.thread_id = t.id
      `;
      const params: (string | number)[] = [];

      if (searchPattern) {
        sql += ` WHERE t.title LIKE ? ESCAPE '\\' OR t.participants_json LIKE ? ESCAPE '\\'`;
        params.push(searchPattern, searchPattern);
      }

      sql += ` GROUP BY t.id ORDER BY ${orderBy}`;

      const rows = db.prepare(sql).all(...params) as (Thread & { message_count: number; last_message_at: number | null })[];

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        thread_type: r.thread_type,
        participants_json: r.participants_json,
        message_count: r.message_count ?? 0,
        last_message_at: r.last_message_at ?? undefined,
      }));
    }
  );

  ipcMain.handle(
    'db:getMessages',
    (
      _: unknown,
      payload: { threadId: string; limit: number; beforeTimestampMs?: number }
    ): Message[] => {
      const db = getDbInstance();
      const { threadId, limit = 50, beforeTimestampMs } = payload ?? {};

      if (!threadId) return [];

      let sql = `SELECT id, thread_id, sender_name, timestamp_ms, content, content_type, special_type
        FROM messages WHERE thread_id = ?`;
      const params: (string | number)[] = [threadId];

      let messages: Message[];
      if (beforeTimestampMs != null) {
        sql += ` AND timestamp_ms < ?`;
        params.push(beforeTimestampMs);
        sql += ` ORDER BY timestamp_ms DESC LIMIT ?`;
        params.push(limit);
        const rows = db.prepare(sql).all(...params) as Message[];
        messages = [...rows].reverse();
      } else {
        sql += ` ORDER BY timestamp_ms DESC LIMIT ?`;
        params.push(limit);
        const rows = db.prepare(sql).all(...params) as Message[];
        messages = [...rows].reverse();
      }


      if (messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const reactionsRows = db
        .prepare(
          `SELECT message_id, actor, reaction FROM reactions WHERE message_id IN (${placeholders})`
        )
        .all(...messageIds) as { message_id: number; actor: string; reaction: string }[];

      const reactionsByMessage = new Map<number, { actor: string; reaction: string }[]>();
      for (const r of reactionsRows) {
        const list = reactionsByMessage.get(r.message_id) ?? [];
        list.push({
          actor: fixMetaEncoding(r.actor),
          reaction: fixMetaEncoding(r.reaction),
        });
        reactionsByMessage.set(r.message_id, list);
      }

      const withReactions = messages.map((m) => ({
        ...m,
        reactions: reactionsByMessage.get(m.id),
      }));
      return attachMediaToMessages(db, withReactions);
    }
  );

  ipcMain.handle(
    'db:getMessagesAfter',
    (
      _: unknown,
      payload: { threadId: string; afterTimestampMs: number; limit?: number }
    ): Message[] => {
      const db = getDbInstance();
      const { threadId, afterTimestampMs, limit = 50 } = payload ?? {};

      if (!threadId) return [];

      const sql = `SELECT id, thread_id, sender_name, timestamp_ms, content, content_type, special_type
        FROM messages
        WHERE thread_id = ? AND timestamp_ms > ?
        ORDER BY timestamp_ms ASC
        LIMIT ?`;
      const messages = db
        .prepare(sql)
        .all(threadId, afterTimestampMs, limit) as Message[];

      if (messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const reactionsRows = db
        .prepare(
          `SELECT message_id, actor, reaction FROM reactions WHERE message_id IN (${placeholders})`
        )
        .all(...messageIds) as { message_id: number; actor: string; reaction: string }[];

      const reactionsByMessage = new Map<number, { actor: string; reaction: string }[]>();
      for (const r of reactionsRows) {
        const list = reactionsByMessage.get(r.message_id) ?? [];
        list.push({
          actor: fixMetaEncoding(r.actor),
          reaction: fixMetaEncoding(r.reaction),
        });
        reactionsByMessage.set(r.message_id, list);
      }

      const withReactions = messages.map((m) => ({
        ...m,
        reactions: reactionsByMessage.get(m.id),
      }));
      return attachMediaToMessages(db, withReactions);
    }
  );

  ipcMain.handle(
    'db:getMessagesAroundTimestamp',
    (
      _: unknown,
      payload: {
        threadId: string;
        timestampMs: number;
        limitBefore?: number;
        limitAfter?: number;
      }
    ): Message[] => {
      const db = getDbInstance();
      const {
        threadId,
        timestampMs,
        limitBefore = 50,
        limitAfter = 50,
      } = payload ?? {};

      if (!threadId) return [];

      const beforeSql = `SELECT id, thread_id, sender_name, timestamp_ms, content, content_type, special_type
        FROM messages
        WHERE thread_id = ? AND timestamp_ms < ?
        ORDER BY timestamp_ms DESC
        LIMIT ?`;
      const beforeRows = db
        .prepare(beforeSql)
        .all(threadId, timestampMs, limitBefore) as Message[];
      const before = [...beforeRows].reverse();

      const afterSql = `SELECT id, thread_id, sender_name, timestamp_ms, content, content_type, special_type
        FROM messages
        WHERE thread_id = ? AND timestamp_ms >= ?
        ORDER BY timestamp_ms ASC
        LIMIT ?`;
      const after = db
        .prepare(afterSql)
        .all(threadId, timestampMs, limitAfter) as Message[];

      const messages = [...before, ...after];
      if (messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const reactionsRows = db
        .prepare(
          `SELECT message_id, actor, reaction FROM reactions WHERE message_id IN (${placeholders})`
        )
        .all(...messageIds) as { message_id: number; actor: string; reaction: string }[];

      const reactionsByMessage = new Map<number, { actor: string; reaction: string }[]>();
      for (const r of reactionsRows) {
        const list = reactionsByMessage.get(r.message_id) ?? [];
        list.push({
          actor: fixMetaEncoding(r.actor),
          reaction: fixMetaEncoding(r.reaction),
        });
        reactionsByMessage.set(r.message_id, list);
      }

      const withReactions = messages.map((m) => ({
        ...m,
        reactions: reactionsByMessage.get(m.id),
      }));
      return attachMediaToMessages(db, withReactions);
    }
  );

  ipcMain.handle(
    'db:getMessagesAroundDate',
    (
      _: unknown,
      payload: { threadId: string; timestampMs: number; limit?: number }
    ): Message[] => {
      const db = getDbInstance();
      const { threadId, timestampMs, limit = 100 } = payload ?? {};

      if (!threadId) return [];

      const d = new Date(timestampMs);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
        999
      ).getTime();

      const sql = `SELECT id, thread_id, sender_name, timestamp_ms, content, content_type, special_type
        FROM messages
        WHERE thread_id = ? AND timestamp_ms >= ? AND timestamp_ms <= ?
        ORDER BY timestamp_ms ASC
        LIMIT ?`;
      const messages = db
        .prepare(sql)
        .all(threadId, startOfDay, endOfDay, limit) as Message[];

      if (messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const placeholders = messageIds.map(() => '?').join(',');
      const reactionsRows = db
        .prepare(
          `SELECT message_id, actor, reaction FROM reactions WHERE message_id IN (${placeholders})`
        )
        .all(...messageIds) as { message_id: number; actor: string; reaction: string }[];

      const reactionsByMessage = new Map<number, { actor: string; reaction: string }[]>();
      for (const r of reactionsRows) {
        const list = reactionsByMessage.get(r.message_id) ?? [];
        list.push({
          actor: fixMetaEncoding(r.actor),
          reaction: fixMetaEncoding(r.reaction),
        });
        reactionsByMessage.set(r.message_id, list);
      }

      const withReactions = messages.map((m) => ({
        ...m,
        reactions: reactionsByMessage.get(m.id),
      }));
      return attachMediaToMessages(db, withReactions);
    }
  );

  const HISTOGRAM_BINS = 60;

  ipcMain.handle(
    'db:getMessageHistogram',
    (
      _: unknown,
      payload: { threadId: string }
    ): {
      minTimestampMs: number;
      maxTimestampMs: number;
      buckets: { binIndex: number; count: number }[];
    } | null => {
      const db = getDbInstance();
      const { threadId } = payload ?? {};
      if (!threadId) return null;

      const rangeRow = db
        .prepare(
          `SELECT MIN(timestamp_ms) as min_ts, MAX(timestamp_ms) as max_ts
           FROM messages WHERE thread_id = ?`
        )
        .get(threadId) as { min_ts: number | null; max_ts: number | null };

      const minTs = rangeRow?.min_ts;
      const maxTs = rangeRow?.max_ts;
      if (minTs == null || maxTs == null) return null;

      const span = maxTs - minTs;
      const divisor = span > 0 ? span : 1;

      const bucketRows = db
        .prepare(
          `SELECT CAST((timestamp_ms - ?) * ? / ? AS INTEGER) as bin_index, COUNT(*) as count
           FROM messages
           WHERE thread_id = ?
           GROUP BY bin_index`
        )
        .all(minTs, HISTOGRAM_BINS - 1, divisor, threadId) as { bin_index: number; count: number }[];

      const countByBin = new Map(
        bucketRows.map((r) => [Math.min(r.bin_index, HISTOGRAM_BINS - 1), r.count])
      );
      const buckets = Array.from({ length: HISTOGRAM_BINS }, (_, i) => ({
        binIndex: i,
        count: countByBin.get(i) ?? 0,
      }));

      return {
        minTimestampMs: minTs,
        maxTimestampMs: maxTs,
        buckets,
      };
    }
  );

  ipcMain.handle(
    'db:searchMessages',
    (
      _: unknown,
      payload: { query: string; limit?: number }
    ): SearchResult[] => {
      const db = getDbInstance();
      const { query = '', limit = 50 } = payload ?? {};
      const trimmed = query.trim();
      if (!trimmed) return [];

      const pattern = `%${trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

      const sql = `
        SELECT
          m.id,
          m.thread_id,
          t.title as thread_title,
          m.sender_name,
          m.timestamp_ms,
          m.content
        FROM messages m
        JOIN threads t ON t.id = m.thread_id
        WHERE m.content LIKE ? ESCAPE '\\'
        ORDER BY m.timestamp_ms DESC
        LIMIT ?
      `;
      const rows = db.prepare(sql).all(pattern, limit) as (SearchResult & { thread_title: string })[];

      return rows.map((r) => ({
        id: r.id,
        thread_id: r.thread_id,
        thread_title: r.thread_title,
        sender_name: r.sender_name,
        timestamp_ms: r.timestamp_ms,
        content: r.content,
        snippet: r.content ? r.content.slice(0, 100) + (r.content.length > 100 ? '…' : '') : undefined,
      }));
    }
  );
}
