use regex::Regex;
use std::collections::HashSet;
use std::path::Path;
use std::sync::LazyLock;

use super::meta_format::{MetaMediaItem, MetaMessage};

// ---- Pre-compiled regexes for message classification ----

static RE_GROUP_EVENT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)named the group|added .+ to the group|added you to the group|removed .+ from the group|left the group|A contact left the group").unwrap()
});
static RE_POLL_CREATION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)created a poll:").unwrap()
});
static RE_POLL_VOTE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)voted for .+ in the poll|changed their vote to|removed their vote for").unwrap()
});
static RE_LIVE_LOCATION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)sent a live location").unwrap()
});

// ---- Special message classification ----

pub fn classify_special_message(content: &str, has_share: bool) -> Option<String> {
    if has_share {
        return Some("share".to_string());
    }
    if RE_GROUP_EVENT.is_match(content) {
        return Some("group_event".to_string());
    }
    if RE_POLL_CREATION.is_match(content) {
        return Some("poll_creation".to_string());
    }
    if RE_POLL_VOTE.is_match(content) {
        return Some("poll_vote".to_string());
    }
    if RE_LIVE_LOCATION.is_match(content) {
        return Some("live_location".to_string());
    }
    if content.ends_with(" (edited)") {
        return Some("edited".to_string());
    }
    None
}

// ---- MIME type from file extension ----

pub fn mime_from_ext(path: &str) -> Option<String> {
    let ext = Path::new(path).extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => Some("image/jpeg".into()),
        "png" => Some("image/png".into()),
        "gif" => Some("image/gif".into()),
        "webp" => Some("image/webp".into()),
        "mp4" => Some("video/mp4".into()),
        "webm" => Some("video/webm".into()),
        "mov" => Some("video/quicktime".into()),
        "mp3" => Some("audio/mpeg".into()),
        "ogg" => Some("audio/ogg".into()),
        "m4a" => Some("audio/mp4".into()),
        "wav" => Some("audio/wav".into()),
        _ => None,
    }
}

// ---- Media item collection from a message ----

pub struct MediaRef {
    pub uri: String,
    pub media_type: String,
}

fn push_items(items: &mut Vec<MediaRef>, media: &Option<Vec<MetaMediaItem>>, media_type: &str) {
    if let Some(list) = media {
        for item in list {
            if let Some(uri) = &item.uri {
                items.push(MediaRef { uri: uri.clone(), media_type: media_type.into() });
            }
        }
    }
}

pub fn collect_media_items(msg: &MetaMessage) -> Vec<MediaRef> {
    let mut items = Vec::new();
    push_items(&mut items, &msg.photos, "photo");
    push_items(&mut items, &msg.videos, "video");
    push_items(&mut items, &msg.gifs, "gif");
    push_items(&mut items, &msg.audio_files, "audio");
    push_items(&mut items, &msg.files, "file");
    if let Some(sticker) = &msg.sticker {
        if let Some(uri) = sticker.get("uri").and_then(|v| v.as_str()) {
            items.push(MediaRef { uri: uri.to_string(), media_type: "sticker".into() });
        }
    }
    items
}

// ---- Edited duplicate filter ----

pub fn filter_edited_duplicates(messages: &mut Vec<MetaMessage>) {
    if messages.is_empty() {
        return;
    }
    messages.sort_by_key(|m| m.timestamp_ms.unwrap_or(0));

    let edit_suffix = " (edited)";
    let window_ms: i64 = 60_000;
    let mut to_remove: HashSet<usize> = HashSet::new();

    for i in 0..messages.len() {
        let content = messages[i].content.as_deref().unwrap_or("");
        if content.ends_with(edit_suffix) {
            continue;
        }
        let sender = messages[i].sender_name.as_deref().unwrap_or("");
        let ts = messages[i].timestamp_ms.unwrap_or(0);

        for j in 0..messages.len() {
            if i == j {
                continue;
            }
            let other_content = messages[j].content.as_deref().unwrap_or("");
            if !other_content.ends_with(edit_suffix) {
                continue;
            }
            let other_sender = messages[j].sender_name.as_deref().unwrap_or("");
            if other_sender != sender {
                continue;
            }
            let other_ts = messages[j].timestamp_ms.unwrap_or(0);
            if (other_ts - ts).abs() > window_ms {
                continue;
            }
            let edited_content = &other_content[..other_content.len() - edit_suffix.len()];
            let min_len = content.len().min(edited_content.len());
            let prefix_len = content
                .chars()
                .zip(edited_content.chars())
                .take_while(|(a, b)| a == b)
                .count();
            if min_len >= 5 && prefix_len as f64 >= 0.5 * min_len as f64 {
                to_remove.insert(i);
                break;
            }
        }
    }

    let mut idx = 0;
    messages.retain(|_| {
        let keep = !to_remove.contains(&idx);
        idx += 1;
        keep
    });
}
