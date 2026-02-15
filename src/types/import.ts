export interface ImportResult {
  threadTitle: string;
  threadType: string;
  participantCount: number;
  messageCount: number;
  sampleMessage?: { sender_name: string; content?: string };
}

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
}
