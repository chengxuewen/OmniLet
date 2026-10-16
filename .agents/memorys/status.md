# OmniLet Status

**Generated**: 2026-10-16 | Phase: 1 stack decided (engine side), compile-side stack open | Branch: main (zero commits)

## Overview

| Item | State |
|----|------|
| Project | OmniLet (万应) — multi-end light-app container platform ("compile-time multi-end + runtime container"); definition = docs/whitepaper.md v1.0 (D2) |
| Tech stack | **Engine/container = Rust** (D3): wry standard mode + self-built GPU HMI mode (skia-safe/vello + wgpu + taffy), rquickjs/rusty_v8 logic layer, C ABI host integration. Compile-side stack (multi-end compiler impl, console, CI) still open → D5 |
| Docs | docs/whitepaper.md (v1.0, product) + docs/tech-whitepaper.md (V4.0, engine tech) + docs/architecture.md (v0.2, 6 invariants — ③ now carries reference-library evidence) + docs/reference/ (11 competitor profiles, snapshot 2026-10-16) |
| Source | none yet (only agent toolchain + codegraph MCP bridge) |
| Agent toolchain | ported and neutralized from VisiaEngine (D1); rules/rust/ + rust-analyzer now CORRECT per D3; archive at `.refinfo/VisiaEngine/` |

## Phase status

| Phase | State |
|-------|:----:|
| -1 config bootstrap (toolchain port + neutralization) | done (D1) |
| 0 project definition (whitepaper + architecture baseline) | done (D2) |
| 1 engine stack decision (Rust dual-mode) | done (D3) |
| 1b compile-side stack decision (compiler impl, console, CI, testing) | pending (D5) |
| 2 repo scaffold (cargo workspace + crate map per architecture.md) | pending |

## Next steps

1. **D5: compile-side stack** — multi-end compiler implementation (Babel/SWC/self-built AST), console stack, monorepo/CI layout, test matrix (C1 format per candidate). Evidence ready: docs/reference/{uniapp,taro,chameleon}.md compiler-pipeline sections + docs/architecture.md §⑦ open rows
2. First commit (toolchain port + neutralization + docs is a natural first commit surface)
3. After D5: scaffold cargo workspace per architecture.md module map (container SDK core → wry standard slice first)

## Archive note

The predecessor project VisiaEngine's full history (Phases, bands, decisions D1-D25, pitfalls, conventions C15-C24, PolyOrch embedding) lives in `.refinfo/VisiaEngine/` (gitignored, read-only, complete — verified 2026-10-16). Its Rust methodology (edit-safety, clippy discipline, wgpu backend lessons) is now directly applicable per D3.
