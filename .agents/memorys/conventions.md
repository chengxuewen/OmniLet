# OmniLet Conventions & Constraints

> Inherited from the predecessor project's general methodology (C1/C9; the full VisiaEngine store, including C15-C24 engine-specific constraints, is archived read-only at `.refinfo/VisiaEngine/.agents/memorys/conventions.md`). New conventions take the smallest free slot (C2, then C3, ...).

## C1: Architecture-decision comparison format

**Constraint**: any architecture discussion involving option choice must enumerate, per option:
- **Pros/cons**: the advantages and disadvantages of each option
- **Sources/references**: the existing systems / open-source projects / industry practices borrowed from
- **Impact**: what choosing that option implies for subsequent development
- **Recommendation**: an explicit recommendation with reasons

Listing options for the user to choose without the above analysis is forbidden.

## C2: Conversation symbol ban - circled numbers forbidden

**Constraint**: in all user-facing replies (and docs intended for the user's eye), NEVER use circled-number characters (U+2460 U+2461 ... U+24FF) or similar dingbat glyphs - they render illegibly in the user's environment (user ruling 2026-10-21). Use plain ASCII instead: `A / B / C` for option cards, `1. 2. 3.` for ordered lists, `-` for bullets. Applies to adjudication cards, brainstorming questions, status tables - everywhere.

**Check**: `printf '%s' "$REPLY_TEXT" | grep -qP '[\x{2460}-\x{24FF}]'` must find nothing.

## C9: Automatic lesson consolidation

**Constraint**: problems, lessons, and experience discovered during development must be proactively written into the corresponding memory documents within the same session turn.

| Situation | → File to update |
|------|-----------|
| bug found / pitfall hit | `pitfalls.md` (symptom + root cause + solution + verification — all required) |
| user corrects AI behavior | `conventions.md` (new constraint, C{n} numbering) |
| architecture/config decision | `decisions.md` (D{n} numbering + rationale + impact) |
| project state change | `status.md` (date, Phase, test counts) |
| coding pattern / anti-pattern | `rules/common/coding-style.md` |
| security-related lesson | `rules/common/security.md` |
| edit-tool usage lesson | `rules/common/edit-safety.md` |

**Principle**: don't wait for the user to ask. Once a consolidatable experience is recognized, update proactively. Better over-record than omit.
