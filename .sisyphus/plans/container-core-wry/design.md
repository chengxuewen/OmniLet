# Design: container-core-wry

## Architecture

```text
crates/
├── omnilet-container/          # NEW — host binary + Renderer impl
│   ├── src/main.rs             # entry: args (--dir), window bootstrap, event loop (host pumps)
│   ├── src/host.rs             # window surface management (winit), event → container pump
│   ├── src/renderer.rs         # WryRenderer: impl omnilet_render::Renderer (S-2 check)
│   ├── src/protocol.rs         # custom-protocol URL ↔ offline-dir file mapping (PURE, unit-tested)
│   ├── src/sandbox.rs          # minimal boot order: manifest verify → env init → engine spawn
│   └── SDD.md                  # CTR-NN behavioral clauses
├── omnilet-jsengine/           # NEW — rquickjs boot (minimal; sandbox full = later slice)
│   └── src/lib.rs              # engine_new() → eval(script) → bridge registrar (2 APIs this slice)
└── omnilet-render/             # EXISTS — frozen trait; ext-slots may gain methods (learnings)
examples/demo-app/              # NEW — 3-file mini-app + hand-written manifest.json
```

Data flow (first frame):
```
main(--dir) → manifest verify (schema-shape check, sig placeholder) → sandbox init
  → winit event loop (host owns) → WryRenderer::attach(window handle)
  → wry webview bounds to surface; custom protocol "omnilet://" → protocol.rs maps to dir
  → rquickjs boot → demo JS runs → bridge call (storage.set) → JS calls setData
  → [this slice: direct navigation/eval paint via submit()] → first frame visible
```

## Window-layer decision point (spike at implementation start)

| | winit 0.30 (stable line) | tao 0.37 |
|---|---|---|
| wry compatibility | wry's own examples target winit | same lineage (wry's sibling from Tauri) |
| maturity | widest community | stable, Tauri production |
| D9-3 ruling says "winit+wry+wgpu" | ✓ literal | tao was implicitly permitted ("winit 的 fork... 二选一即可" — D9-3 discussion) |

**Spike verdict rule**: whichever passes wry-embed + resize + clean-exit spike first with less code wins; loser recorded with reason. D9-3 literal reading favors winit; tao is the documented fallback (one-line amendment if tao wins).

## Files to Touch

### Create
| File | Purpose |
|------|---------|
| `crates/omnilet-container/Cargo.toml` | deps: omnilet-render, omnilet-jsengine, winit|tao (spike), wry 0.57, rquickjs (via omnilet-jsengine), serde/serde_json (manifest) |
| `crates/omnilet-container/src/{main,host,renderer,protocol,sandbox}.rs` | as architecture above |
| `crates/omnilet-container/SDD.md` | CTR-01.. : boot order, protocol mapping purity, trait impl contract, bridge surface |
| `crates/omnilet-jsengine/Cargo.toml` + `src/lib.rs` | rquickjs minimal: Engine::new, eval, register-bridge (sync 2-API) |
| `examples/demo-app/{index.html,app.css,app.js,manifest.json}` | demo mini-app; manifest hand-written per manifest.schema.json |
| root `Cargo.toml` | members already glob crates/* — no change needed (verified pattern works) |

### Modify
| File | Change |
|------|---------|
| `crates/omnilet-render/src/lib.rs` | ONLY ext-slot additions (if WryRenderer needs them); frozen 3 ops untouched; learning notes in doc comments |
| root `CMakeLists.txt` | + polyorch_rust_build(TARGET omnilet-container PACKAGE omnilet-container BINARY) lane |
| `docs/test-matrix.md` | T1 rows += container unit gates (after landing) |
| `packages/rule-schema` | no change (consumed via test: demo manifest validates) |

## Integration Points

- **S-2 trait**: WryRenderer implements `omnilet_render::Renderer`; attach() receives SurfaceHandle(Box<Any>) carrying winit's window handle (downcast inside container — platform payload ownership documented)
- **manifest schema**: sandbox.rs verifies demo manifest against the SHAPE (a Rust-side structural check; full JSON-schema runtime = later slice; the canonical validation stays in packages/rule-schema tests)
- **PolyOrch graph**: rust face builds the binary crate (BINARY flag) — first real consumer of the face wired at scaffold

## Stack Specifics

- wry 0.57 (MSRV 1.85 ✓ pixi rust 1.85.1); custom protocol via `WebViewBuilder::with_custom_protocol`
- winit/tao spike: measure lines-of-glue for (window+handle-extraction+resize+close); pick lower, record
- rquickjs: sync bridge only (mpsc channel to host for storage; async bridging deferred — recorded in SDD as CTR-07)
- Error model: thiserror for container errors; anyhow NOT used in lib crates (rules/rust), main.rs may use anyhow Context

## Error Handling

- Manifest verify failure → exit(1) with actionable message (file, schema rule violated) — fail-closed rehearsal for invariant ⑤
- Protocol miss (file not found in offline dir) → 404-shaped response, logged (audit-log seed)
- WebView init failure → RenderError::AttachFailed variant

## Testing Strategy

- [x] Unit (T1): protocol.rs mapping table (pure) — URL parse → path resolve → traversal-guard (reuses the schema test lesson: ../ attacks); sandbox boot-order state test; manifest structural check test
- [x] Integration (T1): full-graph cmake build; cargo test -p omnilet-container
- [ ] E2E-ish: binary smoke `--help` exits 0; `--dir` with missing manifest exits 1 with message (scripted, in CI-able form)
- [ ] Human (T3 honesty): window opens + renders + storage bridge visible effect — user runs it, recorded "T3 human-verified" (cannot automate the pixel truth this slice)

## Dependencies

- New Rust deps: wry 0.57, winit 0.30 OR tao 0.37 (spike), rquickjs (pin current), serde, serde_json, thiserror
- Constraint: all through pixi env (D11); clippy -D warnings from first commit

## Appendix: WebViewBackend interface (user-adjudicated 2026-10-19, 3 cards — see decisions.md D12 addition 4)

Ten methods / four layers frozen; WebViewParent = S-2 SurfaceHandle pocket type with documented RWH-payload convention; bridge = sync register + FnOnce responder. Security hooks (set_request_filter / set_navigation_policy) are D8-3's trait-level enforcement points — the whitelist has no home without them.
