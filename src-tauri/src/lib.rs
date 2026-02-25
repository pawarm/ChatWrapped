mod commands;
mod db;
mod encoding;
mod media;
mod models;

use db::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState::new())
        .invoke_handler(tauri::generate_handler![
            commands::db::get_media_url,
            commands::db::get_stats,
            commands::db::get_storage_size,
            commands::db::clear_all_data,
            commands::db::get_threads,
            commands::db::get_messages,
            commands::db::get_messages_after,
            commands::db::get_messages_around_timestamp,
            commands::db::get_messages_around_date,
            commands::db::get_message_histogram,
            commands::db::search_messages,
            commands::import::inspect::inspect_zip,
            commands::import::pipeline::import_zip,
            commands::import::pipeline::import_zips,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
