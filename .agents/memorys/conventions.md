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

## C3: 裁决落地 = 全表面同步（防已裁问题被重开）

**Constraint**: 每个 D 裁决写入 decisions.md 的**同一轮**，必须 grep 旧表述并同步所有承载该裁决的文档表面（spec/画像/README/status）；未同步的旧文 = 下一会话重开已裁问题的陷阱源（本 session 实证两次：D10 裁 Vue 族后 dsl-spec §1 仍挂"倾向 wx: 待定稿"，lead 据此重开已裁题；D21 期内 uni-app v3 判例误述又被画像深读翻案）。反向纪律同样成立：**开新裁决前先 grep decisions.md 确认此题未裁**。

**Check**: `grep -rn "<旧裁决关键词>" docs/ .agents/` 与 decisions 新条目同一 commit 落地（git show --stat 可见）。

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
