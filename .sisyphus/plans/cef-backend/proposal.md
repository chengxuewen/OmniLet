# Proposal: cef-backend

## What

Implement `CefBackend` — the first real consumer of the frozen `WebViewBackend` ten-method contract — using cef-rs (tauri-apps, Apache-2.0/MIT). Scope per D18: Linux standard-mode engine, native-window attachment first (windowless/OSR deferred to HMI needs). Ends with `omnilet-container --dir examples/demo-app` showing a real rendered page on this Ubuntu 20.04 host, with omnilet:// offline-protocol loading, one bridge API round-trip, and the security hooks armed.

## Why

D16 ruled CEF as the Linux final form; D18 pulled it forward (this host can't build wry at all, and the contract deserves its hardest-first check). cef-rs is Tauri-official infrastructure (verified active: v154.5.0, 2026-10), its no-sandbox default already resolves one D18 risk, and its message_router/resource_manager wrappers are the half-built pieces D12-add3 inventoried.

## Scope

**In scope**: spike (build chain, first-frame, runtime deps) → CefBackend ten methods (window path) → omnilet:// scheme handler (reuses omnilet-protocol's traversal-proof resolve) → bridge via cef message router + eval → security hooks (request filter / navigation policy, D13 cage defaults) → container main wiring + demo-app + PolyOrch lane → SDD clauses + memory.

**Out of scope (deferred, recorded)**: OSR texture/Renderer-trait integration (HMI slice) · binary patch envelope (perf slice) · multi-window/tabs · Windows/macOS lane (winmac-wry slice) · CEF distribution packaging sizes (distribution slice) · console/JSSDK surface (its own slice).

## Layers Affected

| Layer | Location | Affected |
|-------|----------|----------|
| Shared core | omnilet-webview/patch/channel/protocol/render | consumed, not changed (contract-first; findings via extension slots only) |
| Backend / services | crates/omnilet-container (cef module), jsengine (bridge adapter side) | ✅ main work |
| Schema / bindings | examples/demo-app (+manifest), pixi.toml (runtime .so additions) | ✅ |

## Existing Specs

- docs/architecture.md (invariants ①③④⑤; §③ data flow D15)
- docs/dsl-spec.md §8 (web-view cage — same cage defaults apply to CEF browser) + §9 (capability naming)
- docs/devtools-spec.md (B0: load-unpacked/watch — CefBackend --dir is its engine)
- docs/test-matrix.md (T1 gates; T4 Linux row now = CEF path, no webkit wall)
- omnilet-webview contract docs (ten methods + payload conventions)

## New Specs Needed

- crates/omnilet-container/SDD.md — CEF-NN clauses (pump fusion, scheme handler, bridge mapping, cage defaults)

## Risks

- **CEF binaries' glibc floor**: official CEF Linux builds support 20.04+ per its release notes (*verify at T1; if a Chromium-era build needs newer, older CEF branch pin is the lever* — cef-rs tracks multiple versions)
- **Pump fusion (winit loop vs CEF UI thread)**: single-thread message_loop_work cadence + winit wakeup is a solved pattern but needs measurement (jitter/exit cleanliness) — spike verdict recorded in SDD
- **130MB download**: network path verified reachable (0.58s CDN probe this session); CI caching strategy deferred to CI slice
- **no-sandbox posture**: already cef-rs default (verified source); our security promises stay on the omnilet layer (D8 chain) — stated in SDD, not silently inherited

## Success Criteria

1. `pixi run cargo check -p omnilet-container` builds cef-sys end-to-end (download-cef + cmake/ninja from pixi) — D18 dependency bet validated
2. First frame renders on this host (X11 window or headless PNG via OSR — T2 environment fork; ldd-clean runtime set lands in pixi.toml)
3. All ten WebViewBackend methods implemented on CefBackend (mock-contract test reused: same suite that gates WryBackend later)
4. `omnilet-container --dir examples/demo-app` loads via omnilet:// (protocol crate resolving, traversal proof), one `omnilet.storage.set/get` round-trip through bridge→rquickjs-visible API, cage defaults verified (popup denied, off-list navigation blocked → audited)
5. PolyOrch graph builds the bin; clippy -D warnings; workspace tests green on 20.04 native (no Docker prerequisite — D18's whole point)
6. SDD CEF-NN written from landed behavior; memory synced (D18 risks → findings)

## References

- decisions.md D16/D18 (platform strategy), D12-add3/add4 (cef-rs foundation, contract), D13/D15 (cage, data flow)
- cef-rs dev branch examples (cefsimple/shared/mod.rs verified this session: execute_process bootstrap, Settings.no_sandbox default-true, run_message_loop, shutdown)
- tech-whitepaper §5.4 (OSR deferral context), §6.1 (C ABI discipline — process boundary notes)
