use serde::Serialize;

// ---- Database query response types ----

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub thread_count: i64,
    pub message_count: i64,
    pub reaction_count: i64,
    pub word_count: i64,
    pub first_message_at: Option<i64>,
    pub last_message_at: Option<i64>,
}

#[derive(Serialize)]
pub struct Thread {
    pub id: String,
    pub title: String,
    pub thread_type: String,
    pub participants_json: String,
    pub message_count: i64,
    pub last_message_at: Option<i64>,
}

#[derive(Serialize)]
pub struct MediaItem {
    pub id: i64,
    pub media_type: String,
    pub relative_path: String,
    pub mime_type: Option<String>,
}

#[derive(Serialize)]
pub struct Reaction {
    pub actor: String,
    pub reaction: String,
}

#[derive(Serialize)]
pub struct Message {
    pub id: i64,
    pub thread_id: String,
    pub sender_name: String,
    pub timestamp_ms: i64,
    pub content: Option<String>,
    pub content_type: Option<String>,
    pub special_type: Option<String>,
    pub reactions: Option<Vec<Reaction>>,
    pub media: Option<Vec<MediaItem>>,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub id: i64,
    pub thread_id: String,
    pub thread_title: String,
    pub sender_name: String,
    pub timestamp_ms: i64,
    pub content: Option<String>,
    pub snippet: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistogramResult {
    pub min_timestamp_ms: i64,
    pub max_timestamp_ms: i64,
    pub buckets: Vec<HistogramBucket>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistogramBucket {
    pub bin_index: i64,
    pub count: i64,
}

// ---- Import response types ----

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub phase: String,
    pub current: usize,
    pub total: Option<usize>,
    pub thread_name: Option<String>,
    pub zip_index: Option<usize>,
    pub zip_total: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub threads_imported: usize,
    pub messages_imported: usize,
    pub reactions_imported: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipInspectResult {
    pub thread_count: usize,
    pub message_file_count: usize,
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_only: Option<bool>,
}
