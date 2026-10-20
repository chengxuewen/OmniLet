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
use std::sync::{Arc, Mutex};
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

    // --- T6 offline serving lane ---
    let demo = std::env::temp_dir().join(format!("omnilet-demo-{}", std::process::id()));
    std::fs::create_dir_all(&demo).unwrap();
    std::fs::write(
        demo.join("index.html"),
        b"<html><body style='background:#00aa44'><h1>omnilet T6 offline</h1></body></html>",
    )
    .unwrap();
    backend.load_offline_dir(&demo).expect("load_offline_dir");
    for _ in 0..400 {
        backend.pump_drive();
        std::thread::sleep(Duration::from_millis(5));
        if backend.offline_served() > 0 {
            break;
        }
    }
    let served = backend.offline_served();
    // wait for OUR offline page (green #00aa44) to replace the data: page (blue):
    let mut green = false;
    let tg = Instant::now();
    while tg.elapsed() < Duration::from_secs(8) {
        for _ in 0..40 {
            backend.pump_drive();
            std::thread::sleep(Duration::from_millis(2));
        }
        if matches!(backend.center_pixel(), Some((0, 170, 68))) {
            green = true;
            break;
        }
    }
    let page_pixels_ok = green;
    println!("OFFLINE-CONTENT proof green={green} pixel={:?}", backend.center_pixel());
    let _ = std::fs::remove_dir_all(&demo);

    // --- T7 bridge round-trip ---
    use std::collections::HashMap;
    use std::sync::atomic::AtomicUsize;
    let store = Arc::new(Mutex::new(HashMap::<String, String>::new()));
    let hits = Arc::new(AtomicUsize::new(0));

    // (register handlers BEFORE the JS round-trip)
    let (h1, s1) = (hits.clone(), store.clone());
    backend.register_bridge(
        "omnilet.storage.set",
        Box::new(move |req| {
            let kv: (String, String) = serde_json::from_str(&req.payload).unwrap_or_default();
            s1.lock().unwrap().insert(kv.0, kv.1);
            h1.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            // set has no responder expectation; still answer OK
        }),
    )
    .expect("register set bridge");

    let (h2, s2) = (hits.clone(), store.clone());
    backend.register_bridge(
        "omnilet.storage.get",
        Box::new(move |req| {
            let v = s2.lock().unwrap().get(&req.payload).cloned();
            h2.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            req.responder.respond(Ok(v.unwrap_or_else(|| "null".into())));
        }),
    )
    .expect("register get bridge");

    backend.eval(omnilet_cef::BOOTSTRAP_JS).expect("bootstrap eval");
    backend.pump_drive();
    // NOTE T7 (SDD CEF-07): frame-execute dispatch is non-functional in this
    // build combo (headless OSR); the bridge round-trip below is EXPECTED-BLOCKED
    // (hits stay 0) until the process-message protocol lane lands. Kept as the
    // acceptance shape for that lane — do not read green here as bridge health.
    // set k=v from the page
    backend
        .eval("omnilet.storage.set('user','张三')")
        .expect("eval set");
    // get with onSuccess that SETS AGAIN (proves the browser->render answer
    // actually ran the JS callback: third native hit closes the loop)
    backend
        .eval("omnilet.storage.get('user', function(v){ omnilet.storage.set('echoed', v); })")
        .expect("eval get");

    let t1 = Instant::now();
    let echoed = loop {
        for _ in 0..50 {
            backend.pump_drive();
            std::thread::sleep(Duration::from_millis(2));
        }
        let snapshot = store.lock().unwrap().clone();
        if snapshot.contains_key("echoed") {
            break snapshot;
        }
        if t1.elapsed() > Duration::from_secs(10) {
            break snapshot;
        }
    };
    let bridge_hits = hits.load(std::sync::atomic::Ordering::Relaxed);

    backend
        .resize(Bounds { x: 0, y: 0, width: 1024, height: 768 })
        .expect("resize");
    backend.pump_drive();
    backend.destroy().expect("destroy");
    for _ in 0..50 {
        backend.pump_drive();
        std::thread::sleep(Duration::from_millis(2));
    }

    let echoed = echoed.contains_key("echoed") && echoed.get("user").map(|v| v == "张三").unwrap_or(false);
    println!(
        "LIFECYCLE-RESULT painted={painted} offline_served={served} page_pixels={page_pixels_ok} bridge_hits={bridge_hits} echo_roundtrip={echoed}"
    );
    if painted && served > 0 && page_pixels_ok && green {
        std::process::ExitCode::SUCCESS
    } else {
        std::process::ExitCode::FAILURE
    }
}
