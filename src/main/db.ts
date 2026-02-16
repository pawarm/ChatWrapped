import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'messages.db');
    db = new Database(dbPath);
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      thread_type TEXT NOT NULL DEFAULT 'Unknown',
      participants_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      content TEXT,
      content_type TEXT,
      special_type TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (thread_id) REFERENCES threads(id)
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      actor TEXT NOT NULL,
      reaction TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp_ms);
    CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
  `);
  migrateSchema(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_special_type ON messages(special_type);
  `);
}

function migrateSchema(database: Database.Database): void {
  const tableInfo = database.prepare('PRAGMA table_info(messages)').all() as {
    name: string;
  }[];
  const hasSpecialType = tableInfo.some((col) => col.name === 'special_type');
  if (!hasSpecialType) {
    database.exec('ALTER TABLE messages ADD COLUMN special_type TEXT');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
