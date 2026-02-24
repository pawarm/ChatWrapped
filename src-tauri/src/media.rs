use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

use crate::db::get_db_path;

pub fn get_media_dir(app: &AppHandle) -> PathBuf {
    let app_data = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    app_data.join("media")
}

pub fn ensure_media_dir(app: &AppHandle) {
    let dir = get_media_dir(app);
    fs::create_dir_all(&dir).ok();
}

pub fn clear_media_storage(app: &AppHandle) {
    let dir = get_media_dir(app);
    if dir.exists() {
        fs::remove_dir_all(&dir).ok();
    }
}

pub fn get_storage_size_bytes(app: &AppHandle) -> u64 {
    let db_path = get_db_path(app);
    let media_dir = get_media_dir(app);
    let mut total: u64 = 0;

    if db_path.exists() {
        if let Ok(meta) = fs::metadata(&db_path) {
            total += meta.len();
        }
    }

    if media_dir.exists() {
        for entry in WalkDir::new(&media_dir).into_iter().flatten() {
            if entry.file_type().is_file() {
                if let Ok(meta) = entry.metadata() {
                    total += meta.len();
                }
            }
        }
    }

    total
}
