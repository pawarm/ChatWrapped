export interface ImportSummary {
  threadsImported: number;
  messagesImported: number;
  reactionsImported: number;
}

export interface ImportProgress {
  phase: 'extracting' | 'parsing' | 'writing';
  current: number;
  total?: number;
  threadName?: string;
  zipIndex?: number;
  zipTotal?: number;
}

export interface ZipInspectResult {
  threadCount: number;
  messageFileCount: number;
  format: 'valid' | 'invalid';
  /** True when zip has Meta structure but no message JSON (media only) */
  mediaOnly?: boolean;
}
