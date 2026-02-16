export interface Thread {
  id: string;
  title: string;
  thread_type: string;
  participants_json: string;
  message_count?: number;
  last_message_at?: number;
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
