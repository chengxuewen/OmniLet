# Tasks: cef-backend

## Phase 0: Spike (reality check on THIS 20.04 host — D18's premise)

- [x] **T1 build chain end-to-end** ✅ pixi gtk3/cmake/ninja + cef-rs 154 full-chain green on 20.04 (rust bumped 1.97 via lock migration — ecosystem MSRV)
  - Add cef="154" + winit="0.30" to omnilet-container; `pixi run cargo check -p omnilet-container`
  - Verify: download-cef fetches distro, cef-sys assembles via pixi cmake/ninja, check green. Record: download size/time, any pkg-config misses (→ pixi additions). If glibc floor breaks → STOP, report (older-CEF-pin decision).
- [x] **T2 first-frame probe** ✅ SPIKE-RESULT painted=true nonblack=1924 (headless software OSR, zero X; four boot landmines → SDD CEF-01/02)
  - Minimal main: init CEF (no-sandbox), create_browser windowless → OnPaint → write PNG; assert file exists + non-black pixels (pure-fn sample check, minimal gate form). Optional X11 window variant if DISPLAY available.
  - Verify: PNG proof committed to spike notes (path noted, file itself throwaway); zombie-process check after shutdown (ps count)
- [x] **T3 runtime dependency census** ✅ ldd-clean on 20.04 (30+ libs, desktop base satisfies; minimal-image list → CEF-04)
  - ldd the running CEF stack; missing shared libs → pixi.toml additions; SDD records the final runtime set. no-sandbox posture stated in SDD (our security = omnilet layer).

## Phase 1: Contract skeleton (pure, testable without window)

- [x] **T4 CefBackend ten-method skeleton + pump design note** ✅ crate omnilet-cef (extraction learning: engine=lib crate); contract extension slots FIRST ENTRIES pump_drive/pump_timeout (D18-predicted contract check #1)
  - File: src/cef/mod.rs (methods stubbed, types real), pump.rs sketch (timeout math + wakeup channel)
  - Verify: compiles; omnilet-webview contract mock-suite passes against stubs (type-level proof the contract is implementable)
- [x] **T5 create/resize/destroy real (OSR lane)** ✅ cef_lifecycle example green (painted=true, pure-contract API); real-window variant = winmac lane; OSR invalidate+view_rect resize = osr-example mechanism; destroy via host.close_browser(1)
  - WindowInfo from WebviewParent winit-window payload; SetBounds on resize; destroy closes browser, loop exit clean
  - Verify: T2 probe upgraded to winit window (X11) if display available; headless: unit-assert lifecycle order errors (submit-before-attach analog)

## Phase 2: Loading + bridge (contract flesh)

- [x] **T6 omnilet:// scheme handler via omnilet-protocol** ✅ scheme-flags boot registration + manager directory provider + RRH pass-through counter; lifecycle example painted=true offline_served=1; SDD CEF-06 (string-type archaeology footnote recorded to stop re-tripping). 2026-10-20 upgrade: sync memory handler serving (PIT-1/PIT-2 root-caused), pixel终态 green=true pixel=(0,170,68), CEF-08 gpu-compositing 开关入 boot
  - resource.rs registers scheme (browser-process once) + per-browser handler serves via `resolve()`; miss → 404 + audit line
  - Verify: unit tests (resolve mapping reuses protocol crate's 4 green tests as source truth); integration: demo HTML loads via omnilet:// (T2 harness extended)
- [~] **T7 eval + register_bridge (message_router adapter, D17 naming)** — PARTIAL, BLOCKED-BY-CEF-BEHAVIOR (SDD CEF-07): registry+dispatcher+responder+browser-side receive all wired & compiling; render-side JS injection lane switched to self-protocol route (frame-execute dead in this combo; process messages + render-local eval verified alive). Acceptance flips green when injection leg lands (V8 factory or fetch-bridge fallback).
  - bridge.rs: JS omnilet.storage.get/set ⇄ cef message_router ⇄ BridgeRequest/Responder ⇄ omnilet-jsengine channel (same StorageRequest plumbing)
  - Verify: round-trip test: demo JS calls storage.set → rquickjs side StorageRequest received → responder answers → JS-visible callback fires (headless-capable via windowless browser + eval assertion)

## Phase 3: Cage + wiring (security hooks armed)

- [x] **T8 set_request_filter + set_navigation_policy (D13 defaults)** ✅ cage.rs decide_navigation/resource/popup + audit（4 unit 绿）；OfflineRh on_before_browse 接线（block=1+audit line）
  - handler.rs: subframe/resource requests → single-point filter (registered RequestFilter); popup open → deny+audit; top-nav off-list → block+audit (D13-2 cage table lives HERE first)
  - Verify: pure-decision unit tests (allow/block/audit-row) + one live check: page trying window.open → denied (JS-side sees nothing; audit log has line)
- [x] **T9 container main → real `--dir` path** ✅ fail-closed manifest 检查 + headless load-and-prove；实测 `--dir examples/demo-app` → LOADED painted served=1, rc=0（2026-10-20）
  - Replace stub: demo-app loads, first frame, one bridge round-trip on launch; `--help` unchanged
  - Verify: scripted smoke (windowed manual = T3-honesty note; headless CI: --dir validation tests exist already, extend with render proof flag)
- [x] **T10 PolyOrch lane + gates** ✅ 2026-10-20: `polyorch_rust_build(omnilet-container-exe BINARY, BASE_DIR=target 复用缓存)`；PIT-13 guard 首拦（handle≠artifact base）；破坏探针闭环（断 CefBackend::boot → rc=101 点名 boot_BROKEN_PROBE + FAILED 指产物；恢复复绿）；cmake 产物 `--dir` 冒烟 LOADED rc=0。发现记录进 CMakeLists 注释：host-layer cargo 规则触发粒度=MANIFEST（src-only 改动不触发），gate 全走 cargo
  - CMakeLists: polyorch_rust_build B omnilet-container; clippy -D warnings workspace (now incl. cef crate); test-matrix T1 rows still green
  - Verify: `cmake --build` builds bin through rust face (breakage probe: break CEF call → cmake names it)

## Phase 4: Docs + memory

- [ ] **T11 SDD CEF-01.. clauses + memory sync**
  - SDD from landed behavior (pump contract/scheme/bridge/cage/crash-domain); decisions.md: T1-T3 findings (glibc, runtime set, pump numbers) + any contract-extension-slot additions recorded as evidence; status.md next-slice (binary envelope perf / winmac-wry / HMI-Renderer consumer); dsl-spec §9 note: capability word first lands = storage
  - Verify: doc-audit quick paths (instructions, refs); report

## Executor notes
- source-driven: cef-rs API read from vendored source/examples per task (no from-memory coding — #22 discipline)
- every T* commits with its verification output quoted (ponytail: no unverified done)
- pixel/pump numbers land in SDD notes, not folklore
