# OmniLet Status

**Generated**: 2026-10-16 (doc-audit refresh) | Phase: 1 fully decided (D1-D8), scaffold next | Branch: master

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
| 2 repo scaffold | done (D10/D11; scaffold-monorepo plan executed) |

## Next steps

1. Continue container-core-wry slice: sandbox.rs (pure, next) → renderer.rs+PolyOrch lane (blocked: webkit2gtk env — Docker/22.04 lane per D16 transitional) → demo-app+manifest → SDD/T3
2. Renderer interface consumers: wry standard slice first (design check for the frozen trait, extension slots expected to gain methods)
3. T2 integration gates as surfaces land (engine-consistency harness, schema golden tests)

## Open items (doc-audit 2026-10-16 register — each with its trigger)

**At scaffold**: G3 DSL/API-surface doc skeleton (docs/dsl-spec.md; rule tables must not become the de-facto spec) · toolchain pins (G2, registered in Next steps) · S3 §4.2 sample-code path-traversal annotation (one-off, with next tech-whitepaper touch)
**At phase-2 modules**: R2 sandbox resource quotas (minimal form with sandbox module) · R3 multi-version retention advanced option · O1 console ops spec (backup/DR/alerting/console authn) · U1 SDK-self upgrade strategy (highest-risk upgrade path of a hot-update product) · G4 SDK health/liveness watchdog
**Standing observations**: finclip-style compliance materials (等保/ISO — at commercial-edition start) · 3-flavor CI macOS-runner cost · mvp-checklist exclusion-list review triggers (any exclusion re-proposal = new decision)

## Archive note

The predecessor project VisiaEngine's full history (Phases, bands, decisions D1-D25, pitfalls, conventions C15-C24, PolyOrch embedding) lives in `.refinfo/VisiaEngine/` (gitignored, read-only, complete — verified 2026-10-16). Its Rust methodology (edit-safety, clippy discipline, wgpu backend lessons) is now directly applicable per D3.
