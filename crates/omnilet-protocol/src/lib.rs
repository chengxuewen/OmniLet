//! omnilet:// custom-protocol URL ↔ offline-dir file mapping (PURE logic — no webview;
//! the wry protocol handler calls into this; unit-tested with traversal attacks per
//! the schema-test lesson: attacks are real, test them).

use std::path::{Path, PathBuf};

#[derive(Debug, PartialEq)]
pub enum Resolved {
    /// Resolved file inside the offline dir (guaranteed contained — traversal-proof).
    File(PathBuf),
    /// Not found (caller answers 404-shaped + logs, per audit-log seed).
    Miss,
}

/// Map an `omnilet://` request path (the part after `omnilet://app/`) to a file
/// inside `offline_dir`. Path-traversal-proof: `..` segments and absolute escapes
/// can never resolve outside the dir (defense in depth — the manifest schema also
/// rejects such paths at package-authoring time; this is the runtime choke point).
pub fn resolve(offline_dir: &Path, request_path: &str) -> Resolved {
    // Reject absolute shapes outright.
    if request_path.starts_with('/') || request_path.contains('\\') {
        return Resolved::Miss;
    }
    // Reject any dot-segment (`.` / `..`) — walk it manually, never join raw.
    let mut clean = PathBuf::from(offline_dir);
    for seg in request_path.split('/') {
        match seg {
            "" | "." => continue, // tolerate harmless no-ops like `a//b` or `./a`
            ".." => return Resolved::Miss,
            _ => clean.push(seg),
    }
    }
    // Containment double-check (defense in depth): final path must still prefix-match.
    if !clean.starts_with(offline_dir) {
        return Resolved::Miss;
    }
    match std::fs::metadata(&clean) {
        Ok(m) if m.is_file() => Resolved::File(clean),
        _ => Resolved::Miss,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn fixture_dir(name: &str) -> PathBuf {
        // unique per test name — tests run in parallel within one process id;
        // a shared dir would let one test's cleanup pull the rug of another
        let dir = std::env::temp_dir().join(format!("omnilet-proto-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("pages")).unwrap();
        fs::write(dir.join("index.html"), "<html></html>").unwrap();
        fs::write(dir.join("pages/app.js"), "console.log(1)").unwrap();
        dir
    }

    #[test]
    fn maps_normal_paths() {
        let dir = fixture_dir("normal");
        assert_eq!(resolve(&dir, "index.html"), Resolved::File(dir.join("index.html")));
        assert_eq!(
            resolve(&dir, "pages/app.js"),
            Resolved::File(dir.join("pages/app.js"))
        );
        assert_eq!(resolve(&dir, "./index.html"), Resolved::File(dir.join("index.html")));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn misses_on_absent_files() {
        let dir = fixture_dir("miss");
        assert_eq!(resolve(&dir, "nope.js"), Resolved::Miss);
        assert_eq!(resolve(&dir, "pages/nope.js"), Resolved::Miss);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_traversal_attacks() {
        let dir = fixture_dir("traversal");
        let secret = std::env::temp_dir().join(format!("omnilet-secret-outside-{}.txt", std::process::id()));
        fs::write(&secret, "outside").unwrap();

        for attack in [
            "../omnilet-secret-outside.txt",
            "pages/../../omnilet-secret-outside.txt",
            "..%2Fomnilet-secret-outside.txt",
            "/etc/passwd",
            "\\windows\\system32",
            "a/../b.js",
        ] {
            let r = resolve(&dir, attack);
            if let Resolved::File(f) = &r {
                panic!("TRAVERSAL LEAK: {attack} resolved to {}", f.display());
            }
        }
        // the outside secret is NOT reachable through any of the above
        assert_eq!(resolve(&dir, "../omnilet-secret-outside.txt"), Resolved::Miss);
        fs::remove_dir_all(&dir).unwrap();
        let _ = fs::remove_file(&secret);
    }

    #[test]
    fn never_escapes_even_with_encoded_or_dot_segments() {
        let dir = fixture_dir("encoded");
        // percent-encoding is NOT decoded here (the WebView decodes before us if it
        // chooses; our contract: input is the raw path — encoded dots stay a filename
        // that simply won't exist → Miss, never an escape).
        assert_eq!(resolve(&dir, "%2e%2e/index.html"), Resolved::Miss);
        fs::remove_dir_all(&dir).unwrap();
    }
}
