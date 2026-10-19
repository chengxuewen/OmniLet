# Proposal: scaffold-monorepo

## What

Create the OmniLet monorepo skeleton (crates/ + compiler/ + runtime/ + packages/ + console/ per D5-4) with toolchain pins (doc-audit G2), wire rust+node faces into the standing PolyOrch assembly (D7), and land the G3 spec skeletons (dsl-spec.md with ecosystem stance + devtools-spec.md). Every directory born into the PolyOrch build graph. Zero business logic — structure, pins, wiring, and spec skeletons only.

## Why

Phase 1 (all decisions D1-D10) is complete with zero open adjudications; scaffold is the recorded next step (status.md Next steps #1). The build orchestrator (PolyOrch @5945f2a, D7) and its assembly skeleton already stand — scaffold wires consumers into the graph so each subsequent slice (compiler kernel, container SDK core, B0 shell) is born into a working build. Toolchain pins are a registered obligation (G2: same commit as build-graph wiring).

## Scope

**In scope**:
- Monorepo directory skeleton + workspace manifests (Cargo.toml workspace with placeholder member crates; pnpm-workspace.yaml + root package.json with engines/packageManager pins)
- pixi.toml + pixi.lock (D11 pixi single-source: rust+node+pnpm; G2 fulfilled in stronger form)
- PolyOrch faces wiring: polyorch_rust_setup + node face into cmake/OmniLetPolyOrch.cmake (uncomment/extend the D7 placeholders); add_subdirectory lanes for crates/
- G3 skeletons: docs/dsl-spec.md (Vue-like template per D10-1, ecosystem stance line per D9-2, negative-list format per Lynx precedent, types-as-codegen requirement) + docs/devtools-spec.md (B0 shell spec per D9-1: load-unpacked + watch + CDP)
- CI skeleton: path-filtered pipeline config (crates/** → cargo test+clippy; compiler|runtime|packages/** → vitest) per test-matrix T1
- S-2 Renderer interface freeze: the trait definition lives in the first real crate (crates/omnilet-render-trait or similar per design.md) — skeleton crate with trait only, compile-verified

**Out of scope** (each lands with its own slice/decision):
- Any business logic: compiler kernel, runtime shims, container SDK core, B0 implementation
- DSL syntax details beyond the skeleton (template directive inventory grows with A1-A4)
- pixi face, python face (D7: no consumers)
- Console implementation (only the console/ dir + package.json placeholder)
- mvp-checklist B0 implementation (only its spec: devtools-spec.md)

## Layers Affected

| Layer | Location | Affected |
|-------|----------|----------|
| Shared core | `crates/` (new; first member = render-trait crate per S-2) | ✅ skeleton + trait |
| Backend / services | `compiler/`, `runtime/`, `packages/`, `console/` (new; pnpm workspace members, placeholder manifests) | ✅ manifests only |
| Frontend / UI | none yet (B0 shell is a later slice) | ❌ |
| Schema / bindings | `docs/dsl-spec.md`, `docs/devtools-spec.md` (G3 skeletons) | ✅ spec text |

**Greenfield note**: no source exists anywhere; this proposal creates the initial structure (the tree probe IS the answer: nothing to integrate with).

## Existing Specs

None — `openspec/specs/` does not exist (greenfield). This change creates the first spec skeletons under docs/ (dsl-spec, devtools-spec) per G3's routing; the openspec/specs/ SDD layer starts with the first implementation slice (compiler kernel).

## New Specs Needed

- docs/dsl-spec.md (skeleton): template syntax (Vue-like per D10-1), ecosystem stance header (D9-2), negative-list format (Lynx style), types-as-codegen note, compat-matrix placeholder
- docs/devtools-spec.md (skeleton): B0 = standard-mode host as dev shell (load-unpacked-dir + watch hot-reload + CDP port per D9-1/D9-3 winit+wry+wgpu)

## Risks

- **PolyOrch face wiring API mismatch**: the D7 placeholders were written against the predecessor's usage; actual polyorch_rust_setup/polyorch_node signatures may differ — mitigation: read PolyOrch/cmake modules first (they are in-tree, vendor-visible), adapt before wiring
- **Version pin choices without code**: pins must reflect "what the code will need" — mitigation: pin current stable + document the basis in commit message; revisiting pins = trivial file edit (not a decision)
- **Empty-crate CMake wiring**: add_subdirectory on a crate with no CMakeLists of its own — mitigation: follow predecessor's PolyOrchRustHelpers usage exactly (cargo targets are wired through polyorch_rust_build, not add_subdirectory; lanes only for C/C++ consumers)
- **S-2 trait over-design**: freezing a Renderer interface with zero renderers implemented — mitigation: freeze only what D3/D9 evidence requires (Hippy Driver/DOM/Renderer + glass-easel multi-backend shape), mark extension slots, let first renderer (wry standard) be the design check

## Success Criteria

1. `cmake --preset default && cmake --build --preset default` (or equivalent direct cmake invocation) configures AND builds the full graph: PolyOrch + rust face (placeholder crate compiles via cargo) + node face (placeholder packages install via pnpm)
2. `cargo clippy --workspace -- -D warnings` and `cargo test --workspace` pass (placeholder crate trivially green — the gate is wired, not the logic)
3. `pnpm -r test` passes (placeholder packages trivially green)
4. rust-toolchain.toml + engines/packageManager pins present and honored (ci-quality: building uses pinned versions)
5. docs/dsl-spec.md + docs/devtools-spec.md skeletons exist with the mandated headers (stance, negative-list format, B0 spec)
6. mvp-checklist G3 registered items closed; status.md Phase 2 = in progress

## References

- decisions.md D5 (monorepo layout, table-driven compiler), D6 (console stack, test matrix), D7 (PolyOrch), D9 (B0, ecosystem stance, winit+wry+wgpu), D10 (DSL syntax, static WXML)
- docs/test-matrix.md (T1 gates), docs/mvp-checklist.md (acceptance hierarchy), docs/architecture.md §② (module dependency law)
- .refinfo/VisiaEngine/cmake/* (PolyOrch usage precedents), PolyOrch/cmake/* (helper modules, in-tree)

## Adjudication record (2026-10-19, user-adjudicated one by one)

| # | Point | Ruling | Note |
|---|-------|--------|------|
| 1 | Renderer trait freeze depth | **A: skeleton freeze** — layered traits + 3 core ops (attach/submit/report-damage) + explicit `#[doc]` extension slots | ~50-line lib.rs, user-signed; first renderer (wry slice) teaches details via extension slots; the 3 frozen ops are ABI-level |
| 2 | manifest JSON Schema day-one | **A: yes** — packages/rule-schema/schema/manifest.schema.json as first real schema content (D8-1 fields, machine contract) + smoke validation test | prose→contract translation happens now, not at code time; feeds types-as-codegen (D9) |
| 3 | CI red-probe ("bite test") | **A: yes** — deliberate break on a branch → pipeline must go red → revert; record the evidence | mandatory per testing.md honesty rule; closes task Phase 4 |

## D11 amendment (2026-10-19, mid-apply): environment route = pixi single-source

Phase 1 discovered rustc/cargo absent on host. User ruled pixi single-source (D11): pixi.toml at root (rust 1.85.x conda-forge + nodejs + pnpm), pixi.lock committed, PolyOrch rust face = FROM pixi. rust-toolchain.toml dropped from plan (pixi.lock supersedes as the pin mechanism). Executor note: all build/test commands go through `pixi run`.
