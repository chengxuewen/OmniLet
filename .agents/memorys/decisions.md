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
