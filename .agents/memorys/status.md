# OmniLet Status

**Generated**: 2026-10-20 | Phase: 2 done (D10/D11) + cef-backend slices T1-T6/T8/T9 green | Branch: master (072a12b)

## Overview

| Item | State |
|----|------|
| Project | OmniLet (万应) — multi-end light-app container platform ("compile-time multi-end + runtime container"); definition = docs/whitepaper.md v1.0 (D2) |
| Tech stack | **Engine/container = Rust** (D3): standard mode = CefBackend Linux (D18) + wry win/mac (winmac-wry slice); self-built GPU HMI mode (skia-safe/vello + wgpu + taffy), rquickjs/rusty_v8 logic layer, C ABI host integration. Compile-side stack: compiler = table-driven + kernel-replaceable (Babel v1 → SWC v2), MVP targets = WeChat/Web/own-container, monorepo (D5); console = TS full-stack (Node+React+PostgreSQL, monorepo console/), test matrix = 4-tier pyramid + 3 release red-lines (D6) |
| Docs | whitepaper v1.0 + tech-whitepaper V4.0 + architecture v0.2 + reference/ (11 profiles) + test-matrix.md (D6) + crates/omnilet-container/SDD.md (CEF-01..08 boot/serving/OSR contract lane) |
| Source | live workspace: crates/ (contract/render/webview/patch/channel/jsengine/cage/protocol/omnilet-cef/omnilet-container/omnilet-cli …) — cef slices green (lifecycle example rc=0 pixel-proof, container --dir smoke); PolyOrch submodule + CMake assembly (D7) |
| Agent toolchain | ported and neutralized from VisiaEngine (D1); rules/rust/ + rust-analyzer now CORRECT per D3; archive at `.refinfo/VisiaEngine/` |

## Phase status

| Phase | State |
|-------|:----:|
| -1 config bootstrap (toolchain port + neutralization) | done (D1) |
| 0 project definition (whitepaper + architecture baseline) | done (D2) |
| 1 engine stack decision (Rust dual-mode) | done (D3) |
| 1b compile-side + console + test-matrix decisions | done (D5 + D6) |
| 2 repo scaffold | done (D10/D11; scaffold-monorepo plan executed) |
| 3 cef-backend slices (T1-T6/T8/T9) | green 2026-10-20 (072a12b); T7 expected-blocked (CEF-07) |

## Next steps

1. cef-backend plan COMPLETE (T1-T11; T7 landed same day after D20 ruling A — 6f18578). Next slices open: binary-envelope perf / winmac-wry / HMI-Renderer consumer contract / compile-side first slices (D5 轨道启动)
2. T7 bridge lane LIVE (D20-A, 6f18578: facade render-local, hits=3 echo=true); eval result-channel stays T7+ event-surface extension
3. Renderer interface consumers: winmac-wry slice (D18: wry-Linux retired; win/mac keep wry)
4. Post-T7 slice candidates: binary-envelope perf measurement (mvp-checklist) / HMI-Renderer consumer contract check / doc-audit quick pass

## Open items (doc-audit 2026-10-16 register — each with its trigger)

**At scaffold**: G3 DSL/API-surface doc skeleton (docs/dsl-spec.md; rule tables must not become the de-facto spec) · toolchain pins (G2, registered in Next steps) · S3 §4.2 sample-code path-traversal annotation (one-off, with next tech-whitepaper touch)
**At phase-2 modules**: R2 sandbox resource quotas (minimal form with sandbox module) · R3 multi-version retention advanced option · O1 console ops spec (backup/DR/alerting/console authn) · U1 SDK-self upgrade strategy (highest-risk upgrade path of a hot-update product) · G4 SDK health/liveness watchdog
**Standing observations**: finclip-style compliance materials (等保/ISO — at commercial-edition start) · 3-flavor CI macOS-runner cost · mvp-checklist exclusion-list review triggers (any exclusion re-proposal = new decision)

## Archive note

The predecessor project VisiaEngine's full history (Phases, bands, decisions D1-D25, pitfalls, conventions C15-C24, PolyOrch embedding) lives in `.refinfo/VisiaEngine/` (gitignored, read-only, complete — verified 2026-10-16). Its Rust methodology (edit-safety, clippy discipline, wgpu backend lessons) is now directly applicable per D3.
