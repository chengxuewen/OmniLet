# Design: scaffold-monorepo

## Architecture

```text
OmniLet/
├── CMakeLists.txt              # EXISTS (D7 assembly skeleton) — extend: faces + lanes
├── cmake/OmniLetPolyOrch.cmake # EXISTS (sentinel) — extend: rust/node wiring functions
├── PolyOrch/                   # EXISTS (submodule @5945f2a) — consumed, never modified
├── rust-toolchain.toml         # NEW: pinned stable toolchain (G2)
├── Cargo.toml                  # NEW: workspace root (members = crates/*)
├── crates/                     # NEW: Rust container/engine side (cargo workspace)
│   └── omnilet-render/         #   first member: Renderer trait freeze (S-2) — trait-only crate
├── pnpm-workspace.yaml         # NEW: packages = compiler/*, runtime/*, packages/*, console
├── package.json                # NEW: root — engines (node) + packageManager (pnpm) pins (G2)
├── compiler/                   # NEW: table-driven compiler (D5) — placeholder package
├── runtime/                    # NEW: @omnilet/runtime shims — placeholder package
├── packages/                   # NEW: shared types/rule-table schema — placeholder package
├── console/                    # NEW: admin console (D6 TS stack) — placeholder package
├── ci/  (or .github/workflows/) # NEW: path-filtered T1 pipeline skeleton
└── docs/
    ├── dsl-spec.md             # NEW skeleton (G3): Vue-like template, ecosystem stance, negative list
    └── devtools-spec.md        # NEW skeleton (G3): B0 shell spec
```

Build graph flow (post-scaffold):
```
cmake (assembly) ──▶ PolyOrch faces ──▶ cargo build (crates, rust face)
                                     └▶ pnpm install/test (compiler/runtime/packages/console, node face)
```

## Files to Touch

### Create
| File | Purpose |
|------|---------|
| `pixi.toml` + `pixi.lock` | **D11 pixi single-source**: rust 1.85.x + nodejs + pnpm (conda-forge); lock committed (G2 fulfilled in stronger form) |
| `Cargo.toml` | workspace root, members = `crates/*`; [workspace.dependencies] for shared deps later |
| `crates/omnilet-render/Cargo.toml` + `src/lib.rs` | S-2 freeze = **skeleton** (adjudication 1): layered traits + 3 core ops (attach/surface / submit(render-commands) / report-damage) + `#[doc]` extension slots; ~50 lines; user-signed; zero backend deps |
| `pnpm-workspace.yaml` | JS workspace declaration |
| `package.json` (root) | engines: {node: >=22}, packageManager: pnpm@<current-major>, private: true |
| `compiler/package.json` (+tsconfig) | placeholder: name @omnilet/compiler, vitest wired, one smoke test |
| `runtime/package.json` | placeholder: name @omnilet/runtime, vitest wired, one smoke test |
| `packages/rule-schema/package.json` + `schema/manifest.schema.json` | **first real content** (adjudication 2): manifest v1 JSON Schema (D8-1 fields) + validation smoke test |
| `console/package.json` | placeholder: name @omnilet/console (no impl — D6 stack lands with console slice) |
| `docs/dsl-spec.md` | G3 skeleton: header = ecosystem stance (D9-2 verbatim); §template = Vue-like grammar sketch (D10-1); §negative-list = format + first entries (dynamic component names); §types = codegen-target note; §compat-matrix = placeholder |
| `docs/devtools-spec.md` | G3 skeleton: B0 = winit+wry+wgpu host (D9-3), three switches (load-unpacked/watch/CDP), automator-driver contract sketch (T2/T3 dependency) |
| CI config (`.github/workflows/ci.yml`) | path filters: crates/** → cargo clippy -D warnings + cargo test; {compiler,runtime,packages}/** → pnpm -r test; docs/** → doc gates |

### Modify
| File | Change |
|------|--------|
| `cmake/OmniLetPolyOrch.cmake` | uncomment + adapt: `polyorch_rust_setup(FROM system)`; add node-face setup call (signature verified against PolyOrch/cmake/PolyOrchNodeHelpers.cmake first) |
| `CMakeLists.txt` | add lanes: crates via rust face (polyorch_rust_build, NOT add_subdirectory — cargo owns it); JS side via node face; remove stale scaffold comments |

### Delete
None.

## Data Flow

Not applicable (no business logic). Build/wiring flow: cmake configure → PolyOrch sentinel (existing) → face setup (rust: toolchain check via polyorch_rust_version_ok; node: engine check) → targets registered → `cmake --build` fans out to cargo (rust face) and pnpm (node face).

## Integration Points

- **PolyOrch faces**: signatures read from in-tree `PolyOrch/cmake/PolyOrchRustHelpers.cmake` / `PolyOrchNodeHelpers.cmake` BEFORE wiring (proposal risk #1 mitigation) — copy usage shapes from `.refinfo/VisiaEngine/cmake/VisiaEnginePolyOrch.cmake` + `VisiaEngineCrates.cmake` (battle-tested forms)
- **Renderer trait (S-2)**: the crate boundary for all future render work; consumers (wry standard slice, wgpu HMI slice) arrive in later slices — trait carries `#[doc]` extension slots so freeze ≠ sealed
- **Rule-table schema** (packages/rule-schema): first JSON schema file = the shape dsl-spec and compiler both cite; golden-file tests (T1) hang off it later

## Stack Specifics

- **Rust**: workspace-level `[workspace]` with resolver = "2"; clippy -D warnings is the T1 gate (rules/rust); edition 2024; crate naming `omnilet-*` (brand law from predecessor D6 form, applied here)
- **TS/Node**: Node ≥22 LTS + pnpm (pin exact at execution); vitest for all JS packages (test-matrix T1); tsconfig strict:true base at root, extended per package
- **CMake**: minimum 3.25 (D7 floor, measured); LANGUAGES CXX at root (PolyOrch platform probe requirement — D7 measured lesson)

## Error Handling

- Configure-time: missing submodule → sentinel FATAL (existing, probe-verified D7); missing toolchain → polyorch face errors with install hint (PolyOrch native behavior)
- CI: any T1 gate red = merge block (test-matrix red-line mechanics; R1/R2/R3 not yet active — no code to violate)

## Testing Strategy

- [x] Unit: placeholder crates/packages carry one trivial test each (proves the harness, not logic) — vitest for JS, cargo test for Rust
- [x] Integration: `cmake --build` full-graph green = the integration test of THIS change
- [x] E2E: none (no product surface)
- [ ] QA gate: `cargo clippy --workspace -- -D warnings` + `pnpm -r test` + cmake build — all three in CI config

## Dependencies

- New (JS): vitest, typescript, @types/node (dev-only; runtime deps = none until compiler kernel slice)
- New (Rust): none beyond toolchain (Renderer trait crate is std-only)
- Schema: none
- **Explicitly forbidden this change**: any renderer backend dep (wry/wgpu/skia) — they arrive with the render slices that consume the trait
