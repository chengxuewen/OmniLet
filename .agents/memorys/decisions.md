# OmniLet Decisions

> Append-only. Never rewrite historical entries. New entries take the next number (D{n}).
> This store starts at D1 with the config-neutralization surgery itself (the ported agent toolchain predates any project decision).

## Format example

## D<N>: <decision title> (YYYY-MM-DD)

- **Background**: why this came up now, what forced the question.
- **Options**: A / B / C with pros/cons (see C1 format if it was an adjudication).
- **Decision**: what was chosen, by whom (user ruling / agent recommendation accepted).
- **Rationale**: why it wins.
- **Impact**: what it locks, what it unlocks, what must be revisited when.

<!-- Real entries append below. -->

## D1: Ported-config neutralization (VisiaEngine to OmniLet, fresh start) (2026-10-16)

- **Background**: the repo's .agents/.opencode/.omo were ported wholesale from the completed project VisiaEngine (Rust/wgpu rendering engine); ~2000 lines of old-project memory (785-line status.md, D1-D25 decisions, wgpu/render pitfalls, conventions C15-C24) would load into every session and mislead the new project. This repeats the exact situation the predecessor itself faced: VisiaEngine's own D1 (2026-09-03) was the identical surgery MediaServo to VisiaEngine.
- **Options**: A. D1-precedent neutralization (archive + reset to templates, keep generic methodology) / B. rename-only / C. delete everything.
- **Decision**: A (user ruling). Stack NOT yet decided — memory files stay as placeholders; do not assume Rust/pixi.
- **Rationale**: the old project's history is fully archived at `.refinfo/VisiaEngine/` (gitignored, verified byte-identical pre-surgery: 4 memory files + rules + 23 skills); overwrite loses nothing. Rename-only (B) would leave factually wrong band records; delete-all (C) discards genuinely portable tooling lessons (they live on in `rules/common/edit-safety.md`).
- **Impact**: per-turn context no longer carries VisiaEngine architecture; every turn's token cost drops. What survived and where:
  - status/decisions/pitfalls reset to OmniLet templates (this entry is decisions.md's first real entry)
  - conventions.md keeps C1 (decision format) + C9 (lesson consolidation) only — the two entries the predecessor itself marked as inherited general methodology; C15-C24 retired to the archive
  - rules/common testing.md + constraints.md + development-workflow.md: VE-specific sections removed; distilled principles kept (tier honesty, HashMap-order discipline, Cargo.lock rule)
  - edit-safety.md kept in full (provenance note added); its lessons are project-agnostic editing discipline
  - .gitignore / .agents/AGENTS.md / agent-model-tiers.md / lesson-review+doc-audit SKILL.md: dead references reworded
  - opencode.json untouched (user ruling "don't assume the stack"): rust LSP + rust rules stay loaded but are inert until .rs files exist; prune at stack decision (D2)
- **Verification**: repo-wide grep outside `.refinfo/`, `node_modules/`, `.git/` classifies every VisiaEngine/MediaServo/PolyOrch hit as archive-pointer or residue; all opencode.json instruction paths exist.

## D2: Product definition settled — whitepaper v1.0 + architecture baseline v0.1 (2026-10-16, user ruling)

- **Background**: the project had no definition (D1 left everything TBD). User supplied the full whitepaper: OmniLet (万应) = multi-end light-app container platform, "compile-time multi-end + runtime container" dual-core. Stack still NOT decided by this entry.
- **Decision**: docs/whitepaper.md (v1.0, verbatim user text) + docs/architecture.md (v0.1 design-goal baseline, derived) are the product definition and architecture baseline. Structure mirrors the predecessor's docs/ evolution (whitepaper.md + architecture.md first; sdd/, reference/, tutorials.md grow when implementation starts).
- **Scope ruling**: whitepaper covers 6 compile targets (WeChat/Alipay/Feishu/QuickApp/own container/H5), own-container SDK (JS engines QuickJS/V8/Hermes pluggable, WebGL/WebGPU render engine), visual designer, security sandbox, admin console. MVP roadmap = DSL+compiler (WeChat + own container) + container SDK (iOS/Android) + basic console.
- **Impact**: ① product purpose known — status.md overview backfilled; ② tech stack STILL open (architecture.md §⑦ registers the D3-pending selections: language/toolchain, compiler implementation, JS engine, render backend, container core language, console stack); ③ the neutralized rules placeholders (D1) now have a backfill target for when D3 lands; ④ architecture.md carries 6 design invariants (JS/render isolation, platform-adapter-only API, one semantic source, no main-thread hijack, fail-closed signature gate, Open Core structural split) — these outrank all diagrams and future decisions amend them only explicitly.
- **Verification**: docs/whitepaper.md == user-supplied text (265 lines); docs/architecture.md references only whitepaper concepts + decisions.md D1/D2, no stack assumptions.

## D3: Engine/container tech stack settled — Rust dual-mode architecture (2026-10-16, user ruling)

- **Background**: architecture.md §⑦ registered the open stack selections (pending since D1's "don't assume"). User supplied the V4.0 technical whitepaper settling the engine-side stack.
- **Decision**: docs/tech-whitepaper.md (V4.0, verbatim user text) = authoritative technical baseline. Engine/container side is **Rust** with a **dual-mode render architecture**:
  - Standard mode: `wry` over system WebViews (WebView2 / WKWebView / WebKitGTK), ~5MB increment, offline packages via custom-protocol interception.
  - HMI extreme mode: no global browser — self-built GPU pipeline (skia-safe/vello + wgpu + taffy + rustybuzz/cosmic-text), DSL compiles to binary Display List, Dirty-Rect repaint, partial on-demand WebView via OSR (WPE DMA-BUF / WebView2 Composition).
  - Logic layer: `rquickjs` default / `rusty_v8` optional, pure ECMAScript (no window/document).
  - Host integration: C ABI boundary (cbindgen, opaque pointers, window handles); Qt via winId(), Flutter via PlatformView/ExternalTexture.
  - Fallback: system-native first, external-browser last resort; CEF explicitly rejected. Linux std-mode distribution = Flatpak; HMI mode = bare binary/AppImage.
- **Rationale**: Rust memory safety + no-GC pauses + C ABI compatibility fits both the embeddable-SDK and the HMI latency envelope (tech-whitepaper §9: <50ms cold start, <15MB, 0.5ms IPC shared-memory, stable 60/120fps). Dual-mode keeps the standard path lightweight while the HMI path owns the GPU.
- **Impact**: ① rules/rust/ + rust-analyzer LSP loading becomes CORRECT (the D1 "inert until stack lands" placeholder resolves in Rust's favor — keep, do not prune); ② architecture.md §⑦ backfilled: 9 rows settled, 4 rows remain open (compiler implementation, console stack, build/CI, testing — the multi-end compile side, register as D4); ③ the predecessor's Rust-specific methodology (edit-safety cargo rules, clippy -D warnings discipline) is now directly applicable rather than archived; ④ performance targets from §9 are now commitments: cold start <300ms std / <50ms HMI, memory <50MB std / <15MB HMI.
- **Verification**: docs/tech-whitepaper.md == user-supplied text; architecture.md §⑦ rows cite D3 + tech-whitepaper sections; no contradiction with whitepaper v1.0 §4.2/§4.3 (container SDK JS engines QuickJS/V8/Hermes ⊇ rquickjs/rusty_v8 selection; render engine WebView/native/hybrid/self-drawn ⊇ dual-mode).

## D4 (log-only, research artifact): reference-library evidence base landed (2026-10-16, team research)

> Not a decision — a research-artifact registration so future D5 (compile-side stack) discussions can cite it. The user-directed 4-lane team research produced docs/reference/ (11 profiles + README index): 3 superapp hosts, FinClip + QuickApp, uni-app/Taro/Chameleon, Lynx/Kraken/Hippy. Key load-bearing findings already backfilled into architecture.md invariant ③ (Hippy pluggable-Renderer → wry/wgpu modes = one interface, two impls; Lynx DisplayList OpType+Reader format precedent). FinClip verdict: architecture borrowable, no compile-time multi-end / no self-rendered GPU evidence = OmniLet's differentiation window. Chameleon/Kraken: dead-project lessons (pure self-invented DSL without ecosystem dies; single-upstream dependency dies). All numbers same-day measured; 8 UNCERTAIN markers confined to closed-source superapp container internals.

## D5: Compile-side stack settled — 3-target MVP compiler, table-driven engine, monorepo (2026-10-16, user ruling via adjudication walkthrough)

- **Background**: architecture.md §⑦ had 4 open rows (compiler impl / console / build / testing) since D3. Brainstorming session BS walked capability ① (multi-end compilation) one adjudication at a time (4 cards, all user-decided; format per adjudication-walkthrough skill).
- **Adjudication 1 — targets**: MVP ships **WeChat + Web + own-container** (Web promoted INTO first release; its position = "mini-program rendering in standard browsers"). Alipay/Feishu/QuickApp stay roadmap-promised, activated per whitepaper §8 phases. Compiler architecture must be target-pluggable from day one.
- **Adjudication 2 — Web path**: **compile to standard web code** (components→DOM, kbone-style). Market verdict: all living mainstream frameworks (Taro/uni-app/kbone/Remax) use this; the only self-render-in-browser attempt (Kraken) is dead (our archive, last push 2022-07). WASM self-render (Lynx Clay style) explicitly NOT the Web-target route.
- **Adjudication 3 — compiler engine**: **table-driven + kernel generational replacement**. Platform transforms live as declarative rule tables (schema ours, MDN-BCD-shaped); kernel v1 = Babel (ecosystem maturity for MVP), kernel v2 = SWC/Rust (swap when perf bites; same tables = spec). Consistency via golden-file diff testing between kernels. NO runtime engine-switchability (rejected: double plugin maintenance, zero industry precedent). Per-layer: engine=SWC-later/Babel-first, knowledge=Taro rule extraction (MIT, attribution), shims=TS always, orchestration=Vite-style.
- **Adjudication 4 — repo layout**: **monorepo**, pnpm workspace (compiler/runtime/packages/console) + cargo workspace (crates/) side by side. Path-filtered CI; rule-table schema change = full consistency-test trigger.
- **Rationale**: see per-card reasoning in session log; summary — targets per whitepaper §8's own ordering; Web path by market survivorship; engine by two-industry-proven-pattern combination; repo by cross-language sync friction.
- **Impact**: ① architecture.md §⑦: compiler-impl row SETTLED (table-driven/Babel-v1→SWC-v2); build/CI row PARTLY settled (monorepo topology); console stack + test matrix STILL OPEN (D6 candidates). ② MVP target set = 3 (this revises the implicit "WeChat + own container only" reading — Web was already in whitepaper's 6-target scope, now confirmed first-release). ③ Repo scaffold shape now decidable (crates/ + compiler/ + runtime/ + packages/ + console/). ④ status.md next steps update.
- **Verification**: docs/architecture.md §⑦ rows updated; status.md D5→done; all 4 adjudications user-replied in-session (A-cards: B/A/table-driven/A).

### D5 addendum (same session, user-adjudicated): capability-② JS engine matrix

- **Engine matrix (user's own proposal, richer than agent's original B)**: compile-time flavor matrix, no runtime switching —
  - **iOS → JavaScriptCore** (system-provided, zero footprint increment)
  - **Android / Linux / Windows → rusty_v8** (deterministic engine independent of fragmented host environments + JIT ceiling for compute-heavy business)
  - **DevTools → rusty_v8** (Chrome DevTools Protocol alignment out of the box)
  - **lite flavor → rquickjs** (lightweight/embedded/HMI scenarios; tech-whitepaper §9's <15MB/<50ms numbers apply to THIS flavor)
  - **Hermes: removed** (RN-ecosystem-exclusive, no standalone maintenance community; whitepaper §4.2 mention was enumeration, not commitment)
- **Detail ① (iOS binding path)**: **OC glue bridge** (user ruling B). JSC called via thin Objective-C++ glue (~hundreds of lines, engine-essential face only: execute/inject/callback) over C ABI per tech-whitepaper §6.1 discipline. **Declared exception to pure-Rust**: iOS flavor build carries OC source; glue exists only in iOS flavor. Glue doubles as the UIView-host-embedding bridge. Precedent: FinClip/RN iOS side.
- **Detail ② (perf metric split)**: **metrics re-tabulated per flavor** (user ruling A). tech-whitepaper §9's single-column table becomes standard (V8/JSC desktop-mobile default) vs lite (rquickjs embedded/HMI) columns; concrete numbers locked at D6. Original <10MB physically unreachable with V8 on Android/Linux/Win defaults — split keeps every number testable and honest. (tech-whitepaper edit is a D3-document revision, sanctioned by this ruling.)
- **Detail ③ (engine abstraction layer)**: **consistency = release gate** (user ruling B). Same business-API test suite runs on all three flavors {standard-V8, standard-JSC, lite-QuickJS}; empty diff = release condition; CI matrix rows go into D6's test plan. Same philosophy as compiler golden-file gates (adjudication 3). Precedent: Hippy's JSC/V8/XS abstraction layer.
- **Verification**: engine matrix recorded here + architecture.md; §9 re-tabulation happens in the same commit as D6 numbers; CI matrix rows land with D6.

### D5 addendum 2 (same session, user-adjudicated): capability-② container & hot-update

- **Adjudication 2 — JS<->render transport**: **dual-channel per mode** (user ruling B).
  - wry standard mode → StructuredChannel (JSON/Patch serialization across the WebView boundary; serialization is unavoidable there anyway, and the boundary doubles as the sandbox audit point per invariant ⑤).
  - wgpu HMI mode → SharedRingBuffer (same-process shared memory; binary patch stream carries the D3 DisplayList instruction flow; <0.5ms IPC metric achievable only here).
  - Unity via upper-layer API only: setData/event callbacks identical for developers across modes; transparency enforced by the engine-consistency release gate (D5 addendum, detail ③).
- **Adjudication 3 — offline package format & diff**: **directory-level diff + manifest signing** (user ruling B).
  - Package = manifest.json (file tree + per-file hash + version + package-level signature) + file tree. Update flow: fetch manifest → diff vs local → download changed files only → reassemble → verify manifest signature → fail-closed on any mismatch (invariant ⑤; single signing point = whole manifest, not per-file).
  - Diff granularity rationale: page/component trees are file-shaped; directory diff saves 80%+ at medium complexity; byte-level (BSDiff) deferred — forward-compatible as a per-large-file add-on if big-package scenarios emerge.
  - Scope note: diff pipeline serves the own-container target only (WeChat target manages its own packages).
- **Open items carried**: none deferred from capability ② — all three adjudications + 3 engineering details user-decided, zero skips.

### D5 addendum 3 (same session, user-adjudicated): capability-③ rendering engine

- **Adjudication 1 — standard-mode component mapping**: **native HTML tags + class prefix convention** (user ruling A). `<view>` → `<div class="omnilet-view">` style; shared with the Web compile target (one DOM mapping implementation serves both); CSS isolation via prefix convention + consistency gate (D6). Shadow DOM rejected (conflicts with mini-program style scoping model; zero mainstream adoption in WebView containers). Whitepaper §4.2 "WebComponent" wording to be annotated at D6 as "host-embedding optional form, NOT the component mapping mechanism".
- **Adjudication 2 — Worker capability tiers**: **three-tier worker model** (user ruling B).
  - L1 pure compute (all platforms) — parity with WeChat workers.
  - L2 vtree diff (standard+HMI): worker holds a read-only tree snapshot, computes minimal change-set, main thread stays sole writer (lock-free). This is the substantive fulfillment of whitepaper §4.3 "render/logic separation". API: `omnilet.createWorker(code, {capability})` — capability declared, overreach errors.
  - L3 SDK-internal (HMI): taffy layout / text shaping / image decode on engine background threads — D3 §5.2/5.3 design, now classified into the worker capability spectrum.
  - Multi-threaded component-tree WRITES rejected (industry-wide no-go; conflicts with single-threaded logic-layer premise).
  - L2 diff results ride the existing dual channels (no new transport).
- **Adjudication 3 — realtime data channel (SCADA)**: **native data-plane bypass** (user ruling B).
  - New SDK module `dataChannel`: Rust-side async WebSocket termination; declarative subscription routing (`omnilet.dataChannel.bind(source, targets, options)`); high-frequency telemetry flows straight into render-layer bindings (HMI: SharedRingBuffer data zone; standard: batched/throttled commits). Raw stream never crosses JS; JS receives only sampled/aggregated events for business logic (alarm rules etc.).
  - Audit posture: telemetry is read-only data, not a code-execution surface — audit obligation sits on subscription declarations, not per-datapoint.
  - MVP scope: channel architecture reserves the data-plane partition in SharedRingBuffer (instruction zone / data zone) — near-zero MVP cost; full dataChannel ships with the industrial suite (phase 2 per whitepaper roadmap).
  - Differentiation: FinClip cannot do this (reference profile shortlist) — whitepaper §7 comparison table's SCADA row now has its engineering footing.

### D5 addendum 4 (same session, user-adjudicated): capability-④ visual designer

- **MVP scope**: designer fully OUT of MVP (user ruling A, per whitepaper §8's own phase-2-Beta scheduling). Zero designer deliverables in MVP acceptance.
- **Rationale locked**: designer's foundation (stable component library + DSL) is exactly what MVP produces — order non-invertible. FinClip Studio precedent: market does not punish late designers.
- **Doc annotations queued for D6 errata batch** (unified with WebComponent note + metric split): whitepaper §2 "three components" gets a phase annotation ("designer from Phase 2").
- **Optional post-MVP increment** (not promised): minimal form-based component-tree editor after component library stabilizes — dogfooding pressure-test for DSL. Re-evaluate at phase-2 planning; no commitment now.

### D5 addendum 5 (same session, user-adjudicated): capability-⑤ sandbox permission model

- **Three-layer permission model** (user ruling B):
  1. **Declaration** — mini-app manifest declares required permissions (WeChat/FinClip-consistent foundation).
  2. **Host policy** — embedding host configures authorization strategy per app class: enterprise host = auto-grant internal apps; open-platform host = sensitive permissions require user confirmation. This layer is whitepaper "embeddable into ANY App" positioning's structural consequence (different hosts, different risk appetites).
  3. **Sensitivity tiers** — low-sensitivity (clipboard-read/haptics) = grant on declaration; high-sensitivity (location/camera/contacts/cross-app data) = host policy decides, user prompt at APP granularity (never per-API per-call — prompt fatigue is itself a security incident).
- **MVP delivery**: layer 1 + layer 3 low-sensitivity silence ship in MVP; layer 2 + high-sensitivity prompts detail with the open platform (phase 2) — but the three-layer ARCHITECTURE is fixed now to avoid phase-2 refactoring.
- **Audit**: every authorization decision logged (app/permission/layer-decided), fulfilling whitepaper §4.5 audit-log promise.
- **Relation to invariant ⑤**: signing/fail-closed = code-entry hard boundary (static); this model = capability-entry soft policy (runtime). Complementary, no overlap.
- **Tests**: permission three-layer combination matrix rows → D6 test plan.

## D6: Console stack + test matrix settled (2026-10-16, user-adjudicated one by one)

- **Adjudication 1 — console stack**: **TS full-stack** (user ruling A): Node (Hono/NestJS) + React + PostgreSQL, living in monorepo `console/` (the slot reserved in D5-4 layout). Offline-package distribution bypasses console backend (upload → object storage → CDN; console handles metadata + manifest signing/KMS). Rust backend rejected for MVP (CRUD economics; dilutes engine firepower); revisit only if phase-2 open-platform needs a high-concurrency gateway.
- **Adjudication 2 — test matrix**: **four-tier pyramid + three release red-lines** (user ruling A, with user's platform correction: T4 covers **Windows/Linux/macOS/iOS/Android/Web**, not mobile-only — aligned with the engine matrix's actual delivery surfaces). Deliverable: `docs/test-matrix.md` v1.0. Red lines: R1 three-flavor engine consistency diff-empty; R2 signature fail-closed incl. tamper samples; R3 compiler golden-file diff beyond whitelist = no silent release.
- **Impact**: architecture.md §⑦ last two open rows (console stack / testing) now SETTLED — the stack-selection table is complete; "D6 pending" placeholders across status.md resolve; CI skeleton work items land with scaffold.

### D6 errata batch (2026-10-16, user-adjudicated): doc alignment + MVP checklist form

- **Whitepaper errata v1.0 → v1.0.1** (user ruling A): §2 designer phase annotation ("自 Phase 2 起交付"); §4.2 WebComponent mechanism clarification (host-embedding shell option, NOT the component drawing mechanism). Zero scope change; errata note appended citing D5 addendum 3/4.
- **MVP checklist form** (user ruling A): standalone `docs/mvp-checklist.md`, two-granularity (tier-1 capability acceptance entries stable / tier-2 expands to scaffold tasks); checklist content = pure synthesis of existing rulings, no new decisions; entry modification = new decision entry (scope-creep guard). Draft v0.1 awaiting user review; tech-whitepaper §9 standard-column numbers lock at scaffold (G2).
### D6 errata batch 2 (2026-10-16, user-adjudicated): mvp-checklist v1.0 finalized

- Four review adjudications walked (adjudication-walkthrough protocol, all user-decided A): (1) same-sample three-artifact acceptance retained; (2) F3 gate-acceptance = red/green dual-proof records per red-line; (3) G2 standard-metric lock stays in MVP scope; (4) exclusion list +2 (runtime engine switching; Hermes) — CEF not duplicated (tech-whitepaper §7.2 authoritative). mvp-checklist.md v0.1 → **v1.0 finalized**. Entry modification henceforth = new decision entry.

## D7: PolyOrch adopted as unified build orchestrator (2026-10-16, user ruling "全盘借鉴 VisiaEngine 方式")

- **Background**: user directed full adoption of the predecessor's build organization (PolyOrch). Adjudication chain: (1-细节①) physical form = **git submodule** (user ruling A; corrected from agent's initial vendor misjudgment — .gitmodules verified: gitee.com/chengxuewen/PolyOrch @ 5945f2a, upstream main verified identical via ls-remote); (1-细节②) adapters = **rust + node faces** (user ruling B; matches D5/D6 language blood — python/pixi faces stay unenabled until consumers exist); (2) phasing = **infra now, wiring at scaffold** (user ruling A).
- **Landed**: PolyOrch submodule @5945f2a + root CMakeLists.txt (assembly layer, LANGUAGES CXX per predecessor form) + cmake/OmniLetPolyOrch.cmake (ensure_polyorch sentinel, first-wins predecessor D39 form; scaffold-time wiring commented: polyorch_rust_setup + polyorch_node_setup + add_subdirectory lanes).
- **Verification**: cmake configure dry-run PASSED (PolyOrch platform probe → mkspec linux-g++ → Generating done; LANGUAGES NONE broke it = measured, fixed per predecessor form); breakage probe PASSED (submodule removed → sentinel FATAL names the missing path exactly per edit-safety #23; restored clean).
- **Notes**: PolyOrch Apache-2.0 (submodule keeps upstream licensing); pixi face deliberately unenabled (D5 kept pnpm; revisiting pixi = separate decision); TS-side (compiler/runtime/console) wiring enters the graph at scaffold when packages exist — every crate/package born into the graph thereafter.
- **Impact**: scaffold next steps now = wire faces + lanes into the standing assembly (not build the assembly); build entry (post-scaffold) = `cmake --preset && cmake --build --preset` one-command full graph.
