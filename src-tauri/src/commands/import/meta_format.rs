use regex::Regex;
use std::sync::LazyLock;

// ---- Pre-compiled regexes for path matching ----

pub static RE_INBOX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)messages[/\\]inbox[/\\][^/\\]+[/\\]message_\d+\.json$").unwrap()
});
pub static RE_ENCRYPTED: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)messages[/\\]encrypted[/\\][^/\\]+[/\\]message_\d+\.json$").unwrap()
});
pub static RE_E2EE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)messages[/\\]e2ee_cutover[/\\][^/\\]+[/\\]message_\d+\.json$").unwrap()
});
pub static RE_SORT_NUM: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"message_(\d+)\.json$").unwrap()
});

// ---- Meta export JSON deserialization types ----

#[derive(serde::Deserialize)]
pub struct MetaMessageFile {
    pub participants: Option<Vec<MetaParticipant>>,
    pub messages: Option<Vec<MetaMessage>>,
    pub title: Option<String>,
    pub thread_type: Option<String>,
    pub thread_path: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct MetaParticipant {
    pub name: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
pub struct MetaMessage {
    pub sender_name: Option<String>,
    pub timestamp_ms: Option<i64>,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub share: Option<serde_json::Value>,
    pub reactions: Option<Vec<MetaReaction>>,
    pub photos: Option<Vec<MetaMediaItem>>,
    pub videos: Option<Vec<MetaMediaItem>>,
    pub gifs: Option<Vec<MetaMediaItem>>,
    pub audio_files: Option<Vec<MetaMediaItem>>,
    pub files: Option<Vec<MetaMediaItem>>,
    pub sticker: Option<serde_json::Value>,
}

#[derive(serde::Deserialize, Clone)]
pub struct MetaReaction {
    pub reaction: Option<String>,
    pub actor: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
pub struct MetaMediaItem {
    pub uri: Option<String>,
}

// ---- Path matching helpers ----

pub fn is_message_entry(name: &str) -> bool {
    RE_INBOX.is_match(name) || RE_ENCRYPTED.is_match(name) || RE_E2EE.is_match(name)
}

pub fn is_meta_messages_path(name: &str) -> bool {
    let n = name.replace('\\', "/");
    n.contains("messages/inbox/")
        || n.contains("messages/e2ee_cutover/")
        || n.contains("messages/encrypted/")
}

pub fn extract_thread_key(entry_name: &str) -> String {
    let normalized = entry_name.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').collect();
    let thread_folder = if parts.len() >= 2 {
        parts[parts.len() - 2]
    } else {
        "unknown"
    };
    let parent = if normalized.contains("inbox/") {
        "inbox"
    } else if normalized.contains("encrypted/") {
        "encrypted"
    } else if normalized.contains("e2ee_cutover/") {
        "e2ee_cutover"
    } else {
        "unknown"
    };
    format!("{parent}/{thread_folder}")
}

pub fn extract_sort_num(name: &str) -> i32 {
    RE_SORT_NUM
        .captures(name)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .unwrap_or(0)
}
