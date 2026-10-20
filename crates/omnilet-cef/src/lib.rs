//! omnilet-cef — the CefBackend `WebViewBackend` implementation (D18/D16 Linux
//! final form). Boot contract CEF-01..05 distilled from the 2026-10-19 spike
//! (crash-witnessed, SDD.md). OSR software path first (no X dependency);
//! the real-window attachment variant is the winmac lane's concern.

use cef::args::Args;
use cef::*;
use omnilet_webview::{
    Bounds, BridgeHandler, NavigationPolicy, RequestFilter, WebviewError, WebviewEvent, WebviewParent,
    WebViewBackend,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

/// Process boot state. The App object must outlive CEF (its vtable is
/// referenced by the C side after initialize — lifetime rule CEF-01):
/// intentionally leaked into &'static mut at boot (CEF-01 addendum).
static BOOT: OnceLock<()> = OnceLock::new();

/// CEF Browser/Host handles are documented callable from any thread
/// (internally forward to the UI thread) — hence Send is safe here.
/// Thread-CAVEAT (CEF-01): pump_drive must run on the SAME thread that
/// booted (external message pump contract); the container core pumps on
/// the main thread (invariant ④), so this holds by construction.
struct SendBrowser(Browser);
// SAFETY: CEF threading model guarantees CefBrowser method thread-safety.
unsafe impl Send for SendBrowser {}

#[derive(Clone)]
struct AppCore;

wrap_app! {
    struct EngineApp {
        core: AppCore,
    }

    impl App {
        fn on_before_command_line_processing(
            &self,
            _process_type: Option<&cef::CefStringUtf16>,
            command_line: Option<&mut CommandLine>,
        ) {
            // CEF-02 headless launch contract (both switches required)
            if let Some(cl) = command_line {
                cl.append_switch(Some(&"headless=new".into()));
                cl.append_switch_with_value(
                    Some(&"ozone-platform".into()),
                    Some(&"headless".into()),
                );
            }
        }
    }
}

/// OSR frame sink: view_rect reports current bounds; painted flag proves
/// the pipeline lives (T2 mechanism, promoted from spike).
#[derive(Clone)]
struct FrameSink {
    bounds: Arc<Mutex<(i32, i32)>>,
    painted: Arc<AtomicBool>,
}

wrap_render_handler! {
    struct FrameSinkHolder {
        sink: FrameSink,
    }

    impl RenderHandler {
        fn view_rect(&self, _browser: Option<&mut Browser>, rect: Option<&mut Rect>) {
            let (w, h) = *self.sink.bounds.lock().unwrap();
            if let Some(r) = rect {
                r.width = w;
                r.height = h;
            }
        }

        fn on_paint(
            &self,
            _browser: Option<&mut Browser>,
            _type_: PaintElementType,
            _dirty_rects: Option<&[Rect]>,
            _buffer: *const u8,
            _width: ::std::os::raw::c_int,
            _height: ::std::os::raw::c_int,
        ) {
            self.sink.painted.store(true, Ordering::Relaxed);
            // pixel-content checks are the golden-test harness (later T lane);
            // this lane records "a frame arrived" only
        }
    }
}

wrap_client! {
    struct EngineClient {
        render_handler: RenderHandler,
    }

    impl Client {
        fn render_handler(&self) -> Option<RenderHandler> {
            Some(self.render_handler.clone())
        }
        // window_filter / context handlers: T8 (cage), T6 (scheme) land here
    }
}

/// The Linux standard-mode backend (D16 final form).
pub struct CefBackend {
    browser: Option<SendBrowser>,
    bounds: Arc<Mutex<(i32, i32)>>,
    painted: Arc<AtomicBool>,
    offline_dir: Option<std::path::PathBuf>,
    bridges: Vec<(String, BridgeHandler)>, // consumed T7 (message_router adapter)
    filter: Option<RequestFilter>,         // consumed T8
    policy: NavigationPolicy,              // consumed T8
    event_cb: Option<Box<dyn Fn(WebviewEvent) + Send>>, // consumed T7/T8
}

impl CefBackend {
    /// Process-level boot (call once before the first `create`). Order is the
    /// CEF-01 contract; the returned guard marks the process as booted.
    pub fn boot() -> Result<(), WebviewError> {
        BOOT.get_or_init(|| {
            // CEF-01 order, each step crash-witnessed 2026-10-19:
            let _ = api_hash(sys::CEF_API_VERSION_LAST, 0);
            let args = Args::new();
            let app: &mut App = Box::leak(Box::new(EngineApp::new(AppCore {})));
            let ret = execute_process(Some(args.as_main_args()), Some(app), std::ptr::null_mut());
            if ret != -1 {
                // non-browser child (renderer/gpu): CEF owns its exit
                std::process::exit(ret.max(0));
            }
            // dev resource location (target/debug beside the build);
            // productization = CEF-03 (rpath $ORIGIN at the packaging lane)
            let dbg = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/debug");
            let dbg = dbg.canonicalize().unwrap_or(dbg);
            let locales = dbg.join("locales");
            let settings = Settings {
                windowless_rendering_enabled: true as _,
                external_message_pump: true as _,
                no_sandbox: true as _, // CEF-05 security stance (omnilet layer owns promises)
                resources_dir_path: CefString::from(dbg.display().to_string().as_str()),
                locales_dir_path: CefString::from(locales.display().to_string().as_str()),
                ..Default::default()
            };
            let ok = initialize(
                Some(args.as_main_args()),
                Some(&settings),
                Some(app),
                std::ptr::null_mut(),
            );
            assert_eq!(ok, 1, "cef initialize failed (see CEF logs)");
        });
        Ok(())
    }

    /// Whether any OSR frame has arrived (T5 verification surface).
    pub fn painted(&self) -> bool {
        self.painted.load(std::sync::atomic::Ordering::Relaxed)
    }

    fn host(&self) -> Result<BrowserHost, WebviewError> {
        self.browser
            .as_ref()
            .and_then(|b| b.0.host())
            .ok_or(WebviewError::Lifecycle("no live browser (create first)".into()))
    }

    fn frame(&self) -> Result<Frame, WebviewError> {
        self.browser
            .as_ref()
            .and_then(|b| b.0.main_frame())
            .ok_or(WebviewError::Lifecycle("no main frame".into()))
    }
}

impl Default for CefBackend {
    fn default() -> Self {
        Self {
            browser: None,
            bounds: Arc::new(Mutex::new((0, 0))),
            painted: Arc::new(AtomicBool::new(false)),
            offline_dir: None,
            bridges: Vec::new(),
            filter: None,
            policy: NavigationPolicy::default(),
            event_cb: None,
        }
    }
}

impl WebViewBackend for CefBackend {
    fn create(&mut self, _parent: WebviewParent, bounds: Bounds) -> Result<(), WebviewError> {
        if self.browser.is_some() {
            return Err(WebviewError::Lifecycle("already created".into()));
        }
        let size = (bounds.width as i32, bounds.height as i32);
        *self.bounds.lock().unwrap() = size;
        let sink = FrameSink {
            bounds: self.bounds.clone(),
            painted: self.painted.clone(),
        };
        let browser = browser_host_create_browser_sync(
            Some(&WindowInfo {
                windowless_rendering_enabled: true as _,
                ..Default::default()
            }),
            Some(&mut EngineClient::new(FrameSinkHolder::new(sink))),
            // about:blank first; navigate()/load_offline_dir() own content
            Some(&"about:blank".into()),
            Some(&BrowserSettings {
                windowless_frame_rate: 60,
                ..Default::default()
            }),
            None,
            None,
        )
        .ok_or_else(|| WebviewError::Lifecycle("browser create returned null".into()))?;
        self.browser = Some(SendBrowser(browser));
        Ok(())
    }

    fn resize(&mut self, bounds: Bounds) -> Result<(), WebviewError> {
        *self.bounds.lock().unwrap() = (bounds.width as i32, bounds.height as i32);
        // OSR resize = view_rect reports new size, invalidate asks a frame
        // (osr-example mechanism; no set_window_bounds in cef-rs 154 — verified)
        self.host()?.invalidate(PaintElementType::VIEW);
        Ok(())
    }

    fn destroy(&mut self) -> Result<(), WebviewError> {
        if let Some(SendBrowser(b)) = self.browser.take()
            && let Some(h) = b.host()
        {
            h.close_browser(1); // force-close (CEF-05: single-omnilet process model)
        }
        Ok(())
    }

    fn navigate(&mut self, url: &str) -> Result<(), WebviewError> {
        let url = CefString::from(url);
        self.frame()?.load_url(Some(&url));
        Ok(())
    }

    fn load_offline_dir(&mut self, dir: &std::path::Path) -> Result<(), WebviewError> {
        self.offline_dir = Some(dir.to_path_buf());
        // scheme handler omnilet:// lands T6 (SDD resource.rs); until then the
        // directory is remembered, not served (honest pending, no fake Ok)
        Err(WebviewError::Navigate("omnilet:// scheme handler pending (T6)".into()))
    }

    fn eval(&mut self, script: &str) -> Result<String, WebviewError> {
        // fire-and-forget now; result-callback channel is T7's bridge work
        let code = CefString::from(script);
        let url = CefString::from("omnilet://eval");
        self.frame()?
            .execute_java_script(Some(&code), Some(&url), 0);
        Ok("null".into())
    }

    fn register_bridge(&mut self, name: &str, handler: BridgeHandler) -> Result<(), WebviewError> {
        self.bridges.push((name.to_string(), handler));
        Err(WebviewError::Lifecycle(
            "message_router bridge pending (T7)".into(),
        ))
    }

    fn on_event(&mut self, callback: Box<dyn Fn(WebviewEvent) + Send>) {
        self.event_cb = Some(callback);
    }

    fn set_request_filter(&mut self, filter: RequestFilter) {
        self.filter = Some(filter); // consumed by handler lane (T8)
    }

    fn set_navigation_policy(&mut self, policy: NavigationPolicy) {
        self.policy = policy; // consumed by handler lane (T8)
    }

    fn pump_drive(&mut self) -> bool {
        do_message_loop_work();
        true
    }

    fn pump_timeout(&self) -> Option<std::time::Duration> {
        // 60Hz pump pacing (spike-measured 1000/17 pattern from osr example)
        Some(std::time::Duration::from_millis(16))
    }
}
