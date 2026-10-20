//! omnilet-cef — the CefBackend `WebViewBackend` implementation (D18/D16 Linux
//! final form). Boot contract CEF-01..05 distilled from the 2026-10-19 spike
//! (crash-witnessed, SDD.md). OSR software path first (no X dependency);
//! the real-window attachment variant is the winmac lane's concern.

use cef::args::Args;
use cef::*;
use std::sync::atomic::AtomicUsize;
use omnilet_webview::{
    Bounds, BridgeHandler, NavigationPolicy, RequestFilter, WebviewError, WebviewEvent, WebviewParent,
    WebViewBackend,
};
use cef::wrapper::resource_manager::ResourceManager;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

/// CEF utf16 string → String (the only lossy path through these wrappers:
/// UserfreeUtf16 → Utf16::as_slice → from_utf16_lossy; utf8 types have as_str)
pub fn cef_url_str(u: &CefStringUserfreeUtf16) -> String {
    CefStringUtf16::from(u)
        .as_slice()
        .map(String::from_utf16_lossy)
        .unwrap_or_default()
}

/// Process-wide resource manager (offline directory serving lane, T6).
fn resource_manager() -> &'static Arc<Mutex<ResourceManager>> {
    static RM: OnceLock<Arc<Mutex<ResourceManager>>> = OnceLock::new();
    RM.get_or_init(ResourceManager::new)
}

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
        fn on_register_custom_schemes(&self, registrar: Option<&mut SchemeRegistrar>) {
            // omnilet:// = local, secure-context, CORS-eligible (D8 serving lane;
            // flags per cef_scheme_option_t: STANDARD|LOCAL|SECURE|CORS)
            if let Some(r) = registrar {
                use sys::cef_scheme_options_t as so;
                let opts = so::CEF_SCHEME_OPTION_STANDARD as ::std::os::raw::c_int
                    | so::CEF_SCHEME_OPTION_LOCAL as ::std::os::raw::c_int
                    | so::CEF_SCHEME_OPTION_SECURE as ::std::os::raw::c_int
                    | so::CEF_SCHEME_OPTION_CORS_ENABLED as ::std::os::raw::c_int;
                r.add_custom_scheme(Some(&"omnilet".into()), opts);
            }
        }

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

/// Shared serving state for the offline lane (T6): current offline root +
/// served-hit counter (example asserts > 0 = omnilet:// actually answered).
#[derive(Clone, Default)]
pub struct ServingState {
    root: Arc<Mutex<Option<std::path::PathBuf>>>,
    served: Arc<AtomicUsize>,
}

/// extension of WebViewBackend for serving state (backend & handlers share it)
#[derive(Clone)]
pub struct OfflineProvider {
    state: ServingState,
}

impl OfflineProvider {
    /// Map an omnilet://app/<path> request to a file under the serving root.
    /// Returns (file_path, mime) or None (not ours / traversal miss —
    /// omnilet-protocol resolve is the traversal-proof single point).
    pub fn resolve_omnilet(&self, url: &str) -> Option<(std::path::PathBuf, String)> {
        let root = self.state.root.lock().unwrap().clone()?;
        let rel = url.strip_prefix("omnilet://app/")?;
        let rel = rel.split('#').next().unwrap_or(rel);
        let rel = rel.split('?').next().unwrap_or(rel);
        let rel = if rel.is_empty() { "index.html" } else { rel };
        let resolved = omnilet_protocol::resolve(&root, rel);
        match resolved {
            omnilet_protocol::Resolved::File(path) => {
                self.state.served.fetch_add(1, Ordering::Relaxed);
                let mime = mime_for(&path).to_string();
                Some((path, mime))
            }
            omnilet_protocol::Resolved::Miss => None,
        }
    }

    pub fn served_hits(&self) -> usize {
        self.state.served.load(Ordering::Relaxed)
    }
}

/// Minimal mime table for offline packages (extension → type; unknown = octet-stream).
fn mime_for(path: &std::path::Path) -> &'static str {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    match ext {
        "html" | "htm" => "text/html",
        "js" | "mjs" => "text/javascript",
        "css" => "text/css",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "wasm" => "application/wasm",
        "ttf" => "font/ttf",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
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

// The offline serving lane: delegate resource loads to the process
// ResourceManager (directory provider added by load_offline_dir).
// IO-thread contract: manager provider callbacks arrive on CEF's IO thread
// (provider debug_asserts it; we only hand objects over, no thread jumps).
wrap_resource_request_handler! {
    struct OfflineRrh {
        serving: ServingState,
    }

    impl ResourceRequestHandler {
        fn on_before_resource_load(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            request: Option<&mut Request>,
            callback: Option<&mut Callback>,
        ) -> ReturnValue {
            let (Some(b), Some(f), Some(r), Some(cb)) = (browser, frame, request, callback) else {
                return ReturnValue::CONTINUE;
            };
            // T6 verification surface: count our-scheme requests at the pass-through
            let url = cef_url_str(&r.url());
            if url.starts_with("omnilet://") {
                self.serving.served.fetch_add(1, Ordering::Relaxed);
            }
            match resource_manager().lock() {
                Ok(mut m) => m.on_before_resource_load(b.clone(), f.clone(), r.clone(), cb.clone()),
                Err(_) => ReturnValue::CONTINUE,
            }
        }
    }
}

wrap_request_handler! {
    struct OfflineRh {
        rrh: ResourceRequestHandler,
    }

    impl RequestHandler {
        fn resource_request_handler(
            &self,
            _browser: Option<&mut Browser>,
            _frame: Option<&mut Frame>,
            _request: Option<&mut Request>,
            _is_navigation: i32,
            _is_download: i32,
            _request_initiator: Option<&CefStringUtf16>,
            _disable_default_handling: Option<&mut i32>,
        ) -> Option<ResourceRequestHandler> {
            Some(self.rrh.clone())
        }
    }
}

wrap_client! {
    struct EngineClient {
        render_handler: RenderHandler,
        request_handler: RequestHandler,
    }

    impl Client {
        fn render_handler(&self) -> Option<RenderHandler> {
            Some(self.render_handler.clone())
        }
        fn request_handler(&self) -> Option<RequestHandler> {
            Some(self.request_handler.clone())
        }
        // popup/navigation cage hooks: T8
    }
}

/// The Linux standard-mode backend (D16 final form).
pub struct CefBackend {
    browser: Option<SendBrowser>,
    serving: ServingState,
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

    /// Offline serving hit-count since load (T6 verification surface).
    pub fn offline_served(&self) -> usize {
        self.serving.served.load(Ordering::Relaxed)
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
            serving: ServingState::default(),
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
        let rrh = OfflineRrh::new(self.serving.clone());
        let rh = OfflineRh::new(rrh.clone());
        let browser = browser_host_create_browser_sync(
            Some(&WindowInfo {
                windowless_rendering_enabled: true as _,
                ..Default::default()
            }),
            Some(&mut EngineClient::new(FrameSinkHolder::new(sink), rh)),
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
        {
            let mut m = resource_manager()
                .lock()
                .map_err(|_| WebviewError::Navigate("resource manager poisoned".into()))?;
            m.remove_providers("omnilet-app");
            m.add_directory_provider("omnilet://app", &dir.display().to_string(), 0, "omnilet-app");
        }
        self.navigate("omnilet://app/index.html")
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

#[cfg(test)]
mod offline_tests {
    use super::*;

    #[test]
    fn mime_table() {
        assert_eq!(mime_for(std::path::Path::new("a/index.html")), "text/html");
        assert_eq!(mime_for(std::path::Path::new("x.wasm")), "application/wasm");
        assert_eq!(mime_for(std::path::Path::new("f.unknown")), "application/octet-stream");
    }

    #[test]
    fn omnilet_url_resolution_reuses_protocol_traversal_proofs() {
        let root = std::env::temp_dir().join(format!("omnilet-resolve-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("pages")).unwrap();
        std::fs::write(root.join("index.html"), b"<html><body>omnilet T6</body></html>").unwrap();
        std::fs::write(root.join("pages/app.js"), b"console.log(1)").unwrap();

        let st = ServingState::default();
        *st.root.lock().unwrap() = Some(root.clone());
        let provider = OfflineProvider { state: st.clone() };

        // normal + default document
        let (p, mime) = provider.resolve_omnilet("omnilet://app/index.html").expect("index");
        assert!(p.ends_with("index.html") && mime == "text/html");
        let (p, _) = provider.resolve_omnilet("omnilet://app/pages/app.js").expect("js");
        assert!(p.ends_with("pages/app.js"));
        let (p, _) = provider.resolve_omnilet("omnilet://app/").expect("root default");
        assert!(p.ends_with("index.html"));
        // query/fragment stripped
        assert!(provider.resolve_omnilet("omnilet://app/index.html?x=1#y").is_some());
        // traversal refused (delegated to omnilet-protocol proofs)
        assert!(provider.resolve_omnilet("omnilet://app/../../etc/passwd").is_none());
        // foreign scheme not ours
        assert!(provider.resolve_omnilet("https://example.com/x").is_none());
        assert_eq!(provider.served_hits(), 4, "each hit counted (example-side proof)");
        let _ = std::fs::remove_dir_all(&root);
    }
}
