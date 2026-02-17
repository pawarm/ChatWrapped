export interface Thread {
  id: string;
  title: string;
  thread_type: string;
  participants_json: string;
  message_count?: number;
  last_message_at?: number;
}

export interface MediaItem {
  id: number;
  media_type: string;
  relative_path: string;
  mime_type?: string | null;
}

export interface Message {
  id: number;
  thread_id: string;
  sender_name: string;
  timestamp_ms: number;
  content: string | null;
  content_type: string;
  special_type?: string | null;
  reactions?: { actor: string; reaction: string }[];
  media?: MediaItem[];
}

export interface SearchResult {
  id: number;
  thread_id: string;
  thread_title: string;
  sender_name: string;
  timestamp_ms: number;
  content: string | null;
  snippet?: string;
}

export interface StatsSummary {
  threadCount: number;
  messageCount: number;
  reactionCount: number;
  wordCount: number;
  firstMessageAt: number | null;
  lastMessageAt: number | null;
}
