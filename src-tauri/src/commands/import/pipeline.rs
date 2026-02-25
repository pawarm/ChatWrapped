use rusqlite::params;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

use crate::db::{ensure_db, DbState};
use crate::encoding::fix_meta_encoding;
use crate::media::{ensure_media_dir, get_media_dir};
use crate::models::{ImportProgress, ImportSummary};

use super::classify::{
    classify_special_message, collect_media_items, filter_edited_duplicates, mime_from_ext,
};
use super::meta_format::{
    extract_sort_num, extract_thread_key, is_message_entry, MetaMessage, MetaMessageFile,
};

struct ZipEntryInfo {
    zip_index: usize,
    entry_index: usize,
    name: String,
    sort_num: i32,
}

type ScanResult = (
    Vec<ZipEntryInfo>,
    Vec<(usize, usize, String)>,
    Vec<zip::ZipArchive<fs::File>>,
);

#[tauri::command]
pub async fn import_zip(app: AppHandle, zip_path: String) -> Result<ImportSummary, String> {
    if zip_path.is_empty() || !zip_path.to_lowercase().ends_with(".zip") {
        return Err("Please select a ZIP file.".into());
    }
    if !Path::new(&zip_path).exists() {
        return Err("File not found.".into());
    }
    let paths = vec![zip_path];
    tauri::async_runtime::spawn_blocking(move || do_import_zips(&app, &paths))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_zips(app: AppHandle, zip_paths: Vec<String>) -> Result<ImportSummary, String> {
    if zip_paths.is_empty() {
        return Err("No ZIP files selected.".into());
    }

    let valid: Vec<String> = zip_paths
        .into_iter()
        .filter(|p| !p.is_empty() && p.to_lowercase().ends_with(".zip") && Path::new(p).exists())
        .collect();

    if valid.is_empty() {
        return Err("No valid ZIP files found.".into());
    }

    tauri::async_runtime::spawn_blocking(move || do_import_zips(&app, &valid))
        .await
        .map_err(|e| e.to_string())?
}

fn do_import_zips(app: &AppHandle, zip_paths: &[String]) -> Result<ImportSummary, String> {
    ensure_db(app)?;
    ensure_media_dir(app);
    let media_dir = get_media_dir(app);
    let zip_total = zip_paths.len();

    let (all_message_entries, all_entry_names, mut archives) = scan_zips(app, zip_paths)?;

    if all_message_entries.is_empty() {
        return Err(
            "Unrecognized format. Expected a Meta Messenger export with messages/inbox/, encrypted/, or e2ee_cutover/ message files.".into()
        );
    }

    let mut by_thread: HashMap<String, Vec<&ZipEntryInfo>> = HashMap::new();
    for entry in &all_message_entries {
        let key = extract_thread_key(&entry.name);
        by_thread.entry(key).or_default().push(entry);
    }
    for entries in by_thread.values_mut() {
        entries.sort_by_key(|e| e.sort_num);
    }

    let mut media_lookup: HashMap<String, (usize, usize)> = HashMap::new();
    for (zi, ei, name) in &all_entry_names {
        let normalized = name.replace('\\', "/");
        media_lookup.entry(normalized).or_insert((*zi, *ei));
    }

    let thread_ids: Vec<String> = by_thread.keys().cloned().collect();
    let total_threads = thread_ids.len();
    let mut threads_imported = 0usize;
    let mut messages_imported = 0usize;
    let mut reactions_imported = 0usize;

    let state = app.state::<DbState>();
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    conn.execute_batch("BEGIN TRANSACTION")
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        for (i, folder_thread_id) in thread_ids.iter().enumerate() {
            let file_entries = &by_thread[folder_thread_id];

            app.emit(
                "import:progress",
                ImportProgress {
                    phase: "parsing".into(),
                    current: i + 1,
                    total: Some(total_threads),
                    thread_name: None,
                    zip_index: Some(zip_total),
                    zip_total: Some(zip_total),
                },
            )
            .ok();

            let (thread_path, title, thread_type, participants_json, mut all_messages) =
                parse_thread_files(file_entries, &mut archives)?;

            filter_edited_duplicates(&mut all_messages);
            let stable_thread_id = &thread_path;

            app.emit(
                "import:progress",
                ImportProgress {
                    phase: "writing".into(),
                    current: threads_imported + 1,
                    total: Some(total_threads),
                    thread_name: Some(title.clone()),
                    zip_index: Some(zip_total),
                    zip_total: Some(zip_total),
                },
            )
            .ok();

            conn.execute(
                "INSERT OR REPLACE INTO threads (id, title, thread_type, participants_json, created_at) VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))",
                params![stable_thread_id, title, thread_type, participants_json],
            ).map_err(|e| e.to_string())?;

            conn.execute(
                "DELETE FROM media WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?1)",
                params![stable_thread_id],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE thread_id = ?1)",
                params![stable_thread_id],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "DELETE FROM messages WHERE thread_id = ?1",
                params![stable_thread_id],
            )
            .map_err(|e| e.to_string())?;

            let mut msg_stmt = conn.prepare_cached(
                "INSERT INTO messages (thread_id, sender_name, timestamp_ms, content, content_type, special_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
            ).map_err(|e| e.to_string())?;
            let mut media_stmt = conn.prepare_cached(
                "INSERT INTO media (message_id, media_type, relative_path, mime_type, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)"
            ).map_err(|e| e.to_string())?;
            let mut reaction_stmt = conn
                .prepare_cached(
                    "INSERT INTO reactions (message_id, actor, reaction) VALUES (?1, ?2, ?3)",
                )
                .map_err(|e| e.to_string())?;

            for m in &all_messages {
                let content = m.content.as_ref().map(|c| fix_meta_encoding(c));
                let sender_name = fix_meta_encoding(m.sender_name.as_deref().unwrap_or("Unknown"));
                let msg_type = m.msg_type.as_deref().unwrap_or("Generic");
                let special_type =
                    classify_special_message(m.content.as_deref().unwrap_or(""), m.share.is_some());

                msg_stmt
                    .execute(params![
                        stable_thread_id,
                        sender_name,
                        m.timestamp_ms.unwrap_or(0),
                        content,
                        msg_type,
                        special_type,
                    ])
                    .map_err(|e| e.to_string())?;

                let message_id: i64 = conn.last_insert_rowid();

                let media_items = collect_media_items(m);
                for (idx, media_ref) in media_items.iter().enumerate() {
                    let normalized_uri = media_ref.uri.replace('\\', "/");
                    if let Some(&(zip_idx, entry_idx)) = media_lookup.get(&normalized_uri) {
                        let archive = &mut archives[zip_idx];
                        if let Ok(mut zip_entry) = archive.by_index(entry_idx) {
                            let mut buf = Vec::new();
                            if zip_entry.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                                let ext = Path::new(&normalized_uri)
                                    .extension()
                                    .and_then(|e| e.to_str())
                                    .map(|e| format!(".{e}"))
                                    .unwrap_or_else(|| ".bin".into());
                                let filename = format!(
                                    "{}_{}_{}{}",
                                    message_id, idx, media_ref.media_type, ext
                                );
                                let out_path = media_dir.join(&filename);
                                if fs::write(&out_path, &buf).is_ok() {
                                    let mime = mime_from_ext(&normalized_uri);
                                    media_stmt
                                        .execute(params![
                                            message_id,
                                            media_ref.media_type,
                                            filename,
                                            mime,
                                            idx as i32
                                        ])
                                        .map_err(|e| e.to_string())?;
                                }
                            }
                        }
                    }
                }

                if let Some(reactions) = &m.reactions {
                    for r in reactions {
                        reaction_stmt
                            .execute(params![
                                message_id,
                                fix_meta_encoding(r.actor.as_deref().unwrap_or("")),
                                fix_meta_encoding(r.reaction.as_deref().unwrap_or("")),
                            ])
                            .map_err(|e| e.to_string())?;
                        reactions_imported += 1;
                    }
                }
                messages_imported += 1;
            }
            threads_imported += 1;
        }
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            return Err(e);
        }
    }

    Ok(ImportSummary {
        threads_imported,
        messages_imported,
        reactions_imported,
    })
}

/// Open all ZIPs, scan entries, and return message entries + all entry names + open archives.
fn scan_zips(app: &AppHandle, zip_paths: &[String]) -> Result<ScanResult, String> {
    let zip_total = zip_paths.len();
    let mut all_message_entries: Vec<ZipEntryInfo> = Vec::new();
    let mut all_entry_names: Vec<(usize, usize, String)> = Vec::new();
    let mut archives: Vec<zip::ZipArchive<fs::File>> = Vec::new();

    for (zi, zip_path) in zip_paths.iter().enumerate() {
        app.emit(
            "import:progress",
            ImportProgress {
                phase: "extracting".into(),
                current: zi + 1,
                total: Some(zip_total),
                thread_name: None,
                zip_index: Some(zi + 1),
                zip_total: Some(zip_total),
            },
        )
        .ok();

        let file =
            fs::File::open(zip_path).map_err(|e| format!("Failed to open {zip_path}: {e}"))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP {zip_path}: {e}"))?;

        for i in 0..archive.len() {
            if let Ok(entry) = archive.by_index_raw(i) {
                let name = entry.name().to_string();
                if !name.ends_with('/') {
                    if is_message_entry(&name) {
                        all_message_entries.push(ZipEntryInfo {
                            zip_index: zi,
                            entry_index: i,
                            name: name.clone(),
                            sort_num: extract_sort_num(&name),
                        });
                    }
                    all_entry_names.push((zi, i, name));
                }
            }
        }

        drop(archive);
        let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
        archives.push(zip::ZipArchive::new(file).map_err(|e| e.to_string())?);
    }

    Ok((all_message_entries, all_entry_names, archives))
}

/// Parse all message JSON files for a single thread, returning metadata + deduplicated messages.
fn parse_thread_files(
    file_entries: &[&ZipEntryInfo],
    archives: &mut [zip::ZipArchive<fs::File>],
) -> Result<(String, String, String, String, Vec<MetaMessage>), String> {
    let mut thread_path = String::new();
    let mut title = "Unknown".to_string();
    let mut thread_type = "Unknown".to_string();
    let mut participants_json = "[]".to_string();
    let mut seen_keys: HashSet<String> = HashSet::new();
    let mut all_messages: Vec<MetaMessage> = Vec::new();

    for entry_info in file_entries {
        if thread_path.is_empty() {
            thread_path = extract_thread_key(&entry_info.name);
        }

        let archive = &mut archives[entry_info.zip_index];
        let mut zip_entry = archive
            .by_index(entry_info.entry_index)
            .map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        zip_entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;

        let data: MetaMessageFile = serde_json::from_slice(&buf)
            .map_err(|e| format!("Parse error in {}: {e}", entry_info.name))?;

        if let Some(tp) = &data.thread_path {
            thread_path = tp.clone();
        }
        if let Some(t) = &data.title {
            title = fix_meta_encoding(t);
        }
        if let Some(tt) = &data.thread_type {
            thread_type = tt.clone();
        }
        if let Some(participants) = &data.participants {
            if !participants.is_empty() {
                let fixed: Vec<serde_json::Value> = participants
                    .iter()
                    .map(|p| {
                        serde_json::json!({
                            "name": fix_meta_encoding(p.name.as_deref().unwrap_or(""))
                        })
                    })
                    .collect();
                participants_json = serde_json::to_string(&fixed).unwrap_or_else(|_| "[]".into());
            }
        }
        if let Some(msgs) = &data.messages {
            for m in msgs {
                let key = format!(
                    "{}\t{}\t{}",
                    m.timestamp_ms.unwrap_or(0),
                    m.sender_name.as_deref().unwrap_or(""),
                    m.content
                        .as_deref()
                        .unwrap_or("")
                        .chars()
                        .take(100)
                        .collect::<String>()
                );
                if seen_keys.contains(&key) {
                    continue;
                }
                seen_keys.insert(key);
                all_messages.push(m.clone());
            }
        }
    }

    Ok((
        thread_path,
        title,
        thread_type,
        participants_json,
        all_messages,
    ))
}
