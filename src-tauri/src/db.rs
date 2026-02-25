use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }
}

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&app_data).ok();
    app_data.join("messages.db")
}

pub fn ensure_db(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<DbState>();
    let mut guard = state.conn.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let db_path = get_db_path(app);
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        init_schema(&conn).map_err(|e| e.to_string())?;
        *guard = Some(conn);
    }
    Ok(())
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS threads (
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

        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            media_type TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            mime_type TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (message_id) REFERENCES messages(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp_ms);
        CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
        CREATE INDEX IF NOT EXISTS idx_media_message_id ON media(message_id);",
    )?;
    migrate_schema(conn)?;
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_messages_special_type ON messages(special_type);",
    )?;
    Ok(())
}

fn migrate_schema(conn: &Connection) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(messages)")?;
    let has_special_type = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .any(|name| name.map(|n| n == "special_type").unwrap_or(false));
    if !has_special_type {
        conn.execute_batch("ALTER TABLE messages ADD COLUMN special_type TEXT")?;
    }
    Ok(())
}

pub fn with_db<F, R>(app: &AppHandle, f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    ensure_db(app)?;
    let state = app.state::<DbState>();
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;
    f(conn)
}
