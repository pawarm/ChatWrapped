use std::collections::HashSet;
use std::fs;
use std::path::Path;

use super::meta_format::{extract_thread_key, is_message_entry, is_meta_messages_path};
use crate::models::ZipInspectResult;

#[tauri::command]
pub async fn inspect_zip(zip_path: String) -> Result<ZipInspectResult, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_zip_sync(&zip_path))
        .await
        .map_err(|e| e.to_string())?
}

fn inspect_zip_sync(zip_path: &str) -> Result<ZipInspectResult, String> {
    let invalid = || ZipInspectResult {
        thread_count: 0,
        message_file_count: 0,
        format: "invalid".into(),
        media_only: None,
    };

    if zip_path.is_empty() || !zip_path.to_lowercase().ends_with(".zip") {
        return Ok(invalid());
    }

    let path = Path::new(zip_path);
    if !path.exists() {
        return Ok(invalid());
    }

    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return Ok(invalid()),
    };

    let mut message_entries = Vec::new();
    let mut has_meta_structure = false;

    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index_raw(i) {
            let name = entry.name().to_string();
            if !name.ends_with('/') {
                if is_message_entry(&name) {
                    message_entries.push(name.clone());
                }
                if !has_meta_structure && is_meta_messages_path(&name) {
                    has_meta_structure = true;
                }
            }
        }
    }

    drop(archive);

    if !message_entries.is_empty() {
        let mut threads: HashSet<String> = HashSet::new();
        for name in &message_entries {
            threads.insert(extract_thread_key(name));
        }
        return Ok(ZipInspectResult {
            thread_count: threads.len(),
            message_file_count: message_entries.len(),
            format: "valid".into(),
            media_only: None,
        });
    }

    if has_meta_structure {
        return Ok(ZipInspectResult {
            thread_count: 0,
            message_file_count: 0,
            format: "valid".into(),
            media_only: Some(true),
        });
    }

    Ok(invalid())
}
