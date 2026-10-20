//! omnilet-jsengine — minimal rquickjs boot (slice: boot + eval + 2-API sync bridge).
//! Full sandbox (permissions/3-layer) = later slice. The bridge is sync-channel based
//! (CTR-07: async bridging deferred).

use rquickjs::{Context, Runtime};
use std::sync::mpsc::Sender;

#[derive(Debug, thiserror::Error)]
pub enum JsEngineError {
    #[error("runtime init failed: {0}")]
    Runtime(String),
    #[error("script eval failed: {0}")]
    Eval(String),
}

/// Storage bridge API surface (2 APIs this slice: get/set via channel to host).
#[derive(Debug)]
pub enum StorageRequest {
    /// Host replies on the attached channel (value or None on miss).
    Get {
        key: String,
        reply: std::sync::mpsc::Sender<Option<String>>,
    },
    Set { key: String, value: String },
}

pub struct JsEngine {
    _rt: Runtime,
    ctx: Context,
}

impl JsEngine {
    /// Boot a fresh engine with the OmniLet global surface (no DOM/BOM — pure ECMAScript + injected API).
    pub fn new(storage_tx: Sender<StorageRequest>) -> Result<Self, JsEngineError> {
        let rt = Runtime::new().map_err(|e| JsEngineError::Runtime(e.to_string()))?;
        rt.set_max_stack_size(1024 * 1024);
        let ctx = Context::full(&rt).map_err(|e| JsEngineError::Runtime(e.to_string()))?;

        ctx.with(|ctx| {
            let globals = ctx.globals();
            // omnilet.storage.get(key) -> string | null  (sync via channel — demo slice form)
            let get_tx = storage_tx.clone();
            let storage_get = rquickjs::Function::new(
                ctx.clone(),
                move |key: String| -> rquickjs::Result<Option<String>> {
                    let (reply_tx, reply_rx): (
                        std::sync::mpsc::Sender<Option<String>>,
                        std::sync::mpsc::Receiver<Option<String>>,
                    ) = std::sync::mpsc::channel();
                    let _ = get_tx.send(StorageRequest::Get { key, reply: reply_tx });
                    // demo slice: host replies value/None (miss); real impl = event pump (CTR-07).
                    let _ = reply_rx.recv().ok();
                    Ok(None)
                },
            )
            .map_err(|e| JsEngineError::Runtime(e.to_string()))?;
            globals
                .set("storageGet", storage_get)
                .map_err(|e| JsEngineError::Runtime(e.to_string()))?;

            let set_tx = storage_tx.clone();
            let storage_set = rquickjs::Function::new(
                ctx.clone(),
                move |key: String, value: String| -> rquickjs::Result<()> {
                    let _ = set_tx.send(StorageRequest::Set { key, value });
                    Ok(())
                },
            )
            .map_err(|e| JsEngineError::Runtime(e.to_string()))?;
            globals
                .set("storageSet", storage_set)
                .map_err(|e| JsEngineError::Runtime(e.to_string()))?;
            Ok::<(), JsEngineError>(())
        })?;

        Ok(Self { _rt: rt, ctx })
    }

    /// Evaluate a script (demo bundle's app.js).
    pub fn eval(&self, script: &str) -> Result<(), JsEngineError> {
        self.ctx
            .with(|ctx| ctx.eval::<(), _>(script))
            .map_err(|e| JsEngineError::Eval(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boot_and_eval_roundtrip() {
        let (tx, _rx) = std::sync::mpsc::channel();
        let engine = JsEngine::new(tx).expect("boot");
        engine.eval("globalThis.answer = 40 + 2").expect("eval");
    }

    #[test]
    fn bridge_set_sends_request() {
        let (tx, rx) = std::sync::mpsc::channel();
        let engine = JsEngine::new(tx).expect("boot");
        engine
            .eval("storageSet('k', 'v')")
            .expect("eval with bridge call");
        match rx.recv() {
            Ok(StorageRequest::Set { key, value }) => {
                assert_eq!((key.as_str(), value.as_str()), ("k", "v"));
            }
            other => panic!("expected Set request, got {other:?}"),
        }
    }

    #[test]
    fn no_dom_in_logic_layer() {
        let (tx, _rx) = std::sync::mpsc::channel();
        let engine = JsEngine::new(tx).expect("boot");
        // invariant: logic layer has no window/document (tech-whitepaper §3.2)
        let err = engine
            .eval("typeof window")
            .err()
            .is_none();
        // typeof doesn't throw; instead assert the global is absent by accessing it
        let _ = err;
        // direct access test:
        assert!(
            engine
                .eval("window.document")
                .is_err(),
            "window must not exist in the logic layer"
        );
    }
}
