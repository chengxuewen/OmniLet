# Design: cef-backend

## Architecture

```
crates/omnilet-container/
├── src/main.rs        # CLI (exists) → dispatches to CefBackend mode
├── src/cef/
│   ├── mod.rs         # CefBackend: WebViewBackend impl (ten methods)
│   ├── app.rs         # cef::App + AppHandler (scheme registration, subprocess bootstrap)
│   ├── handler.rs     # cef::RequestHandler: load events, cage (nav policy), bridge plumbing
│   ├── resource.rs    # omnilet:// scheme → omnilet-protocol::resolve (traversal-proof reused)
│   ├── bridge.rs      # message_router ⇄ omnilet-webview BridgeHandler/Responder adapter
│   └── pump.rs        # winit EventLoop ⇄ cef::message_loop_work fusion (the T2/T5 spike answer)
└── ...
process model (CEF, as-is — recorded not fought):
  main process (browser, our Rust, winit pump) ─┬─ renderer subprocess(es)  ← page code, no omnilet APIs
                                                └─ (gpu process; no-sandbox default, cef-rs)
  INVARIANT ① crash domains: renderer death = WebviewEvent::Failed, our logic
  layer (rquickjs) + engine stay. SECURITY boundary = omnilet layer (D8 chain),
  NOT CEF's process sandbox (stated: no_sandbox default; CEF sandbox = future
  hardening knob, own decision when distribution asks).
pump fusion (the core engineering question, spike answers with numbers):
  loop {
    winit: wait(device_event, timeout = cef::timeout())   // external-pump pattern
    events → container core dispatch
    cef::message_loop_work()                              // drives CEF UI
    flush downlink frames (omnilet-channel) when view ready
  }
  exit: destroy() → no zombie subprocesses (verified count at T2/T5)
```

## Files to Touch

### Create
| File | Purpose |
|------|---------|
| crates/omnilet-container/src/cef/{mod,app,handler,resource,bridge,pump}.rs | as above |
| crates/omnilet-container/SDD.md | CEF-01.. clauses (pump contract, scheme resolve, bridge mapping, cage defaults, crash-domain mapping) |
| examples/demo-app/{index.html,app.js,manifest.json} | demo mini-app (manifest validates vs packages/rule-schema) |
| crates/omnilet-container/tests/cef_contract.rs | reuse omnilet-webview mock-suite discipline against real CefBackend where headless-possible |

### Modify
| File | Change |
|------|--------|
| crates/omnilet-container/Cargo.toml | + cef = "154" (via cef-rs), + winit = "0.30" (window lane — D9-3 holds), + omnilet-* wiring; features: none by default (no-sandbox) |
| src/main.rs | --dir launches CefBackend path (replaces the "would load" stub) |
| pixi.toml | runtime .so additions from T2 ldd sweep (gtk3/cmake/ninja already in) |
| CMakeLists.txt | polyorch_rust_build BINARY omnilet-container lane (T10) |
| docs/test-matrix.md | T4 Linux row = CEF native (D18); note: no webkit2gtk prerequisite |

### Delete
None (main.rs stub branches replaced, not deleted).

## Data Flow (first frame, standard mode)

```
--dir → omnilet-protocol manifest check (fail-closed, exists) → cef init →
scheme register (omnilet) → pump loop → create_browser(WindowInfo parent=winit
surface, url=omnilet://app/index.html) → resource.rs serves files (resolve ✓) →
page paints → handler: load-finished event → bridge ready (message_router ⇄
BridgeResponder) → rquickjs logic boots (jsengine) → first setData →
omnilet-channel flush(seq=1) → eval-in-view executes patch → visible UI.
```

## Integration Points

- omnilet-webview: THE contract implemented (extension slots filled = findings, frozen 3 ops untouched — S-2 discipline)
- omnilet-protocol: resource.rs calls `resolve()` verbatim (traversal proofs transfer to CEF lane)
- omnilet-channel/pack: downlink frames = channel Downstream impl over eval() transport (JSON envelope first; binary deferred)
- jsengine bridge: storage capability registered as `omnilet.storage.*` (D17 naming — capability word = permission word = audit word, from the first bridge)
- cage defaults (D13-2): popup → denied + audited; top-level nav → verified-domain list; resource filter → every subframe request (native-side single point)

## Stack Specifics

- cef-rs: execute_process bootstrap at main entry (subprocesses re-enter our binary — bin arg dispatch FIRST, before winit); Settings.no_sandbox default verified; resource_manager/message_router wrappers in-tree
- winit 0.30 (stable line): has-window-handle payload ① (D12-add4 A′ pocket) — WebviewParent(Arc(window)) → CefBackend downcasts
- Linux: X11 assumed (DISPLAY present on this host — verified via T2; Wayland via XWayland acceptable per CEF)
- Rust errors: thiserror in lib surfaces; main gets anyhow? no — keep std-free thiserror + explicit codes (rules/rust)

## Error Handling

load failure → WebviewEvent::Failed(+url) + audit line; renderer subprocess crash → handler on_render_process_terminated → Failed + relaunch policy (defer: crash-loop rollback is D8-5 SDK side, here just event); pump exit: shutdown() after last browser close, assert no zombies (test).

## Testing Strategy

- T1 build-chain: cargo check in pixi env (proves D18 deps bet)
- T2 first-frame: headless-capable PNG (OSR windowless probe) + optional X11 window; pixel-nonblack assert on PNG (predecessor pixel-gate discipline, minimal form)
- T3 ldd sweep → pixi additions + SDD record of runtime set
- unit: resource.rs resolve-mapping (pure), bridge adapter payload round-trips, cage defaults (filter decisions pure fn)
- contract: omnilet-webview suite re-run against CefBackend where headless-possible; windowed parts = T4 human list (devtools-spec: launch cmd + expected)
- QA gate: clippy -D warnings; workspace tests (cef-skip-safe: pure crates unaffected); bite-test discipline unchanged

## Dependencies

- New Rust: cef 154 (cef-rs), winit 0.30 — both via pixi env compile chain (gtk3/cmake/ninja in place)
- Download: CEF distro ~130MB at first build (CDN reachable, verified 0.58s this session; CI caching = future CI slice)
- No new JS deps
