// T7 bridge lane: H5 (render process) ⇄ omnilet bridge (browser process),
// built on cef-rs's official message_router wrapper (the half-built piece
// D12-add3 inventoried). Wire: window.cefQuery({request: {m,a}}) ⇄
// BrowserSideHandler ⇄ omnilet-webview BridgeRequest/BridgeResponder.

use cef::wrapper::message_router::{
    BrowserSideCallback, BrowserSideHandler, BrowserSideRouter, MessageRouterBrowserSide,
    MessageRouterRendererSide, MessageRouterRendererSideHandlerCallbacks, RendererSideRouter,
};
use cef::*;
use omnilet_webview::{BridgeRequest, BridgeResponder};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock, RwLock};

/// Wire format the bootstrap JS sends (payload pre-stringified; the contract's
/// payload stays an opaque String end-to-end).
#[derive(Deserialize)]
struct BridgeCall {
    m: String,
    a: String,
}

/// Global bridge registry (browser process). CONVENTION (documented; handlers
/// run under the read guard): handlers must not re-enter the registry.
pub(crate) fn bridge_registry() -> &'static RwLock<HashMap<String, SharedBridge>> {
    static REG: OnceLock<RwLock<HashMap<String, SharedBridge>>> = OnceLock::new();
    REG.get_or_init(Default::default)
}

/// Registry-owned form of the contract's boxed handler.
pub(crate) type SharedBridge = std::sync::Arc<dyn Fn(BridgeRequest) + Send + Sync>;

pub(crate) fn browser_router() -> &'static Arc<BrowserSideRouter> {
    static RT: OnceLock<Arc<BrowserSideRouter>> = OnceLock::new();
    RT.get_or_init(|| {
        let router = <BrowserSideRouter as MessageRouterBrowserSide>::new(Default::default());

        struct Dispatcher;
        impl BrowserSideHandler for Dispatcher {
            fn on_query_str(
                &self,
                _browser: Option<Browser>,
                _frame: Option<Frame>,
                _query_id: i64,
                request: &str,
                _persistent: bool,
                callback: Arc<Mutex<dyn BrowserSideCallback>>,
            ) -> bool {
                let Ok(call) = serde_json::from_str::<BridgeCall>(request) else {
                    return false; // foreign cefQuery user — not ours
                };
                let Ok(reg) = bridge_registry().read() else {
                    return false;
                };
                let Some(handler) = reg.get(&call.m) else {
                    return false; // method not registered -> JS failure path
                };
                let responder = BridgeResponder::new(move |res| {
                    let Ok(cb) = callback.lock() else { return };
                    match res {
                        Ok(payload) => cb.success_str(&payload),
                        Err(msg) => cb.failure(-1, &msg),
                    }
                });
                handler(BridgeRequest {
                    method: call.m,
                    payload: call.a,
                    responder,
                });
                true
            }
        }
        router.add_handler(Arc::new(Dispatcher), true);
        router
    })
}

/// Browser-side entry: Client::on_process_message_received forwards here.
pub(crate) fn deliver_browser_message(
    browser: Option<&mut Browser>,
    frame: Option<&mut Frame>,
    source_process: ProcessId,
    message: Option<&mut ProcessMessage>,
) -> bool {
    use cef::wrapper::message_router::MessageRouterBrowserSideHandlerCallbacks;
    browser_router().on_process_message_received(
        browser.cloned(),
        frame.cloned(),
        source_process,
        message.cloned(),
    )
}

/// Render-process router (renderer main-thread affinity — thread_local per
/// CEF's documented single-thread rule for the renderer side).
pub(crate) fn renderer_router() -> Arc<RendererSideRouter> {
    thread_local! {
        static RT: Arc<RendererSideRouter> =
            <RendererSideRouter as MessageRouterRendererSide>::new(Default::default());
    }
    RT.with(|r| r.clone())
}

/// Internal eval-leg message name (D20): browser -> renderer, render-local eval.
pub(crate) const EVAL_MSG_NAME: &str = "omnilet-eval";

// Render-process wiring (App::render_process_handler installs this).
// The three callbacks are exactly the router's documented host-hook points.
wrap_render_process_handler! {
    pub struct OmniletRph {}

    impl RenderProcessHandler {
        fn on_context_created(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            context: Option<&mut V8Context>,
        ) {
            let ctx_owned = context.map(|c| c.clone());
            renderer_router().on_context_created(browser.cloned(), frame.cloned(), ctx_owned.clone());
            // D20: BOOTSTRAP_JS lands render-local here — frame-execute is dead in
            // this combo (SDD CEF-07) and the facade is window.cefQuery's JS surface.
            // NOTE: CEF eval REQUIRES both output slots non-null; a None retval
            // short-circuits to false with no exception (measured 2026-10-20).
            if let Some(ctx) = ctx_owned.as_ref() {
                let mut ret: Option<V8Value> = None;
                let mut exc: Option<V8Exception> = None;
                let _ = ctx.eval(
                    Some(&CefString::from(BOOTSTRAP_JS)),
                    Some(&CefString::from("omnilet-bootstrap")),
                    0,
                    Some(&mut ret),
                    Some(&mut exc),
                );
            }
        }
        fn on_context_released(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            context: Option<&mut V8Context>,
        ) {
            renderer_router()
                .on_context_released(browser.cloned(), frame.cloned(), context.cloned());
        }
        fn on_process_message_received(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            source_process: ProcessId,
            message: Option<&mut ProcessMessage>,
        ) -> i32 {
            // D20 eval leg: internal "omnilet-eval" messages run render-local in the
            // frame's V8 context (the live lane; frame-execute is dead per CEF-07).
            let name = message.as_ref().map(|m| crate::cef_url_str(&m.name())).unwrap_or_default();
            if name == EVAL_MSG_NAME {
                let code = message
                    .as_ref()
                    .and_then(|m| m.argument_list())
                    .and_then(|l| l.value(0))
                    .map(|v| crate::cef_url_str(&v.string()));
                let ctx = frame
                    .and_then(|f| f.v8_context())
                    .or_else(|| browser.and_then(|b| b.main_frame()).and_then(|mf| mf.v8_context()));
                if let (Some(code), Some(ctx)) = (code, ctx) {
                    // Result channel is T7+ (WebviewEvent surface); eval runs
                    // fire-and-forget for now. Slots per CEF contract (D20).
                    let mut ret: Option<V8Value> = None;
                    let mut exc: Option<V8Exception> = None;
                    let _ok = ctx.eval(
                        Some(&CefString::from(code.as_str())),
                        Some(&CefString::from("omnilet-eval")),
                        0,
                        Some(&mut ret),
                        Some(&mut exc),
                    );
                }
                return 1;
            }
            renderer_router()
                .on_process_message_received(
                    browser.cloned(),
                    frame.cloned(),
                    Some(source_process),
                    message.cloned(),
                )
                as i32
        }
    }
}

// D13-2 popup gate (LifeSpanHandler; default deny + audit — the "host
// adjudication" approval flow itself lands with the permission-lane slice).
wrap_life_span_handler! {
    pub struct OmniletLsp {}

    impl LifeSpanHandler {
        fn on_before_popup(
            &self,
            _browser: Option<&mut Browser>,
            _frame: Option<&mut Frame>,
            _popup_id: i32,
            target_url: Option<&CefString>,
            _target_frame_name: Option<&CefString>,
            _target_disposition: WindowOpenDisposition,
            _user_gesture: i32,
            _popup_features: Option<&PopupFeatures>,
            _window_info: Option<&mut WindowInfo>,
            _client: Option<&mut Option<Client>>,
            _settings: Option<&mut BrowserSettings>,
            _extra_info: Option<&mut Option<DictionaryValue>>,
            _no_javascript_access: Option<&mut i32>,
        ) -> i32 {
            // url extraction from the generic CefString param deferred (audit
            // kind+decision is the load-bearing record): keep the shape honest
            let _ = target_url;
            let url = "«popup»";
            let Ok(c) = crate::cage::cage().read() else { return 0 };
            if let Err(reason) = crate::cage::decide_popup(&c) {
                crate::cage::audit_blocked("popup", url, reason);
                return 1;
            }
            0
        }
    }
}

/// Bootstrap JS (D13-4 "channel bootstrap" tier — the full JSSDK ships as a
/// static resource later; this minimal form already speaks the browser-side
/// Dispatcher's wire format). `get` carries onSuccess to prove the round-trip.
pub const BOOTSTRAP_JS: &str = r#"
// NOTE (D20): the cef-rs message_router V8 handler REQUIRES both onSuccess and
// onFailure functions on every cefQuery object (a missing member reads back as
// undefined and trips the type-function guard). The facade always passes both.
window.omnilet = window.omnilet || {};
window.omnilet.storage = {
  set: function (k, v) {
    window.cefQuery({ request: JSON.stringify({ m: "omnilet.storage.set", a: JSON.stringify([k, v]) }),
      onSuccess: function () {},
      onFailure: function (c, m) { if (window.console) console.error("omnilet.storage.set failed", c, m); } });
  },
  get: function (k, onSuccess) {
    window.cefQuery({ request: JSON.stringify({ m: "omnilet.storage.get", a: k }),
      onSuccess: onSuccess,
      onFailure: function (c, m) { if (window.console) console.error("omnilet.storage.get failed", c, m); } });
  }
};
"#;


// ─── T6 serving handler (memory-buffer, synchronous). The StreamResourceHandler
// path served nothing usable in this combo — root-caused via paint probes
// 2026-10-19. Real content-length; all callbacks per contract.

wrap_resource_handler! {
    pub struct OfflineResHandler {
        body: std::sync::Arc<Vec<u8>>,
        mime: String,
        offset: std::sync::Arc<std::sync::Mutex<i64>>,
    }

    impl ResourceHandler {
        fn process_request(
            &self,
            _request: Option<&mut Request>,
            callback: Option<&mut Callback>,
        ) -> i32 {
            if let Some(cb) = callback {
                cb.cont();
            }
            1
        }
        fn response_headers(
            &self,
            response: Option<&mut Response>,
            response_length: Option<&mut i64>,
            _redirect_url: Option<&mut CefString>,
        ) {
            if let Some(r) = response {
                r.set_status(200);
                r.set_mime_type(Some(&CefString::from(self.mime.as_str())));
                r.set_charset(Some(&CefString::from("utf-8")));
            }
            if let Some(rl) = response_length {
                *rl = self.body.len() as i64;
            }
        }
        fn read(
            &self,
            data_out: *mut u8,
            bytes_to_read: i32,
            bytes_read: Option<&mut i32>,
            _callback: Option<&mut ResourceReadCallback>,
        ) -> i32 {
            let Ok(mut off) = self.offset.lock() else { return 0 };
            let remain = (self.body.len() as i64 - *off).max(0) as usize;
            let n = (bytes_to_read as usize).min(remain);
            if n > 0 && !data_out.is_null() {
                let src = &self.body[*off as usize..*off as usize + n];
                unsafe { std::ptr::copy_nonoverlapping(src.as_ptr(), data_out, n) };
                *off += n as i64;
            }
            if let Some(br) = bytes_read {
                *br = n as i32;
            }
            if n > 0 { 1 } else { 0 }
        }
    }
}
