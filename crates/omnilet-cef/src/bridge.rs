// T7 bridge lane: H5 (render process) ⇄ omnilet bridge (browser process),
// built on cef-rs's official message_router wrapper (the half-built piece
// D12-add3 inventoried). Wire: window.cefQuery({request: {m,a}}) ⇄
// BrowserSideHandler ⇄ omnilet-webview BridgeRequest/BridgeResponder.

use cef::wrapper::message_router::{
    BrowserSideCallback, BrowserSideHandler, BrowserSideRouter, MessageRouterBrowserSide,
    MessageRouterRendererSide, MessageRouterRendererSideHandlerCallbacks, RendererSideRouter,
};
use cef::*;
use omnilet_webview::{BridgeHandler, BridgeRequest, BridgeResponder};
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

/// Render-process wiring (App::render_process_handler installs this).
/// The three callbacks are exactly the router's documented host-hook points.
wrap_render_process_handler! {
    pub struct OmniletRph {}

    impl RenderProcessHandler {
        fn on_context_created(
            &self,
            browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            context: Option<&mut V8Context>,
        ) {
renderer_router().on_context_created(browser.cloned(), frame.cloned(), context.cloned());
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

/// Bootstrap JS (D13-4 "channel bootstrap" tier — the full JSSDK ships as a
/// static resource later; this minimal form already speaks the browser-side
/// Dispatcher's wire format). `get` carries onSuccess to prove the round-trip.
pub const BOOTSTRAP_JS: &str = r#"
window.omnilet = window.omnilet || {};
window.omnilet.storage = {
  set: function (k, v) {
    window.cefQuery({ request: JSON.stringify({ m: "omnilet.storage.set", a: JSON.stringify([k, v]) }) });
  },
  get: function (k, onSuccess) {
    window.cefQuery({ request: JSON.stringify({ m: "omnilet.storage.get", a: k }), onSuccess: onSuccess });
  }
};
"#;
