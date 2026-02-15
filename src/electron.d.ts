import type { ImportProgress, ImportResult, ImportSummary } from './types/import';
import type { Message, SearchResult, Thread } from './types/conversation';

declare global {
  interface Window {
    electronAPI: {
      importZip: (file: File) => Promise<ImportSummary>;
      getThreads: (search?: string, sort?: 'recent' | 'name') => Promise<Thread[]>;
      getMessages: (threadId: string, limit: number, beforeTimestampMs?: number) => Promise<Message[]>;
      getMessagesAroundDate: (threadId: string, timestampMs: number, limit?: number) => Promise<Message[]>;
      searchMessages: (query: string, limit?: number) => Promise<SearchResult[]>;
      onImportProgress: (callback: (p: ImportProgress) => void) => () => void;
    };
  }
}

export type { ImportProgress, ImportResult, ImportSummary };
export type { Message, SearchResult, Thread };

export {};
