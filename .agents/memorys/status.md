# OmniLet Status

**Generated**: 2026-10-16 | Phase: 1 stack decided (engine side), compile-side stack open | Branch: main (zero commits)

## Overview

| Item | State |
|----|------|
| Project | OmniLet (万应) — multi-end light-app container platform ("compile-time multi-end + runtime container"); definition = docs/whitepaper.md v1.0 (D2) |
| Tech stack | **Engine/container = Rust** (D3): wry standard mode + self-built GPU HMI mode (skia-safe/vello + wgpu + taffy), rquickjs/rusty_v8 logic layer, C ABI host integration. Compile-side stack: compiler = table-driven + kernel-replaceable (Babel v1 → SWC v2), MVP targets = WeChat/Web/own-container, monorepo (D5); console = TS full-stack (Node+React+PostgreSQL, monorepo console/), test matrix = 4-tier pyramid + 3 release red-lines (D6) |
| Docs | whitepaper v1.0 + tech-whitepaper V4.0 + architecture v0.2 + reference/ (11 profiles) + test-matrix.md (D6) |
| Source | none yet (agent toolchain + PolyOrch build orchestrator submodule @5945f2a + CMake assembly skeleton, D7) |
| Agent toolchain | ported and neutralized from VisiaEngine (D1); rules/rust/ + rust-analyzer now CORRECT per D3; archive at `.refinfo/VisiaEngine/` |

## Phase status

| Phase | State |
|-------|:----:|
| -1 config bootstrap (toolchain port + neutralization) | done (D1) |
| 0 project definition (whitepaper + architecture baseline) | done (D2) |
| 1 engine stack decision (Rust dual-mode) | done (D3) |
| 1b compile-side + console + test-matrix decisions | done (D5 + D6) |
| 2 repo scaffold (cargo workspace + crate map per architecture.md) | pending |

## Next steps

1. Scaffold monorepo per D5 layout (crates/ + compiler/ + runtime/ + packages/ + console/) — wire rust/node faces into the standing PolyOrch assembly (D7), each born into the build graph
2. First slice per BS-MVP definition (see decisions D5 series): compiler skeleton (table-driven + Babel kernel v1) OR container SDK core (wry standard) — order TBD at planning
3. Test-matrix T1 layer lands with scaffold (docs/test-matrix.md)

## Archive note

The predecessor project VisiaEngine's full history (Phases, bands, decisions D1-D25, pitfalls, conventions C15-C24, PolyOrch embedding) lives in `.refinfo/VisiaEngine/` (gitignored, read-only, complete — verified 2026-10-16). Its Rust methodology (edit-safety, clippy discipline, wgpu backend lessons) is now directly applicable per D3.
