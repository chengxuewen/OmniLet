# Proposal: container-core-wry

## What

Implement the first real Renderer consumer: a **wry-based standard-mode host** that (1) opens a desktop window (winit), (2) embeds the system WebView (wry) with custom-protocol offline-package loading, (3) implements the frozen `omnilet-render::Renderer` trait as `WryRenderer` (the S-2 design check), and (4) boots a mini-app bundle end-to-end: manifest verify → sandbox init → JS engine boot (rquickjs) → render via the trait. Thin vertical slice: window shows a first frame from a demo bundle.

## Why

S-2 frozen trait needs its first consumer as a design check (D9-1 "the first renderer is the design check; extension slots expected to gain methods"). Container SDK core is the MVP acceptance backbone (mvp-checklist B1/B2/B3 preconditions). This slice also proves the PolyOrch rust face end-to-end with a real crate (scaffold wired the face; no consumer yet). Zero unresolved dependencies (unlike compiler kernel, which awaits dsl-spec finalizations).

## Scope

**In scope**:
- `crates/omnilet-container/`: host lifecycle + Renderer impl + wry WebView integration + custom protocol (offline-dir loading)
- `crates/omnilet-container/src/renderer.rs`: `WryRenderer` — impl of the 3 frozen ops (attach = window handle binding, submit = WebView navigation/eval paint path, report_damage = repaint request) — **extension-slot additions allowed and expected** (recorded as trait-learnings)
- Window layer: winit event loop (invariant ④: host pumps, container never owns a hidden loop) OR tao — see design decision point
- Demo bundle: `examples/demo-app/` (2-3 file mini-app: HTML/CSS/JS touching storage + an API bridge call) + a **hand-written manifest** (schema-conformant, exercising packages/rule-schema)
- JS engine boot: rquickjs minimal embedding (boot + load demo JS + one bridged API) — NOT full sandbox/permissions (later slice)
- B0 prewarm: the binary IS the future dev shell body (load-unpacked-dir switch lands here in minimal form — a `--dir` flag)
- Verification: headless smoke (build + boot + protocol-serving assertions via unit tests) + user-run visual check (B1-style manual verification recorded in testing notes per honesty rule)

**Out of scope**:
- iOS/Android host shells (desktop first; B1 covers them later)
- Full sandbox (permissions/3-layer model), crash-loop/rollback machinery (update slice)
- Web target, WeChat target (compiler slices)
- HMI mode (wgpu renderer — second consumer slice)
- designer/console anything

## Layers Affected

| Layer | Location | Affected |
|-------|----------|----------|
| Shared core | `crates/omnilet-render` | ⚠️ trait learnings: extension slots gain methods (allowed; frozen 3 ops untouched) |
| Backend / services | `crates/omnilet-container` (NEW), `crates/omnilet-jsengine` (NEW, rquickjs boot minimal) | ✅ main work |
| Frontend / UI | `examples/demo-app/` (NEW) | ✅ demo bundle |
| Schema / bindings | `packages/rule-schema` (manifest schema consumed — hand-written manifest validates against it) | ✅ consumption only |

## Existing Specs

- docs/devtools-spec.md §1 (B0 = this binary's future), §2 (dev loop — `--dir` flag is the seed)
- docs/architecture.md §③ (startup data flow: verify→sandbox→boot→render), §⑤ (embedding/thread contract), invariants ①③④⑤
- packages/rule-schema/schema/manifest.schema.json (demo manifest must validate)

## New Specs Needed

- crates/omnilet-container/SDD.md — behavioral contract clauses (CTR-NN series) per project SDD discipline: sandbox boot order, protocol URL mapping, trait-impl contract, JS-bridge surface
- (trait learnings appended to omnilet-render lib.rs docs, not a new spec)

## Risks

- **winit 0.31 beta vs tao 0.37 stable**: winit's latest stable line (0.30) differs from beta 0.31; wry's examples target winit 0.30 — mitigation: pin winit 0.30 stable line unless tao proves simpler (design decision point in design.md, decided at implementation with a spike)
- **wry custom-protocol platform variance**: protocol behavior differs slightly per OS WebView (WebView2 vs WebKitGTK vs WKWebView) — mitigation: Linux (WebKitGTK) is the dev platform here; unit-test protocol mapping logic pure (no webview), one integration smoke on Linux; other-platform verification = B1 later slice
- **trait mismatch discovered mid-slice**: WryRenderer may need methods the frozen 3 don't cover — this is the DESIGNED outcome (extension slots); rule: additions go in `#[doc(hidden)] ext-slot` section, frozen ops untouched, learnings logged
- **rquickjs API surface**: embedding API is compact but async-bridge semantics need care — mitigation: bridge only 2 APIs this slice (storage.get/set via a simple channel), defer async bridging

## Success Criteria

1. `pixi run cargo test --workspace` green: protocol-mapping unit tests + manifest-validation round-trip + sandbox boot order test
2. `pixi run cargo run -p omnilet-container -- --dir examples/demo-app` on Linux: window opens, demo-app renders, storage bridge works (manual visual check — recorded as "T3 human-verified" per honesty rule)
3. `WryRenderer` implements the frozen trait; any added methods live in ext-slot section; trait learnings documented in omnilet-render docs
4. demo-app/manifest.json validates against packages/rule-schema schema (test-enforced)
5. PolyOrch graph: `polyorch_rust_build(TARGET omnilet-container PACKAGE omnilet-container)` wired; full cmake build green
6. clippy -D warnings clean; CI (T1) stays green

## References

- D3 (dual-mode, wry standard), D5 (engine matrix: rquickjs), D9-3 (winit+wry+wgpu), S-2 frozen trait (crates/omnilet-render)
- tech-whitepaper §4.2 (custom protocol), architecture.md §③⑤
- .refinfo/VisiaEngine crate wiring forms (PolyOrch usage precedents)
