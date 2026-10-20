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

use omnilet_webview::{Bounds, WebViewBackend};

fn run(args: Vec<String>) -> i32 {
    // CEF-01 ordering (live-caught): engine boot (execute_process) runs BEFORE
    // any CLI parsing — CEF relaunches this binary with --type=zygote/utility
    // children that must not be judged by the flag parser below.
    if let Err(e) = omnilet_cef::CefBackend::boot() {
        eprintln!("error: engine boot failed: {e}");
        return 1;
    }
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
                    load_headless(std::path::Path::new(dir))
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

/// Headless load-and-prove lane (B0 full window form lands with the CEF-07
/// bridge/texture work — this is its CI-usable predecessor): boot, create
/// OSR backend, load the offline dir, pump to proof, report.
fn load_headless(dir: &std::path::Path) -> i32 {
    let mut backend = omnilet_cef::CefBackend::default();
    let parent = omnilet_webview::WebviewParent(std::sync::Arc::new(0u8));
    if backend
        .create(parent, Bounds { x: 0, y: 0, width: 1024, height: 768 })
        .is_err()
    {
        eprintln!("error: backend create failed");
        return 1;
    }
    if backend.load_offline_dir(dir).is_err() {
        eprintln!("error: offline load failed");
        backend.destroy().ok();
        return 1;
    }
    let start = std::time::Instant::now();
    let ok = loop {
        backend.pump_drive();
        std::thread::sleep(std::time::Duration::from_millis(5));
        if backend.painted() && backend.offline_served() > 0 {
            break true;
        }
        if start.elapsed() > std::time::Duration::from_secs(10) {
            break false;
        }
    };
    backend.destroy().ok();
    if ok {
        println!("LOADED {dir:?} painted served={}", backend.offline_served());
        0
    } else {
        eprintln!("error: offline load did not paint within 10s");
        1
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
