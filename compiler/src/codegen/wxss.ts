// Task 10 (compile-slice1): WXSS codegen — class prefix + selector whitelist.
//
// Table-first: every decision reads the styleRules partition, no re-encoded lists.
//   - class word prefixing shares the ONE lookup (classPrefixPolicy) with the
//     template side (T9 same-source promise: template classes and wxss selectors
//     can never drift);
//   - selector acceptance = selectorWhitelist() rows (selector:class / selector:tag
//     / selector:pseudo). Anything the table does not declare (id `#x`, attribute
//     `[x]`, `*`, explicit `> + ~` combinators, at-rules) is a 2xx whitelist escape
//     and the offending selector/rule is dropped (fail-closed, siblings keep going
//     — same granularity philosophy as the template visitor).
//   - rpx is identity on WeChat (styleRules rpx row): postcss leaves declaration
//     values untouched, which IS the row's behavior — no unit-math code here.
//
// Output = postcss re-stringification of the pruned tree: author formatting is
// preserved verbatim (postcss keeps raws), so the bytes stay input-deterministic.
import postcss from 'postcss'
import { diag } from '../diag'
import { selectorWhitelist, type TableSet } from '../tables'
import { classPrefixPolicy } from '../rewrite'
import type { Diag } from '../types'

export type WxssResult = { code: string; diagnostics: Diag[] }

const CLASS_PART = /^\.[A-Za-z_][\w-]*$/
const TAG_PART = /^[a-zA-Z][\w-]*$/
const PSEUDO_PART = /^::?[a-zA-Z-][\w-]*$/

export function emitWxss(css: string, file: string, tables: TableSet): WxssResult {
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

  const body = root.toString().replace(/\r\n?/g, '\n')
  const code = body.trim() === '' ? '' : body.endsWith('\n') ? body : `${body}\n`
  return { code, diagnostics }
}

/** null = accepted by the table; string = human-readable rejection reason. */
function rejectReason(sel: string, allow: Set<string>): string | null {
  const trimmed = sel.trim()
  if (trimmed === '') return "empty selector"
  if (/[>+~]/.test(trimmed)) return `'${sel}' (explicit '> + ~' combinator not in table)`
  for (const compound of trimmed.split(/\s+/)) {
    // split a compound into selector parts: pseudo first ( '::?name' ), then .class/#id/tag
    const parts = compound.match(/::?[a-zA-Z-][\w-]*|\.[A-Za-z_][\w-]*|#[A-Za-z_][\w-]*|[a-zA-Z][\w-]*|\[[^\]]*\]|./g) ?? []
    let consumed = 0
    for (const p of parts) {
      consumed += p.length
      if (p.startsWith('#')) return `'${sel}' (id selector not in table)`
      if (p.startsWith('[')) return `'${sel}' (attribute selector not in table)`
      if (p === '*') return `'${sel}' ('*' universal selector not in table)`
      if (PSEUDO_PART.test(p)) {
        if (!allow.has('selector:pseudo')) return `'${sel}' (pseudo-class row missing)`
        continue
      }
      if (CLASS_PART.test(p)) {
        if (!allow.has('selector:class')) return `'${sel}' (class selector row missing)`
        continue
      }
      if (TAG_PART.test(p)) {
        if (!allow.has('selector:tag')) return `'${sel}' (tag selector row missing)`
        continue
      }
      return `'${sel}' (selector shape outside table)`
    }
    if (consumed !== compound.length) return `'${sel}' (selector shape outside table)`
  }
  return null
}

/** Prefix every class WORD (not the dot); exempt/prefixed words pass through —
 *  exact same predicate as prefixWords on the template side. */
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
