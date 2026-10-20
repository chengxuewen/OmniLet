//! omnilet-webview — the frozen WebViewBackend contract (D12-add4, user-adjudicated).
//!
//! Orthogonal to `omnilet-render::Renderer` (that trait serves HMI self-draw; this one
//! serves standard-mode WebView). Both share the host-material pocket type.
//!
//! Freeze scope (card 1: four layers, ten methods):
//!   lifecycle {create, resize, destroy} · loading {navigate, load_offline_dir}
//!   JS {eval, register_bridge, on_event} · security {set_request_filter, set_navigation_policy}
//! Anything else enters via `#[doc(hidden)]` extension slots (CefBackend-learned methods).

use std::any::Any;
use std::path::Path;
use std::sync::Arc;

/// Host window material pocket — SHARED with omnilet-render::SurfaceHandle semantics
/// (card 2 A′). Documented payload conventions:
///   - WryBackend: object implementing raw-window-handle's HasWindowHandle (e.g. winit Window)
///   - CefBackend(OSR): canvas registrar callback (RWH has no OSR variant — pocket does)
pub struct WebviewParent(pub Arc<dyn Any + Send + Sync>);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// One bridge request handed to a native handler (card 3 A: FnOnce responder).
pub struct BridgeRequest {
    pub method: String,
    pub payload: String, // JSON (dual-channel D5 add2 payload shape)
    /// Consume-once responder; callable from any thread; the ONLY way to answer the web.
    pub responder: BridgeResponder,
}

/// Bridge result: JSON payload on success, error message on failure (dual-channel shape, D5 add2).
pub type BridgeResult = Result<String, String>;
/// Consumed-once delivery function backing a responder.
type ResponderFn = Box<dyn FnOnce(BridgeResult) + Send>;

/// FnOnce answer handle — type-system "answer exactly once" (mirrors wry RequestAsyncResponder).
pub struct BridgeResponder {
    f: Option<ResponderFn>,
}

impl BridgeResponder {
    pub fn new(f: impl FnOnce(BridgeResult) + Send + 'static) -> Self {
        Self { f: Some(Box::new(f)) }
    }
    /// Deliver success (JSON) or error message to the web. Panics only on programmer error
    /// (double respond) — single-consumption is the contract.
    pub fn respond(mut self, result: BridgeResult) {
        let f = self.f.take().expect("bridge responder consumed twice");
        f(result);
    }
}

pub type BridgeHandler = Box<dyn Fn(BridgeRequest) + Send>;

/// Per-request verdict from the security filter (D8-3: the trait-level enforcement point —
/// without this hook, whitelist is documentation, not mechanism).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilterVerdict {
    Allow,
    Block,
}

pub type RequestFilter = Arc<dyn Fn(&str) -> FilterVerdict + Send + Sync>;

/// Navigation policy (sandbox invariant: mini-apps never spawn windows/untrusted top-levels).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct NavigationPolicy {
    pub allow_windows: bool,
    pub allow_external_navigation: bool,
}

/// Webview lifecycle events the host must observe (startup data flow, architecture §③).
#[derive(Debug, Clone)]
pub enum WebviewEvent {
    LoadStarted { url: String },
    LoadFinished { url: String },
    Failed { error: String },
}

/// The frozen WebViewBackend contract (D12-add4 card 1: all ten methods). Object-safe.
pub trait WebViewBackend: Send {
    // ---- lifecycle ----
    /// Bind + create the view over host material at `bounds`.
    fn create(&mut self, parent: WebviewParent, bounds: Bounds) -> Result<(), WebviewError>;
    fn resize(&mut self, bounds: Bounds) -> Result<(), WebviewError>;
    /// Release engine resources (cef multi-process shutdown lives INSIDE the impl).
    fn destroy(&mut self) -> Result<(), WebviewError>;

    // ---- loading ----
    fn navigate(&mut self, url: &str) -> Result<(), WebviewError>;
    /// Serve the mini-app from an unpacked directory (B0 dev-shell path; protocol
    /// registration + navigate is impl-internal — the trait expresses the semantic, not the mechanism).
    fn load_offline_dir(&mut self, dir: &Path) -> Result<(), WebviewError>;

    // ---- JS interaction ----
    /// Evaluate script; result serialized as JSON string.
    fn eval(&mut self, script: &str) -> Result<String, WebviewError>;
    /// Register a native bridge method (sync registration, async-where-needed answer via responder).
    fn register_bridge(&mut self, name: &str, handler: BridgeHandler) -> Result<(), WebviewError>;
    /// Host event sink (called from the host's pumping thread — invariant ④).
    fn on_event(&mut self, callback: Box<dyn Fn(WebviewEvent) + Send>);

    // ---- security hooks (D8-3 / invariant ⑤ enforcement surface) ----
    fn set_request_filter(&mut self, filter: RequestFilter);
    fn set_navigation_policy(&mut self, policy: NavigationPolicy);
}

#[derive(Debug, thiserror::Error)]
pub enum WebviewError {
    #[error("parent material invalid for this backend: {0}")]
    ParentRejected(&'static str),
    #[error("navigation failed: {0}")]
    Navigate(String),
    #[error("eval failed: {0}")]
    Eval(String),
    #[error("backend lifecycle error: {0}")]
    Lifecycle(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Freeze acceptance: trait is object-safe AND a mock backend satisfies all ten
    /// methods without any webview dependency (S-2 test discipline).
    #[derive(Default)]
    struct MockBackend {
        created: bool,
    }
    impl WebViewBackend for MockBackend {
        fn create(&mut self, _p: WebviewParent, _b: Bounds) -> Result<(), WebviewError> {
            self.created = true;
            Ok(())
        }
        fn resize(&mut self, _b: Bounds) -> Result<(), WebviewError> {
            Ok(())
        }
        fn destroy(&mut self) -> Result<(), WebviewError> {
            Ok(())
        }
        fn navigate(&mut self, url: &str) -> Result<(), WebviewError> {
            if url.is_empty() {
                return Err(WebviewError::Navigate("empty".into()));
            }
            Ok(())
        }
        fn load_offline_dir(&mut self, _dir: &Path) -> Result<(), WebviewError> {
            Ok(())
        }
        fn eval(&mut self, _script: &str) -> Result<String, WebviewError> {
            Ok("null".into())
        }
        fn register_bridge(&mut self, _name: &str, _h: BridgeHandler) -> Result<(), WebviewError> {
            Ok(())
        }
        fn on_event(&mut self, _cb: Box<dyn Fn(WebviewEvent) + Send>) {}
        fn set_request_filter(&mut self, _f: RequestFilter) {}
        fn set_navigation_policy(&mut self, _p: NavigationPolicy) {}
    }

    #[test]
    fn trait_is_object_safe_ten_method_surface() {
        let mut b: Box<dyn WebViewBackend> = Box::new(MockBackend::default());
        let pocket = WebviewParent(Arc::new(42u8)); // any payload
        b.create(pocket, Bounds { x: 0, y: 0, width: 800, height: 600 }).unwrap();
        b.resize(Bounds { x: 0, y: 0, width: 1024, height: 768 }).unwrap();
        b.navigate("omnilet://app/index.html").unwrap();
        assert!(b.navigate("").is_err());
        b.load_offline_dir(&PathBuf::from("/tmp")).unwrap();
        assert_eq!(b.eval("1").unwrap(), "null");
        b.register_bridge("storage.set", Box::new(|_req| {})).unwrap();
        b.on_event(Box::new(|_e| {}));
        b.set_request_filter(std::sync::Arc::new(|_url| FilterVerdict::Allow));
        b.set_navigation_policy(NavigationPolicy::default());
        b.destroy().unwrap();
    }

    #[test]
    fn responder_consumes_once() {
        use std::sync::{mpsc, Mutex};
        let (tx, rx) = mpsc::channel();
        let sink = Arc::new(Mutex::new(Some(tx)));
        let r = BridgeResponder::new(move |res| {
            let _ = sink.lock().unwrap().take().map(|t| t.send(res));
        });
        // respond takes self BY VALUE — double-response is a compile-time impossibility
        r.respond(Ok("{\"ok\":true}".into()));
        assert_eq!(rx.recv().unwrap().unwrap(), "{\"ok\":true}");
    }
}
