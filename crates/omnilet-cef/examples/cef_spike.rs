//! T2 spike (cef-backend plan): software-OSR first-frame proof on THIS host
//! (Ubuntu 20.04 / D18 line). Throwaway probe, not product surface — the
//! windowed/pump designs land in src/cef/ afterwards.
//!
//! Proof: init CEF windowless → create data: page → pump message loop →
//! on_paint delivers a BGRA buffer → sample non-black pixels → shutdown.
//! Exit 0 = frame received with painted pixels (first-frame claim green).

use cef::*;
use cef::sys;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::sleep;
use std::time::{Duration, Instant};

#[derive(Clone, Default)]
struct FrameSink {
    painted: Arc<Mutex<bool>>,
    nonblack: Arc<AtomicUsize>,
}

wrap_render_handler! {
    struct SpikeRhBuilder {
        sink: FrameSink,
    }

    impl RenderHandler {
        fn view_rect(&self, _browser: Option<&mut Browser>, rect: Option<&mut Rect>) {
            if let Some(r) = rect {
                r.width = 800;
                r.height = 600;
            }
        }

        fn on_paint(
            &self,
            _browser: Option<&mut Browser>,
            _type_: PaintElementType,
            _dirty_rects: Option<&[Rect]>,
            buffer: *const u8,
            width: ::std::os::raw::c_int,
            height: ::std::os::raw::c_int,
        ) {
            let len = (width.max(0) * height.max(0) * 4) as usize;
            if buffer.is_null() || len == 0 {
                return;
            }
            let bytes = unsafe { std::slice::from_raw_parts(buffer, len) };
            // stride sample: any channel meaningfully above black?
            let nz = bytes.iter().step_by(997).filter(|v| **v > 8).count();
            self.sink.nonblack.fetch_add(nz, Ordering::Relaxed);
            *self.sink.painted.lock().unwrap() = true;
        }
    }
}

wrap_client! {
    struct SpikeClientBuilder {
        render_handler: RenderHandler,
    }

    impl Client {
        fn render_handler(&self) -> Option<RenderHandler> {
            Some(self.render_handler.clone())
        }
    }
}

wrap_app! {
    struct SpikeAppBuilder {}

    impl App {
        fn on_before_command_line_processing(
            &self,
            _process_type: Option<&cef::CefStringUtf16>,
            command_line: Option<&mut CommandLine>,
        ) {
            // headless Ozone: no X server needed (product lane candidate for
            // server-side; xvfb-run remains fallback, SDD note)
            if let Some(cl) = command_line {
                cl.append_switch(Some(&"headless=new".into()));
                cl.append_switch_with_value(Some(&"ozone-platform".into()), Some(&"headless".into()));
            }
        }
    }
}

fn main() -> std::process::ExitCode {
    // Linux: libcef.so via loader env (SDD: rpath $ORIGIN productization).
    // ORDER LEARNING (crash-witnessed twice today): cef_command_line_create
    // BEFORE execute_process returns null -> immediate_crash (Chromium context
    // not yet initialized). execute_process first; never touch cmd-line objects before it.
    // API version handshake (osr example line, easy to miss): initializes
    // libcef_dll's context; without it CEF-side wrappers crash with
    // invalid-version (crash-witnessed today, SDD evidence)
    let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);

    let args = cef::args::Args::new();
    // app must exist BEFORE execute_process (osr example order; passing None
    // there trips CefApp_CToCpp invalid-version on 154/Linux — crash-witnessed)
    let mut app = SpikeAppBuilder::new();
    let ret = execute_process(Some(args.as_main_args()), Some(&mut app), std::ptr::null_mut());
    if ret != -1 {
        // non-browser child (renderer/gpu): CEF owns its exit
        std::process::exit(ret.max(0));
    }
    // example binary lives in target/debug/examples/ but CEF resources landed
    // in target/debug/ -> point paths explicitly (product binaries sit beside
    // resources; dev-only quirk, SDD note)
    let dbg = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/debug");
    let dbg = dbg.canonicalize().unwrap_or(dbg);
    let locale = dbg.join("locales");
    let settings = Settings {
        windowless_rendering_enabled: true as _,
        external_message_pump: true as _, // we drive the pump (osr-proven shape)
        no_sandbox: true as _, // cef-rs default posture (SDD stance, D18)
        resources_dir_path: CefString::from(dbg.display().to_string().as_str()),
        locales_dir_path: CefString::from(locale.display().to_string().as_str()),
        log_severity: cef::LogSeverity::INFO,
        ..Default::default()
    };
    let ok = initialize(
        Some(args.as_main_args()),
        Some(&settings),
        Some(&mut app),
        std::ptr::null_mut(),
    );
    assert_eq!(ok, 1, "cef initialize must succeed");

    let sink = FrameSink::default();
    let browser = browser_host_create_browser_sync(
        Some(&WindowInfo {
            windowless_rendering_enabled: true as _,
            ..Default::default()
        }),
        Some(&mut SpikeClientBuilder::new(SpikeRhBuilder::new(sink.clone()))),
        Some(&"data:text/html,<html><body style='background:%233366cc'><h1>omnilet T2</h1></body></html>".into()),
        Some(&BrowserSettings {
            windowless_frame_rate: 60,
            ..Default::default()
        }),
        None,
        None,
    );
    assert!(browser.is_some(), "sync browser create (windowless)");

    // external pump on this thread (product path = winit fusion in pump.rs)
    let t0 = Instant::now();
    loop {
        do_message_loop_work();
        if *sink.painted.lock().unwrap() || t0.elapsed() > Duration::from_secs(10) {
            break;
        }
        sleep(Duration::from_millis(5));
    }
    // drain a few more frames' worth of work for paint completion
    for _ in 0..20 {
        do_message_loop_work();
        sleep(Duration::from_millis(2));
    }

    shutdown();
    for _ in 0..200 {
        do_message_loop_work();
        sleep(Duration::from_millis(1));
    }

    let painted = *sink.painted.lock().unwrap();
    let nz = sink.nonblack.load(Ordering::Relaxed);
    println!("SPIKE-RESULT painted={painted} nonblack_samples={nz}");
    if painted && nz > 10 {
        std::process::ExitCode::SUCCESS
    } else {
        std::process::ExitCode::FAILURE
    }
}
