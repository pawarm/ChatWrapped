use rusqlite::params;
use tauri::AppHandle;

use crate::db::with_db;
use crate::encoding::fix_meta_encoding;
use crate::media::{clear_media_storage, get_media_dir, get_storage_size_bytes};
use crate::models::{
    HistogramBucket, HistogramResult, MediaItem, Message, Reaction, SearchResult, StatsSummary,
    Thread,
};

fn attach_reactions_and_media(
    conn: &rusqlite::Connection,
    messages: &mut [Message],
) -> Result<(), String> {
    if messages.is_empty() {
        return Ok(());
    }

    let ids: Vec<i64> = messages.iter().map(|m| m.id).collect();
    let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // Reactions
    let reaction_sql = format!(
        "SELECT message_id, actor, reaction FROM reactions WHERE message_id IN ({placeholders})"
    );
    let mut reaction_stmt = conn.prepare(&reaction_sql).map_err(|e| e.to_string())?;
    let reaction_params: Vec<&dyn rusqlite::types::ToSql> =
        ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let reaction_rows = reaction_stmt
        .query_map(reaction_params.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut reactions_map: std::collections::HashMap<i64, Vec<Reaction>> =
        std::collections::HashMap::new();
    for row in reaction_rows {
        let (msg_id, actor, reaction) = row.map_err(|e| e.to_string())?;
        reactions_map
            .entry(msg_id)
            .or_default()
            .push(Reaction {
                actor: fix_meta_encoding(&actor),
                reaction: fix_meta_encoding(&reaction),
            });
    }

    // Media
    let media_sql = format!(
        "SELECT id, message_id, media_type, relative_path, mime_type, sort_order
         FROM media WHERE message_id IN ({placeholders}) ORDER BY message_id, sort_order"
    );
    let mut media_stmt = conn.prepare(&media_sql).map_err(|e| e.to_string())?;
    let media_params: Vec<&dyn rusqlite::types::ToSql> =
        ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    let media_rows = media_stmt
        .query_map(media_params.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut media_map: std::collections::HashMap<i64, Vec<MediaItem>> =
        std::collections::HashMap::new();
    for row in media_rows {
        let (id, msg_id, media_type, relative_path, mime_type) =
            row.map_err(|e| e.to_string())?;
        media_map.entry(msg_id).or_default().push(MediaItem {
            id,
            media_type,
            relative_path,
            mime_type,
        });
    }

    for msg in messages.iter_mut() {
        msg.reactions = reactions_map.remove(&msg.id);
        msg.media = media_map.remove(&msg.id);
    }

    Ok(())
}

/// Standard SELECT columns for message queries — must match `map_message_row`.
const MSG_COLUMNS: &str =
    "id, thread_id, sender_name, timestamp_ms, content, content_type, special_type";

fn map_message_row(row: &rusqlite::Row) -> rusqlite::Result<Message> {
    Ok(Message {
        id: row.get(0)?,
        thread_id: row.get(1)?,
        sender_name: row.get(2)?,
        timestamp_ms: row.get(3)?,
        content: row.get(4)?,
        content_type: row.get(5)?,
        special_type: row.get(6)?,
        reactions: None,
        media: None,
    })
}

#[tauri::command]
pub fn get_media_url(app: AppHandle, filename: String) -> Result<String, String> {
    let media_dir = get_media_dir(&app);
    let file_path = media_dir.join(&filename);
    let path_str = file_path.to_string_lossy().to_string();
    Ok(format!("asset://localhost/{}", path_str))
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<StatsSummary, String> {
    with_db(&app, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT
                    (SELECT COUNT(*) FROM threads) as thread_count,
                    (SELECT COUNT(*) FROM messages) as message_count,
                    (SELECT COUNT(*) FROM reactions) as reaction_count,
                    (SELECT COALESCE(SUM(1 + LENGTH(COALESCE(content,'')) - LENGTH(REPLACE(COALESCE(content,''), ' ', ''))), 0) FROM messages WHERE content IS NOT NULL AND content != '') as word_count,
                    (SELECT MIN(timestamp_ms) FROM messages) as first_message_at,
                    (SELECT MAX(timestamp_ms) FROM messages) as last_message_at",
            )
            .map_err(|e| e.to_string())?;

        let result = stmt
            .query_row([], |row| {
                Ok(StatsSummary {
                    thread_count: row.get(0)?,
                    message_count: row.get(1)?,
                    reaction_count: row.get(2)?,
                    word_count: row.get(3)?,
                    first_message_at: row.get(4)?,
                    last_message_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        Ok(result)
    })
}

#[tauri::command]
pub fn get_storage_size(app: AppHandle) -> Result<u64, String> {
    Ok(get_storage_size_bytes(&app))
}

#[tauri::command]
pub fn clear_all_data(app: AppHandle) -> Result<(), String> {
    with_db(&app, |conn| {
        conn.execute_batch(
            "DELETE FROM media; DELETE FROM reactions; DELETE FROM messages; DELETE FROM threads;",
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    clear_media_storage(&app);
    Ok(())
}

#[tauri::command]
pub fn get_threads(
    app: AppHandle,
    search: Option<String>,
    sort: Option<String>,
) -> Result<Vec<Thread>, String> {
    with_db(&app, |conn| {
        let search_trimmed = search.unwrap_or_default();
        let sort_kind = sort.unwrap_or_else(|| "recent".to_string());

        let search_pattern = if search_trimmed.trim().is_empty() {
            None
        } else {
            let escaped = search_trimmed
                .replace('%', "\\%")
                .replace('_', "\\_");
            Some(format!("%{escaped}%"))
        };

        let order_by = if sort_kind == "name" {
            "t.title COLLATE NOCASE ASC"
        } else {
            "COALESCE(MAX(m.timestamp_ms), 0) DESC"
        };

        let sql = if search_pattern.is_some() {
            format!(
                "SELECT t.id, t.title, t.thread_type, t.participants_json,
                        COUNT(m.id) as message_count, MAX(m.timestamp_ms) as last_message_at
                 FROM threads t LEFT JOIN messages m ON m.thread_id = t.id
                 WHERE t.title LIKE ?1 ESCAPE '\\' OR t.participants_json LIKE ?1 ESCAPE '\\'
                 GROUP BY t.id ORDER BY {order_by}"
            )
        } else {
            format!(
                "SELECT t.id, t.title, t.thread_type, t.participants_json,
                        COUNT(m.id) as message_count, MAX(m.timestamp_ms) as last_message_at
                 FROM threads t LEFT JOIN messages m ON m.thread_id = t.id
                 GROUP BY t.id ORDER BY {order_by}"
            )
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let mut threads = Vec::new();
        let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Thread> {
            Ok(Thread {
                id: row.get(0)?,
                title: row.get(1)?,
                thread_type: row.get(2)?,
                participants_json: row.get(3)?,
                message_count: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                last_message_at: row.get(5)?,
            })
        };

        if let Some(ref pattern) = search_pattern {
            let rows = stmt.query_map(params![pattern], map_row).map_err(|e| e.to_string())?;
            for row in rows {
                threads.push(row.map_err(|e| e.to_string())?);
            }
        } else {
            let rows = stmt.query_map([], map_row).map_err(|e| e.to_string())?;
            for row in rows {
                threads.push(row.map_err(|e| e.to_string())?);
            }
        }

        Ok(threads)
    })
}

#[tauri::command]
pub fn get_messages(
    app: AppHandle,
    thread_id: String,
    limit: Option<i64>,
    before_timestamp_ms: Option<i64>,
) -> Result<Vec<Message>, String> {
    with_db(&app, |conn| {
        let lim = limit.unwrap_or(50);
        if thread_id.is_empty() {
            return Ok(vec![]);
        }

        let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) =
            if let Some(before_ts) = before_timestamp_ms {
                (
                    format!("SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 AND timestamp_ms < ?2 ORDER BY timestamp_ms DESC LIMIT ?3"),
                    vec![
                        Box::new(thread_id.clone()),
                        Box::new(before_ts),
                        Box::new(lim),
                    ],
                )
            } else {
                (
                    format!("SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 ORDER BY timestamp_ms DESC LIMIT ?2"),
                    vec![Box::new(thread_id.clone()), Box::new(lim)],
                )
            };

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = stmt
            .query_map(params_refs.as_slice(), map_message_row)
            .map_err(|e| e.to_string())?;

        let mut messages: Vec<Message> = Vec::new();
        for row in rows {
            messages.push(row.map_err(|e| e.to_string())?);
        }
        messages.reverse();

        attach_reactions_and_media(conn, &mut messages)?;
        Ok(messages)
    })
}

#[tauri::command]
pub fn get_messages_after(
    app: AppHandle,
    thread_id: String,
    after_timestamp_ms: i64,
    limit: Option<i64>,
) -> Result<Vec<Message>, String> {
    with_db(&app, |conn| {
        let lim = limit.unwrap_or(50);
        if thread_id.is_empty() {
            return Ok(vec![]);
        }

        let sql = format!(
            "SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 AND timestamp_ms > ?2 ORDER BY timestamp_ms ASC LIMIT ?3"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![thread_id, after_timestamp_ms, lim], map_message_row)
            .map_err(|e| e.to_string())?;

        let mut messages: Vec<Message> = Vec::new();
        for row in rows {
            messages.push(row.map_err(|e| e.to_string())?);
        }

        attach_reactions_and_media(conn, &mut messages)?;
        Ok(messages)
    })
}

#[tauri::command]
pub fn get_messages_around_timestamp(
    app: AppHandle,
    thread_id: String,
    timestamp_ms: i64,
    limit_before: Option<i64>,
    limit_after: Option<i64>,
) -> Result<Vec<Message>, String> {
    with_db(&app, |conn| {
        let lb = limit_before.unwrap_or(50);
        let la = limit_after.unwrap_or(50);
        if thread_id.is_empty() {
            return Ok(vec![]);
        }

        let before_sql = format!(
            "SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 AND timestamp_ms < ?2 ORDER BY timestamp_ms DESC LIMIT ?3"
        );
        let mut before_stmt = conn.prepare(&before_sql).map_err(|e| e.to_string())?;
        let before_rows = before_stmt
            .query_map(params![thread_id, timestamp_ms, lb], map_message_row)
            .map_err(|e| e.to_string())?;

        let mut before: Vec<Message> = Vec::new();
        for row in before_rows {
            before.push(row.map_err(|e| e.to_string())?);
        }
        before.reverse();

        let after_sql = format!(
            "SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 AND timestamp_ms >= ?2 ORDER BY timestamp_ms ASC LIMIT ?3"
        );
        let mut after_stmt = conn.prepare(&after_sql).map_err(|e| e.to_string())?;
        let after_rows = after_stmt
            .query_map(params![thread_id, timestamp_ms, la], map_message_row)
            .map_err(|e| e.to_string())?;

        for row in after_rows {
            before.push(row.map_err(|e| e.to_string())?);
        }

        attach_reactions_and_media(conn, &mut before)?;
        Ok(before)
    })
}

#[tauri::command]
pub fn get_messages_around_date(
    app: AppHandle,
    thread_id: String,
    timestamp_ms: i64,
    limit: Option<i64>,
) -> Result<Vec<Message>, String> {
    with_db(&app, |conn| {
        let lim = limit.unwrap_or(100);
        if thread_id.is_empty() {
            return Ok(vec![]);
        }

        // Calculate start/end of day in UTC-like fashion matching the JS logic
        let ms_per_day: i64 = 86_400_000;
        let day_start = timestamp_ms - (timestamp_ms % ms_per_day);
        let day_end = day_start + ms_per_day - 1;

        let sql = format!(
            "SELECT {MSG_COLUMNS} FROM messages WHERE thread_id = ?1 AND timestamp_ms >= ?2 AND timestamp_ms <= ?3 ORDER BY timestamp_ms ASC LIMIT ?4"
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![thread_id, day_start, day_end, lim], map_message_row)
            .map_err(|e| e.to_string())?;

        let mut messages: Vec<Message> = Vec::new();
        for row in rows {
            messages.push(row.map_err(|e| e.to_string())?);
        }

        attach_reactions_and_media(conn, &mut messages)?;
        Ok(messages)
    })
}

const HISTOGRAM_BINS: i64 = 60;

#[tauri::command]
pub fn get_message_histogram(
    app: AppHandle,
    thread_id: String,
) -> Result<Option<HistogramResult>, String> {
    with_db(&app, |conn| {
        if thread_id.is_empty() {
            return Ok(None);
        }

        let range: (Option<i64>, Option<i64>) = conn
            .query_row(
                "SELECT MIN(timestamp_ms), MAX(timestamp_ms) FROM messages WHERE thread_id = ?1",
                params![thread_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        let (min_ts, max_ts) = match range {
            (Some(min), Some(max)) => (min, max),
            _ => return Ok(None),
        };

        let span = max_ts - min_ts;
        let divisor = if span > 0 { span } else { 1 };

        let mut stmt = conn
            .prepare(
                "SELECT CAST((timestamp_ms - ?1) * ?2 / ?3 AS INTEGER) as bin_index, COUNT(*) as count
                 FROM messages WHERE thread_id = ?4 GROUP BY bin_index",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(
                params![min_ts, HISTOGRAM_BINS - 1, divisor, thread_id],
                |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
                },
            )
            .map_err(|e| e.to_string())?;

        let mut count_by_bin = std::collections::HashMap::new();
        for row in rows {
            let (bin_index, count) = row.map_err(|e| e.to_string())?;
            let clamped = bin_index.min(HISTOGRAM_BINS - 1);
            *count_by_bin.entry(clamped).or_insert(0i64) += count;
        }

        let buckets: Vec<HistogramBucket> = (0..HISTOGRAM_BINS)
            .map(|i| HistogramBucket {
                bin_index: i,
                count: *count_by_bin.get(&i).unwrap_or(&0),
            })
            .collect();

        Ok(Some(HistogramResult {
            min_timestamp_ms: min_ts,
            max_timestamp_ms: max_ts,
            buckets,
        }))
    })
}

#[tauri::command]
pub fn search_messages(
    app: AppHandle,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, String> {
    with_db(&app, |conn| {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(vec![]);
        }
        let lim = limit.unwrap_or(50);
        let pattern = format!(
            "%{}%",
            trimmed.replace('%', "\\%").replace('_', "\\_")
        );

        let mut stmt = conn
            .prepare(
                "SELECT m.id, m.thread_id, t.title, m.sender_name, m.timestamp_ms, m.content
                 FROM messages m JOIN threads t ON t.id = m.thread_id
                 WHERE m.content LIKE ?1 ESCAPE '\\'
                 ORDER BY m.timestamp_ms DESC LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![pattern, lim], |row| {
                let content: Option<String> = row.get(5)?;
                let snippet = content.as_ref().map(|c| {
                    if c.len() > 100 {
                        format!("{}…", &c[..100])
                    } else {
                        c.clone()
                    }
                });
                Ok(SearchResult {
                    id: row.get(0)?,
                    thread_id: row.get(1)?,
                    thread_title: row.get(2)?,
                    sender_name: row.get(3)?,
                    timestamp_ms: row.get(4)?,
                    content,
                    snippet,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
        Ok(results)
    })
}
