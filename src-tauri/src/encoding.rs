/// Fix Meta's encoding: they JSON-escape UTF-8 bytes as \u00XX, so JSON.parse produces
/// mojibake (Polish chars like Å›, emojis like ðº). Reinterpret code points as Latin-1 bytes
/// and decode as UTF-8.
pub fn fix_meta_encoding(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }

    let has_mojibake = s.chars().any(|c| {
        let cp = c as u32;
        (0xC0..=0xFF).contains(&cp)
    }) && s.chars().any(|c| {
        let cp = c as u32;
        (0x80..=0xBF).contains(&cp)
    });

    if !has_mojibake {
        return s.to_string();
    }

    let bytes: Vec<u8> = s.chars().map(|c| c as u8).collect();
    String::from_utf8(bytes).unwrap_or_else(|_| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plain_ascii() {
        assert_eq!(fix_meta_encoding("hello"), "hello");
    }

    #[test]
    fn test_empty() {
        assert_eq!(fix_meta_encoding(""), "");
    }
}
