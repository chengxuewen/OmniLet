# docs/ — design baseline & reference library

OmniLet's single source of product/engineering truth; the only project content until source code exists (post-D5).

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Product definition / scope | `whitepaper.md` | v1.0.1, verbatim user ruling + errata (D2) — edit only via decision |
| Engine/container tech | `tech-whitepaper.md` | V4.0.1, user ruling (D3+D5): Rust dual-mode render, three-engine matrix, flavor-split metrics |
| Architecture invariants (6) | `architecture.md` header | outrank all diagrams; ③ carries reference-library evidence |
| Open tech selections | `architecture.md` §⑦ | 4 rows pending → D5 |
| Competitor profiles | `reference/README.md` index → 11 files | 4 groups: hosts / benchmark / frameworks / engines |

## CONVENTIONS (this dir only)

- **whitepaper.md is verbatim user text** — never paraphrase or "improve" it; changes go through decisions.md first.
- **architecture.md invariants > diagrams**: diagrams are design goals (zero code exists); the invariants are the only committed part.
- **reference/ writing discipline** (in reference/README.md): snapshot date mandatory; same-day measured numbers only; `*UNCERTAIN*` for unverifiable claims; every 借鉴点 names its target OmniLet module; dead projects documented as lessons (chameleon, kraken).
- **Cross-doc references**: cite by doc § (e.g. "tech-whitepaper §5.3"), never by line number (docs are edited).

## ANTI-PATTERNS

- Do NOT add new top-level docs (sdd/, tutorials/ etc. from the predecessor layout) before implementation exists to document — grow on demand.
- Do NOT copy competitor facts between profiles; link instead (each profile is self-contained with its own snapshot date).
- Do NOT treat reference profiles as endorsement of their full architecture — each keeps only "useful to OmniLet" content.

## NOTES

- Profiling evidence clones live in `.refinfo/` (e.g. `.refinfo/kraken-repo/`); the profile files are the citable surface, the clones are disposable.
- Tech-stack rows in architecture.md §⑦ flip ⬜→✅ only via decisions.md entries (next: D5).
