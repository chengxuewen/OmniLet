# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-20 | **Branch:** master (2f0f6cc; bootstrap f19490b)

## OVERVIEW

OmniLet（万应）— multi-end light-app container platform ("compile-time multi-end + runtime container"). **Scaffolded and slicing**: Rust workspace under `crates/` (contract crates + omnilet-cef/omnilet-container live), CEF-Backend Linux standard-mode slices T1-T6/T8-T10 green (pixel-proved offline serving + PolyOrch lane), agent toolchain + PolyOrch assembly in place. Stacks all decided: engine/container = **Rust dual-mode** (D3, Linux standard = CefBackend per D16/D18), compile-side = table-driven compiler (D5), console = TS full-stack (D6), build = PolyOrch submodule (D7). Next: compile-side slices (D5 轨道) or the open post-plan slices (binary-envelope perf / winmac-wry / HMI-Renderer consumer).

## STRUCTURE

```
OmniLet/
├── AGENTS.md          # this file
├── SKILL.md           # skills registry: 23 project skills + global plugins + rules/memory division
├── LICENSE-MIT        # dual license (MIT OR Apache-2.0, Open Core per architecture invariant ⑥)
├── LICENSE-APACHE     # ←
├── CMakeLists.txt     # assembly layer: PolyOrch orchestration skeleton (D7)
├── cmake/             # OmniLetPolyOrch.cmake (sentinel + scaffold wiring placeholders)
├── PolyOrch/          # build orchestrator (git submodule gitee @5945f2a, D7; rust+node faces wire at scaffold)
├── pixi.toml + pixi.lock      # D11 environment single-source (rust+node+pnpm, locked)
├── Cargo.toml + Cargo.lock    # rust workspace (members under crates/)
├── crates/                    # 8 crates: contract (render/webview/patch/channel/protocol/jsengine) + omnilet-cef (CefBackend, cage.rs inside) + omnilet-container (bin)
├── examples/demo-app/         # offline-package sample (manifest.json + index.html)
├── docs/              # ALL project knowledge lives here (see docs/AGENTS.md)
│   ├── whitepaper.md          # product definition v1.0.1 (verbatim user text + errata, D2)
│   ├── tech-whitepaper.md     # engine tech V4.0.1 (Rust dual-mode, engine matrix, flavor-split metrics, D3+D5)
│   ├── architecture.md        # design baseline v0.2: 6 invariants; §⑦ stack table COMPLETE (D3/D5/D6)
│   ├── test-matrix.md         # 4-tier pyramid + 3 release red-lines (D6)
│   ├── mvp-checklist.md       # MVP acceptance: 21 entries (B0) + 7 exclusions, v1.0 (D6 errata 2)
│   ├── dsl-spec.md            # DSL contract skeleton (G3): template/units/negative-list
│   ├── devtools-spec.md       # B0 dev-shell spec skeleton (G3)
│   └── reference/             # 11 competitor profiles + README index (snapshot 2026-10-16)
├── .agents/           # agent toolchain: memory/rules/skills (see .agents/AGENTS.md)
├── .opencode/         # opencode config + MCP bridge scripts + LSP wrappers
├── .omo/              # omo.jsonc only
└── .refinfo/          # (gitignored) predecessor projects' full archives, read-only
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| "What is this product?" | `docs/whitepaper.md` | never edit without user ruling |
| Engine/JS-engine/render decisions | `docs/tech-whitepaper.md` | D3 authoritative |
| Architecture invariants | `docs/architecture.md` §invariants | outrank every diagram; amend only via explicit decision |
| Competitor / prior art | `docs/reference/README.md` index | each file: snapshot-dated, UNCERTAIN-marked |
| Current phase / next step | `.agents/memorys/status.md` | loaded every turn |
| Test/release gates | `docs/test-matrix.md` | 4 tiers + red-lines R1/R2/R3 (D6) |
| MVP done-definition | `docs/mvp-checklist.md` | 20 acceptance + 7 exclusions; entry change = new decision |
| DSL contract (template/units/negative list) | `docs/dsl-spec.md` | skeleton at scaffold; grows with compiler slices |
| Dev shell (B0) spec | `docs/devtools-spec.md` | winit+wry+wgpu shell; automator driver contract |
| Past decisions | `.agents/memorys/decisions.md` | append-only, D1-D20 (D19 = cef slice evidence index, D20 = T7 injection ruling) |
| CEF runtime contracts (boot/serving/OSR/cage) | `crates/omnilet-container/SDD.md` | CEF-01..10; single source for landed behavior |
| Current plan status (cef-backend) | `.sisyphus/plans/cef-backend/tasks.md` | T1-T11 done (T7 live via D20 ruling A) |
| Pitfalls | `.agents/memorys/pitfalls.md` + `rules/common/edit-safety.md` | append-only / live rules |

## CONVENTIONS (this project only)

- **Docs are the product right now**: any substantive doc change must be reflected in `.agents/memorys/status.md` the same turn (C9).
- **Decision numbering**: D{n} sequential in `decisions.md`; user rulings D1-D3/D5-D8/D11-D18, research-artifact logs D4/D19. Stack decisions CLOSED; slice findings go to SDD/PIT, new rulings only for real forks (e.g. T7 injection leg).
- **No stack assumptions without measurement**: opencode.json loads rust LSP/rules (correct per D3); cef-rs API signatures are read from vendored bindings before use (#22 discipline, never from memory).
- **Reference profiles**: numbers must be same-day measured; unverifiable claims get `*UNCERTAIN*` markers; every 借鉴点 maps to an OmniLet module.

## ANTI-PATTERNS (THIS PROJECT)

- NEVER cite predecessor numbering (VisiaEngine C15-C24 / D1-D25 / PIT-{n}) as if it lived in this repo's stores — archives are at `.refinfo/VisiaEngine/`, methodology citations OK.
- NEVER edit `docs/whitepaper.md` content silently — it is verbatim user ruling (D2); propose changes as decisions first.
- NEVER widen the frozen WebViewBackend trait surface without an explicit decision (ten-method freeze, D12-add4; the two pump slots were earned by hardest-consumer measurement, D19).
- `.refinfo/` research clones (e.g. `.refinfo/kraken-repo/`, evidence for `docs/reference/kraken.md`) are read-only reference material — do not import, build, or treat as project code.

## COMMANDS

```bash
# Rust gates (pixi single-source env):
pixi run cargo test --workspace
pixi run cargo clippy --workspace --all-targets -- -D warnings
# lifecycle proof (CEF boot; needs debug libcef dir on LD path):
LD_LIBRARY_PATH=$PWD/target/debug pixi run cargo run -p omnilet-cef --example cef_lifecycle
# cmake assembly lane (artifact graph edge; gates still run cargo directly):
pixi run cmake -S . -B cmake-build -G Ninja && pixi run cmake --build cmake-build --target omnilet-container-exe-build
# docs audit:
grep -rIn 'UNCERTAIN' docs/reference/
```

## NOTES

- Multi-end compile TARGETS (WeChat/Alipay/Feishu/QuickApp/H5) are product scope (whitepaper §4.1); the engine that compiles to them is undecided — do not conflate the two when reading docs.
- The whitepaper's §4.2 JS-engine list (QuickJS/V8/Hermes) and tech-whitepaper's ruling (rquickjs/rusty_v8) are compatible: the latter is the concrete initial binding of the former.
