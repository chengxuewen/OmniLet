# Tasks: container-core-wry

## Phase 1: Window-layer spike (decide winit vs tao with evidence)

- [ ] **Spike: minimal window + wry embed + resize + clean exit**
  - File: scratch under `crates/omnilet-container/src/` (throwaway branch or temp file)
  - Verify: spike runs; count glue LOC; record verdict in SDD.md §window-layer (winner + reason)
  - Rule: loser recorded; D9-3 literal = winit unless tao demonstrably simpler

## Phase 2: Pure logic first (TDD-friendly, no webview needed)

- [ ] **protocol.rs: URL ↔ offline-dir mapping (pure)**
  - File: `crates/omnilet-container/src/protocol.rs`
  - Verify: unit tests — normal mapping, missing file → miss result, **traversal attacks (../, /abs, %2e%2e) rejected** (schema-test lesson applied)
- [ ] **sandbox.rs: boot-order state machine (pure-ish)**
  - File: `crates/omnilet-container/src/sandbox.rs`
  - Verify: unit test — verify→init→spawn order enforced; manifest-shape failure short-circuits fail-closed with actionable error
- [ ] **omnilet-jsengine: rquickjs minimal boot**
  - File: `crates/omnilet-jsengine/src/lib.rs`
  - Verify: unit test — engine eval round-trip + 2-API bridge registration (storage get/set via channel)

## Phase 3: Renderer impl (the S-2 design check)

- [ ] **WryRenderer: impl omnilet_render::Renderer**
  - File: `crates/omnilet-container/src/renderer.rs`
  - Verify: `cargo test -p omnilet-container` — impl compiles against frozen trait; add a stub-backend test (renderer constructible without a real window, using a mock surface payload)
  - Record: any ext-slot additions → omnilet-render docs; frozen 3 ops untouched (assert by diff review)

## Phase 4: Wire the host binary + demo bundle

- [ ] **main.rs: arg parse (--dir), bootstrap, event loop (host pumps per invariant ④)**
  - File: `crates/omnilet-container/src/main.rs`, `host.rs`
  - Verify: binary smoke tests — `--help` rc 0; `--dir` missing-manifest rc 1 + message (scripted)
- [ ] **examples/demo-app: 3-file mini-app + hand-written manifest.json**
  - File: `examples/demo-app/{index.html,app.css,app.js,manifest.json}`
  - Verify: manifest validates against packages/rule-schema schema (test in packages/rule-schema or container test reads it) — a test asserts the demo manifest is schema-valid
- [ ] **PolyOrch lane: polyorch_rust_build for the binary**
  - File: root `CMakeLists.txt`
  - Verify: `cmake -S . -B build && cmake --build build` builds the container binary through the rust face (breakage probe: break the crate → cmake build names it)

## Phase 5: Verification + honest reporting + memory

- [ ] **T3 human-verified run: window + render + storage bridge**
  - Verify: manual run recorded with exact command + observed behavior (honesty rule: label "T3 human-verified", do NOT claim automated coverage)
- [ ] **SDD.md CTR-NN clauses written from the landed behavior**
  - File: `crates/omnilet-container/SDD.md`
- [ ] **test-matrix.md T1 rows updated; CI green; memory sync (C9)**
  - File: `docs/test-matrix.md`, `.agents/memorys/{status,decisions,pitfalls}.md`
  - Verify: clippy -D warnings + cargo test --workspace + pnpm -r test all green; CI config covers the new crate (crates/** filter already matches)

## Notes for executor

- Executor = Sisyphus-Junior with `incremental-implementation` + `source-driven-development` (wry/winit/rquickjs APIs: verify against docs, don't guess)
- Invariant ④ discipline: the container NEVER builds its own hidden event loop; the host (main.rs) owns the loop and pumps the container
- Frozen-trait discipline: adding impl methods is allowed (extension slots); CHANGING the 3 frozen ops requires a user ruling (they are ABI-level)
- PolyOrch: crates are wired via `polyorch_rust_build`, not add_subdirectory (scaffold task-3 finding)

## Status checkpoint (2026-10-19)

- [x] protocol.rs → promoted to own crate `omnilet-protocol` (GTK-free pure logic, 4/4 green incl. traversal attacks; fixture race fixed per-test dirs)
- [x] jsengine boot + bridge responder (3/3 green; MSRV pin rquickjs=0.11; bindgen dropped)
- [x] NEW (D15): `omnilet-patch` contract crate (key-path + JSON envelope + latest-wins merge, 3/3 green)
- [x] NEW (D15): `omnilet-channel` contract crate (seq downlink / view_seq uplink / coalescing buffer, 3/3 green)
- [x] container main.rs: arg skeleton + fail-closed --dir manifest check (3 real tests via run(args)); **wry dep deferred to renderer.rs landing** (D16 transitional: this host 20.04 lacks webkit2gtk-4.1; CI unaffected until wry returns)
- [ ] sandbox.rs boot-order state machine (next pure task; manifest shape via omnilet-patch types)
- [ ] renderer.rs WryBackend impl + wry dep return — BLOCKED on webkit2gtk env (Docker/22.04 lane; task 1 spike also blocked)
- [ ] demo-app + manifest sample (validates against rule-schema JSON)
- [ ] PolyOrch lane for container bin (with wry return)
- [ ] SDD.md clauses + memory sync + T3 human verification

## D18 rebranch note (2026-10-19)
wry-dependent tasks (spike/renderer.rs/wry-dep-return/PolyOrch-wry-lane) PARKED → belong to future winmac-wry slice.
Still in play here (backend-agnostic): sandbox.rs boot-order, demo-app+manifest, SDD clauses, T3/T4 verification framing.
CEF implementation continues as its own slice: /openspec-propose cef-backend.
