# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-16 (audit refresh) | **Branch:** master (aac1170; bootstrap f19490b)

## OVERVIEW

OmniLet（万应）— multi-end light-app container platform ("compile-time multi-end + runtime container"). Currently **design-phase, zero source code**: definition docs + adjudicated stack + build orchestrator + agent toolchain. Stacks all decided: engine/container = **Rust dual-mode** (D3), compile-side = table-driven compiler + monorepo (D5), console = TS full-stack + 4-tier test matrix (D6), build = PolyOrch submodule (D7). Next: scaffold.

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
| Past decisions | `.agents/memorys/decisions.md` | append-only, D1-D7 (+addenda) |
| Pitfalls | `.agents/memorys/pitfalls.md` + `rules/common/edit-safety.md` | append-only / live rules |

## CONVENTIONS (this project only)

- **Docs are the product right now**: any substantive doc change must be reflected in `.agents/memorys/status.md` the same turn (C9).
- **Decision numbering**: D{n} sequential in `decisions.md`; D1-D3 = user rulings, D4 = research-artifact log, D5/D6/D7 = user rulings (compile-side/console+tests/build orchestrator). All stack decisions CLOSED; next decision opens only with scaffold findings.
- **No stack assumptions**: opencode.json still loads rust LSP/rules — correct per D3 but inert until Rust files exist. Do not prune or extend until D5 lands.
- **Reference profiles**: numbers must be same-day measured; unverifiable claims get `*UNCERTAIN*` markers; every 借鉴点 maps to an OmniLet module.

## ANTI-PATTERNS (THIS PROJECT)

- NEVER cite predecessor numbering (VisiaEngine C15-C24 / D1-D25 / PIT-{n}) as if it lived in this repo's stores — archives are at `.refinfo/VisiaEngine/`, methodology citations OK.
- NEVER edit `docs/whitepaper.md` content silently — it is verbatim user ruling (D2); propose changes as decisions first.
- NEVER start implementing before D5: no repo scaffold, no crate/package creation, no toolchain installs.
- `.refinfo/` research clones (e.g. `.refinfo/kraken-repo/`, evidence for `docs/reference/kraken.md`) are read-only reference material — do not import, build, or treat as project code.

## COMMANDS

```bash
# No build/test yet — no source. Placeholder until D5 (see status.md).
grep -rIn 'UNCERTAIN' docs/reference/   # audit unverified claims in reference library
```

## NOTES

- Multi-end compile TARGETS (WeChat/Alipay/Feishu/QuickApp/H5) are product scope (whitepaper §4.1); the engine that compiles to them is undecided — do not conflate the two when reading docs.
- The whitepaper's §4.2 JS-engine list (QuickJS/V8/Hermes) and tech-whitepaper's ruling (rquickjs/rusty_v8) are compatible: the latter is the concrete initial binding of the former.
