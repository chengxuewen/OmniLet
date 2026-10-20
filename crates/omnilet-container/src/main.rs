//! omnilet-container — the OmniLet host binary (standard mode).
//!
//! Skeleton gate for now: argument validation + honest version of the
//! dev-shell contract (docs/devtools-spec.md §1, D9-1: load-unpacked dir +
//! watch + CDP — window/WebView wiring lands with renderer.rs in this
//! crate's next task).
//!
//! Engine lane: D18/D16 — Linux standard mode is CefBackend (cef_engine),
//! no webkit2gtk dependency at all; wry belongs to the future winmac slice.

fn main() {
    std::process::exit(run(std::env::args().collect()));
}

fn run(args: Vec<String>) -> i32 {
    match args.get(1).map(String::as_str) {
        Some("--help" | "-h") => {
            println!(
                "omnilet-container [options]\n\
                 \x20 --dir <path>   load an unpacked mini-app directory (dev shell, D9-1)\n\
                 \x20 --help         this message\n\
                 (window + WebView runtime wiring lands with renderer.rs — container-core-wry Phase 4)"
            );
            0
        }
        Some("--dir") => match args.get(2) {
            Some(dir) => match std::fs::metadata(dir) {
                Ok(m) if m.is_dir() => {
                    // fail-fast on missing manifest (boot order, D8-5 rehearsal)
                    if !std::path::Path::new(dir).join("manifest.json").exists() {
                        eprintln!("error: {dir}: no manifest.json (offline package must carry one; fail-closed D8-1)");
                        return 1;
                    }
                    eprintln!("error: renderer wiring not implemented (container-core-wry Phase 4) — manifest found, would load");
                    2
                }
                _ => {
                    eprintln!("error: --dir expects an existing directory");
                    1
                }
            },
            None => {
                eprintln!("error: --dir expects a path");
                1
            }
        },
        Some(other) => {
            eprintln!("error: unknown arg {other:?} (try --help)");
            1
        }
        None => {
            eprintln!("error: no mode given (try --help; --dir <path> is the dev-shell mode)");
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::run;

    fn argv(a: &str, b: Option<&str>) -> Vec<String> {
        let mut v = vec!["omnilet-container".to_string(), a.to_string()];
        if let Some(x) = b {
            v.push(x.to_string());
        }
        v
    }

    #[test]
    fn help_exits_zero() {
        assert_eq!(run(argv("--help", None)), 0);
    }

    #[test]
    fn missing_dir_and_unknown_args_fail() {
        assert_eq!(run(argv("--dir", Some("/nonexistent-omnilet-test-dir"))), 1);
        assert_eq!(run(argv("--wat", None)), 1);
        assert_eq!(run(vec!["omnilet-container".to_string()]), 1);
    }

    #[test]
    fn existing_dir_without_manifest_fails_closed() {
        let dir = std::env::temp_dir().join(format!("omnilet-cli-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        // dir exists, no manifest.json -> D8-1 fail-closed path, rc 1
        assert_eq!(run(argv("--dir", Some(dir.to_str().unwrap()))), 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
