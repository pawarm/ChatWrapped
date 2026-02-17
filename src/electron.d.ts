import type { ImportProgress, ImportResult, ImportSummary } from './types/import';
import type { Message, SearchResult, StatsSummary, Thread } from './types/conversation';

declare global {
  interface Window {
    electronAPI: {
      getMediaUrl: (filename: string) => string;
      importZip: (file: File) => Promise<ImportSummary>;
      getStats: () => Promise<StatsSummary>;
      clearAllData: () => Promise<void>;
      getThreads: (search?: string, sort?: 'recent' | 'name') => Promise<Thread[]>;
      getMessages: (threadId: string, limit: number, beforeTimestampMs?: number) => Promise<Message[]>;
      getMessagesAfter: (threadId: string, afterTimestampMs: number, limit?: number) => Promise<Message[]>;
      getMessagesAroundTimestamp: (
        threadId: string,
        timestampMs: number,
        limitBefore?: number,
        limitAfter?: number
      ) => Promise<Message[]>;
      getMessagesAroundDate: (threadId: string, timestampMs: number, limit?: number) => Promise<Message[]>;
      searchMessages: (query: string, limit?: number) => Promise<SearchResult[]>;
      onImportProgress: (callback: (p: ImportProgress) => void) => () => void;
    };
  }
}

export type { ImportProgress, ImportResult, ImportSummary };
export type { Message, SearchResult, StatsSummary, Thread };

export {};
