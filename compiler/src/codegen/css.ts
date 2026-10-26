// Slice-2 Task 3: web CSS codegen — rpx->px unit math (750 basis) + the SAME
// table-driven selector whitelist / class prefix as the wxss side.
//
// Structurally a mirror of wxss.ts (postcss parse -> at-rule/rule walks ->
// rejectReason/prefixClasses); the ONE behavioral delta is the declaration-level
// rpx replacement: wechat's rpx row is identity (platform converts), the web
// table declares rpx->px and this module does the unit math — 1rpx = 0.5px at
// the 375px viewport (750 basis, D22 Card 3; widening = dsl-spec §4 reopen
// trigger). Shared helpers are IMPORTED, not copied: selectorWhitelist
// (tables.ts) + classPrefixPolicy (rewrite.ts) keep template and css classes
// same-source. No new diagnostic codes — off-table selectors stay 212.
import postcss from 'postcss'
import { diag } from '../diag'
import { selectorWhitelist, type TableSet } from '../tables'
import { classPrefixPolicy } from '../rewrite'
import type { Diag } from '../types'

export type CssResult = { code: string; diagnostics: Diag[] }

/** 750-design-draft basis (D22 Card 3): 1rpx = 375/750 = 0.5px @375px viewport.
 *  Exported so the dsl-spec §4 sync and future consumers read ONE constant. */
export const RPX_BASIS = 750
const RPX_PX = 375 / RPX_BASIS

export function emitCss(css: string, file: string, tables: TableSet): CssResult {
  const diagnostics: Diag[] = []
  let root: postcss.Root
  try {
    root = postcss.parse(css, { from: file })
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    return { code: '', diagnostics: [diag(121, `css parse error: ${msg}`, '修正样式表语法（1xx = lex/parse 家族，types.ts）', { file, line: 0, col: 0 })] }
  }

  const allow = new Set(selectorWhitelist(tables))
  const policy = classPrefixPolicy(tables)
  const rpxRow = tables.styleRules.find((r) => r.s === 'rpx')
  const convertRpx = rpxRow?.t === 'px'

  root.walkAtRules((at) => {
    diagnostics.push(offTable(`at-rule '@${at.name}'`, file))
    at.remove()
  })
  root.walkRules((rule) => {
    const kept: string[] = []
    for (const sel of rule.selectors) {
      const why = rejectReason(sel, allow)
      if (why) diagnostics.push(offTable(why, file))
      else kept.push(prefixClasses(sel, policy))
    }
    if (kept.length === 0) rule.remove()
    else rule.selector = kept.join(', ')
  })
  if (convertRpx) {
    root.walkDecls((decl) => {
      if (decl.value.includes('rpx')) {
        decl.value = decl.value.replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, n: string) => `${Number(n) * RPX_PX}px`)
      }
    })
  }

  const body = root.toString().replace(/\r\n?/g, '\n')
  const code = body.trim() === '' ? '' : body.endsWith('\n') ? body : `${body}\n`
  return { code, diagnostics }
}

/** null = accepted by the table; string = human-readable rejection reason.
 *  Same selector grammar as wxss.ts (kept in step — the whitelist is shared
 *  data; this predicate is its only second copy). */
function rejectReason(sel: string, allow: Set<string>): string | null {
  const trimmed = sel.trim()
  if (trimmed === '') return "empty selector"
  if (/[>+~]/.test(trimmed)) return `'${sel}' (explicit '> + ~' combinator not in table)`
  for (const compound of trimmed.split(/\s+/)) {
    const parts = compound.match(/::?[a-zA-Z-][\w-]*|\.[A-Za-z_][\w-]*|#[A-Za-z_][\w-]*|[a-zA-Z][\w-]*|\[[^\]]*\]|./g) ?? []
    let consumed = 0
    for (const p of parts) {
      consumed += p.length
      if (p.startsWith('#')) return `'${sel}' (id selector not in table)`
      if (p.startsWith('[')) return `'${sel}' (attribute selector not in table)`
      if (p === '*') return `'${sel}' ('*' universal selector not in table)`
      if (/^::?[a-zA-Z-][\w-]*$/.test(p)) {
        if (!allow.has('selector:pseudo')) return `'${sel}' (pseudo-class row missing)`
        continue
      }
      if (/^\.[A-Za-z_][\w-]*$/.test(p)) {
        if (!allow.has('selector:class')) return `'${sel}' (class selector row missing)`
        continue
      }
      if (/^[a-zA-Z][\w-]*$/.test(p)) {
        if (!allow.has('selector:tag')) return `'${sel}' (tag selector row missing)`
        continue
      }
      return `'${sel}' (selector shape outside table)`
    }
    if (consumed !== compound.length) return `'${sel}' (selector shape outside table)`
  }
  return null
}

/** Prefix every class WORD (not the dot) — same predicate as wxss.ts. */
function prefixClasses(sel: string, policy: { prefix: string; exempt: ReadonlySet<string> }): string {
  return sel.replace(/\.[A-Za-z_][\w-]*/g, (m) => {
    const w = m.slice(1)
    return `.${policy.exempt.has(w) || w.startsWith(policy.prefix) ? w : `${policy.prefix}${w}`}`
  })
}

function offTable(what: string, file: string): Diag {
  return diag(
    212,
    `选择器越界：${what}`,
    '样式选择器白名单 = styleRules selector:* 行（表外即拒，dsl-spec §3）；替代：拆分到类选择器',
    { file, line: 0, col: 0 },
  )
}

