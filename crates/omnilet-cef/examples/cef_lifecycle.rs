//! T5 lifecycle proof on the CefBackend API (D18 lane; process-isolated —
//! in-process cargo test is impossible for CEF: libtest flags trip
//! Chromium's command-line CHECK, crash-witnessed 2026-10-19, SDD CEF-01).
//!
//! Run (dev loader env, CEF-03):
//!   LD_LIBRARY_PATH=$PWD/../../target/debug cargo run -p omnilet-cef --example cef_lifecycle
//! Exit 0 = boot → create → navigate → first frame → resize → destroy all green.

use omnilet_cef::CefBackend;
use omnilet_webview::{
    Bounds, NavigationPolicy, WebviewParent, WebViewBackend,
};
use std::sync::Arc;
use std::time::{Duration, Instant};

fn main() -> std::process::ExitCode {
    CefBackend::boot().expect("boot (CEF-01 order)");
    let mut backend = CefBackend::default();

    // contract surface exercised ONLY through WebViewBackend (trait-fidelity)
    let parent = WebviewParent(Arc::new(0u8)); // OSR ignores payload (documented)
    backend
        .create(parent, Bounds { x: 0, y: 0, width: 800, height: 600 })
        .expect("create");

    // security hooks armed before load (D13 cage defaults)
    backend.set_request_filter(Arc::new(|url| {
        if url.contains("blocked.example") {
            omnilet_webview::FilterVerdict::Block
        } else {
            omnilet_webview::FilterVerdict::Allow
        }
    }));
    backend.set_navigation_policy(NavigationPolicy {
        allow_windows: false,
        allow_external_navigation: false,
    });

    backend
        .navigate(
            "data:text/html,<html><body style='background:%233366cc'><h1>omnilet T5</h1></body></html>",
        )
        .expect("navigate");

    let t0 = Instant::now();
    while !backend.painted() && t0.elapsed() < Duration::from_secs(10) {
        backend.pump_drive();
        std::thread::sleep(Duration::from_millis(5));
    }
    let painted = backend.painted();

    backend
        .resize(Bounds { x: 0, y: 0, width: 1024, height: 768 })
        .expect("resize");
    backend.pump_drive();
    backend.destroy().expect("destroy");
    for _ in 0..50 {
        backend.pump_drive();
        std::thread::sleep(Duration::from_millis(2));
    }

    println!("LIFECYCLE-RESULT painted={painted}");
    if painted {
        std::process::ExitCode::SUCCESS
    } else {
        std::process::ExitCode::FAILURE
    }
}
