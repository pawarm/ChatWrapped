import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { StatsSummary, Thread, Message, SearchResult } from '@/types/conversation';
import type { ImportSummary, ImportProgress, ZipInspectResult } from '@/types/import';

export const api = {
  getMediaUrl: (filename: string): Promise<string> =>
    invoke<string>('get_media_url', { filename }),

  getStats: () => invoke<StatsSummary>('get_stats'),

  getStorageSize: () => invoke<number>('get_storage_size'),

  clearAllData: () => invoke<void>('clear_all_data'),

  getThreads: (search?: string, sort?: 'recent' | 'name') =>
    invoke<Thread[]>('get_threads', { search, sort }),

  getMessages: (threadId: string, limit: number, beforeTimestampMs?: number) =>
    invoke<Message[]>('get_messages', {
      threadId,
      limit,
      beforeTimestampMs: beforeTimestampMs ?? null,
    }),

  getMessagesAfter: (threadId: string, afterTimestampMs: number, limit?: number) =>
    invoke<Message[]>('get_messages_after', {
      threadId,
      afterTimestampMs,
      limit: limit ?? null,
    }),

  getMessagesAroundTimestamp: (
    threadId: string,
    timestampMs: number,
    limitBefore?: number,
    limitAfter?: number,
  ) =>
    invoke<Message[]>('get_messages_around_timestamp', {
      threadId,
      timestampMs,
      limitBefore: limitBefore ?? null,
      limitAfter: limitAfter ?? null,
    }),

  getMessagesAroundDate: (threadId: string, timestampMs: number, limit?: number) =>
    invoke<Message[]>('get_messages_around_date', {
      threadId,
      timestampMs,
      limit: limit ?? null,
    }),

  getMessageHistogram: (threadId: string) =>
    invoke<{
      minTimestampMs: number;
      maxTimestampMs: number;
      buckets: { binIndex: number; count: number }[];
    } | null>('get_message_histogram', { threadId }),

  searchMessages: (query: string, limit?: number) =>
    invoke<SearchResult[]>('search_messages', { query, limit: limit ?? null }),

  inspectZip: (zipPath: string) =>
    invoke<ZipInspectResult>('inspect_zip', { zipPath }),

  importZip: (zipPath: string) =>
    invoke<ImportSummary>('import_zip', { zipPath }),

  importZips: (zipPaths: string[]) =>
    invoke<ImportSummary>('import_zips', { zipPaths }),

  onImportProgress: async (
    callback: (p: ImportProgress) => void,
  ): Promise<UnlistenFn> => {
    return listen<ImportProgress>('import:progress', (event) => {
      callback(event.payload);
    });
  },
};
