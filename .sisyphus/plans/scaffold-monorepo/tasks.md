# Tasks: scaffold-monorepo

## Phase 1: Toolchain pins + workspace roots (G2 obligation — one commit with Phase 2 wiring)

- [x] **Create pixi.toml/pixi.lock + root Cargo.toml workspace** (D11 route; rust-toolchain.toml superseded)
  - File: `rust-toolchain.toml`, `Cargo.toml`
  - Verify: `cargo metadata --no-deps > /dev/null && echo ok` (workspace resolves, zero members yet is fine)
- [x] **Create pnpm-workspace.yaml + root package.json with engines/packageManager pins**
  - File: `pnpm-workspace.yaml`, `package.json`
  - Verify: `pnpm -v && node --version` honored per pins; `pnpm install` green (empty workspace)

## Phase 2: PolyOrch faces wiring (read-first discipline)

- [x] **Read PolyOrch helper signatures before wiring** (pixi_setup at PixiHelpers:327, rust_setup at FindRust:989) (proposal risk #1 mitigation)
  - File: `PolyOrch/cmake/PolyOrchRustHelpers.cmake`, `PolyOrchNodeHelpers.cmake`, + `.refinfo/VisiaEngine/cmake/VisiaEnginePolyOrch.cmake` (usage precedents)
  - Verify: signature notes recorded in the wiring commit message
- [x] **Wire rust face + node face into OmniLetPolyOrch.cmake + CMakeLists lanes** (configure probe + breakage probe passed)
  - File: `cmake/OmniLetPolyOrch.cmake`, `CMakeLists.txt`
  - Verify: `cmake -S . -B build && cmake --build build` green with zero members (faces configure, no targets yet) + breakage probe: temporarily hide one face → configure names it (edit-safety #23 form)

## Phase 3: Placeholder members (born into the graph)

- [x] **S-2 Renderer trait crate** (USER-SIGNED; skeleton freeze; bite-tested) (scaffold day-one decision, evidence: Hippy Driver/DOM/Renderer + glass-easel shapes)
  - File: `crates/omnilet-render/Cargo.toml`, `crates/omnilet-render/src/lib.rs` (SKELETON per adjudication 1: layered + 3 ops + extension slots, ~50 lines)
  - Verify: `cargo clippy -p omnilet-render -- -D warnings && cargo test -p omnilet-render` (trait object-safety test = first test)
- [x] **compiler/ runtime/ packages/rule-schema/ console/ placeholder packages** (manifest v1 schema = first real content, 5 contract tests green)
  - File: `<dir>/package.json` + one vitest smoke test each; `packages/rule-schema/schema/manifest.schema.json` = FIRST REAL CONTENT per adjudication 2 (D8-1 fields as machine contract + validation smoke)
  - Verify: `pnpm -r test` all green
- [x] **Full-graph build verification**
  - Verify: clean-tree `cmake -S . -B build && cmake --build build` → cargo compiles crate + pnpm members resolve (the proposal's Success Criterion #1)

## Phase 4: CI skeleton (T1 gates)

- [x] **Path-filtered CI config** (+bite-test: clippy red 101 on probe, green 0 clean)
  - File: `.github/workflows/ci.yml`
  - Verify: local mirror — run the same three commands the CI would run (clippy/test/pnpm test); CI syntax `act`-style dry check or manual YAML lint; red-line probe: introduce a deliberate clippy warning on a branch → CI red (gate bites, testing honesty rule)

## Phase 5: G3 spec skeletons + memory sync

- [x] **docs/dsl-spec.md skeleton**
  - Content: ecosystem stance header (D9-2), Vue-like grammar sketch (D10-1), negative-list format + first entries, types-as-codegen note, compat-matrix placeholder
  - Verify: docs/AGENTS.md conventions check (§-reference style); links from AGENTS.md WHERE-TO-LOOK updated (+2 rows: dsl-spec, devtools-spec)
- [x] **docs/devtools-spec.md skeleton**
  - Content: B0 = winit+wry+wgpu host (D9-3), three switches, automator-driver contract sketch
  - Verify: same
- [x] **Memory sync (C9)**
  - File: `.agents/memorys/status.md` (Phase 2 in-progress, scaffold done checklist), `decisions.md` (S-2 trait freeze recorded as D11 after user reviews trait shape), `pitfalls.md` (any wiring gotchas hit)
  - Verify: doc-audit quick checks (instructions paths, numbering) pass

## Notes for executor

- Executor = Sisyphus-Junior with `source-driven-development` + `incremental-implementation` skills loaded
- PolyOrch/ is a submodule: NEVER commit inside it; wiring reads it, does not modify it
- Version pins: measure current stable at execution time; record the basis in the Phase-1 commit message (G2 form)
- The trait freeze (S-2) is a USER-REVIEWED artifact: present the trait shape to the user before marking Phase 3 first task complete (D10-era discipline: interface freezes get explicit sign-off)
