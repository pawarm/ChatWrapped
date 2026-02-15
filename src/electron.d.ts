import type { ImportProgress, ImportResult, ImportSummary } from './types/import';

declare global {
  interface Window {
    electronAPI: {
      importZip: (file: File) => Promise<ImportSummary>;
      onImportProgress: (callback: (p: ImportProgress) => void) => () => void;
    };
  }
}

export type { ImportProgress, ImportResult, ImportSummary };

export {};
