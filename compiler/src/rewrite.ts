// Task 8 (compile-slice1): the table-driven rewrite visitor — "table is data,
// behavior is fixed points" (D5). Walks the parse-only vue AST (T7) and builds a
// NEW WXML-shaped tree; the input AST is never mutated (C-style immutability rule).
//
// Serialization contract (lands NOW, owns g001-g003 expected bytes):
//   serializeAst(node): deterministic WXML-FLAT tree text.
//   - element line: `<tag k="v" k2="v2">` — attrs in TABLE EMISSION order:
//     directive/event-mapped attrs first, ordered by their owning row's index in
//     [directiveMap…, eventMap…] (splitDirective emits wx:for, wx:for-item,
//     wx:for-index in that fixed order); plain (static) attrs after, in source
//     order. Never source-order-dependent across partitions.
//   - element children indented 2 more spaces, then `</tag>`.
//   - text leaf line: `text:<verbatim content>` (inter-element whitespace is gone
//     by the locked condense parse; intra-text spacing is verbatim).
//   - interpolation leaf: `{{<expr text>}}` — expression kept verbatim from the
//     author source (trimmed by vue), never rewritten.
//   - root: array input lists children at the given depth.
//   - LF line endings, trailing newline, no blank lines, 2-space indent steps —
//     conforms to packages/rule-schema NORMALIZATION.md (assertNormalized in tests).

import type { RootNode } from '@vue/compiler-dom'
import type { TableSet } from './tables'
import { NEGATIVE_ENTRIES, diag } from './diag'
import { type Diag, type TableRow } from './types'
import {
  buildExprWhitelist,
  collectPaths,
  parseExpr,
  validateExpr,
  type ExprWhitelist,
} from './expr'

// ---------------------------------------------------------------- output shape

export type OutAttr = { k: string; v: string }

export type OutNode =
  | { kind: 'el'; tag: string; attrs: OutAttr[]; children: OutNode[] }
  | { kind: 'text'; value: string }
  | { kind: 'interp'; raw: string }

export type RewriteResult = {
  outAst: OutNode[]
  paths: string[]
  diagnostics: Diag[]
}

/** v-for alias scope for keyTransform/path suppression; null outside a loop. */
export type ForScope = { item: string; index: string } | null

const ELEMENT = 1
const TEXT = 2
const INTERPOLATION = 5
const ATTRIBUTE = 6
const DIRECTIVE = 7

type PExp = { content: string } | undefined
type PProp = {
  type: number
  name?: string
  rawName?: string
  value?: { type: number; content?: string }
  arg?: PExp
  exp?: PExp
  modifiers?: { content?: string }[]
}
type PNode = {
  type: number
  tag?: string
  content?: unknown
  children?: PNode[]
  props?: PProp[]
}
type PRoot = { type: number; children: PNode[] }

// ------------------------------------------------------------------ serializer

export function serializeAst(node: OutNode | readonly OutNode[], depth = 0): string {
  const lines: string[] = []
  if (Array.isArray(node)) {
    for (const child of node as readonly OutNode[]) serInto(child, depth, lines)
  } else {
    serInto(node as OutNode, depth, lines)
  }
  return `${lines.join('\n')}\n`
}

function serInto(node: OutNode, depth: number, lines: string[]): void {
  const pad = '  '.repeat(depth)
  switch (node.kind) {
    case 'el': {
      const attrs = node.attrs.map((a) => ` ${a.k}="${a.v}"`).join('')
      lines.push(`${pad}<${node.tag}${attrs}>`)
      for (const child of node.children) serInto(child, depth + 1, lines)
      lines.push(`${pad}</${node.tag}>`)
      return
    }
    case 'text':
      lines.push(`${pad}text:${node.value}`)
      return
    case 'interp':
      lines.push(`${pad}{{${node.raw}}}`)
      return
  }
}

// ------------------------------------------------------------- diagnostics kit

function negative(id: string): Diag {
  const e = NEGATIVE_ENTRIES.find((x) => x.id === id)
  if (!e) throw new Error(`negative('${id}'): unknown NEGATIVE entry id`)
  return diag(e.code, e.message, e.hint)
}

/** 2xx escape without a dedicated §2 negative entry — reason names the shape. */
function exprEscape(reason: string): Diag {
  return diag(
    209,
    `模板表达式越界：${reason}`,
    "表达式 = 白名单操作枚举（dsl-spec §1）：数据读取/运算/字面量可，函数调用不可——派生逻辑走 script 层 computed",
  )
}

const KEY_UNSUPPORTED = () =>
  diag(
    210,
    ':key 形态不支持',
    '替代：wx:key 需为 item 属性名（`item.id`）、循环项本体（`item`）或索引（`index`）',
  )

const MODIFIER_UNSUPPORTED = (m: string) =>
  diag(
    206,
    `事件修饰符 '.${m}' 不在表`,
    '切片 1 仅支持 `.stop`（→ catch 前缀）；其余修饰符随 §2 负面表补行',
  )

const DIRECTIVE_UNKNOWN = (s: string) =>
  diag(207, `指令 '${s}' 不在 directiveMap/eventMap 表`, '表外即拒（白名单哲学，spec §3）；支持形态随表行增加')

const TAG_UNKNOWN = (s: string) =>
  diag(208, `标签 '${s}' 不在 tagMap 表`, '表外即拒（tagMap 全枚举哲学，spec §3）；该元素整棵子树不产出')

// ----------------------------------------------------------- expression gate

/** Parse + table-validate one template expression; null = clean, else reason. */
function gateExpr(raw: string, whitelist: ExprWhitelist): string | null {
  const parsed = parseExpr(raw)
  if (!parsed.ok) return parsed.reason
  return validateExpr(parsed.node, whitelist)
}

// ------------------------------------------------------------------ primitives

export type PrimJob = {
  /** source token (directive rawName base / event key) */
  name: string
  /** expression text or static attribute value */
  raw: string
  modifiers: string[]
  scope: ForScope
  whitelist: ExprWhitelist
}

export type PrimResult = { attrs: OutAttr[]; diagnostics: Diag[]; paths: string[]; scope?: ForScope }

/**
 * Parse + table-validate + path-collect one attribute expression in ONE parse pass
 * (T9 fold of T8 LOW-1: no dead row param, no double parse). Failure returns the
 * 209 escape diag with the precise reason; success emits the attr.
 */
function gateAttr(job: PrimJob, attrName: string, wrap: boolean): PrimResult {
  const parsed = parseExpr(job.raw)
  if (!parsed.ok) return { attrs: [], diagnostics: [exprEscape(parsed.reason)], paths: [] }
  const violation = validateExpr(parsed.node, job.whitelist)
  if (violation) return { attrs: [], diagnostics: [exprEscape(violation)], paths: [] }
  const paths = collectPaths(parsed.node, scopeSet(job.scope))
  const value = wrap ? `{{${job.raw}}}` : job.raw
  return { attrs: [{ k: attrName, v: value }], diagnostics: [], paths }
}

/** Shared word-prefixing core: template rewrite + css codegen (T10) prefix from
 * this one function over the one styleRules `class` row = same-source word table. */
function prefixWords(value: string, prefix: string, exempt: ReadonlySet<string>): string {
  return value
    .split(/\s+/)
    .filter((w) => w !== '')
    .map((w) => (exempt.has(w) || w.startsWith(prefix) ? w : `${prefix}${w}`))
    .join(' ')
}

/** The one styleRules classPrefix lookup: prefix word + exempt word set.
 *  Template rewrite (classPrefix) and css codegen (T10 emitWxss) both route through
 *  this policy = the same-source word table promise, read once per compile. */
export function classPrefixPolicy(tables: TableSet): { prefix: string; exempt: ReadonlySet<string> } {
  const row = tables.styleRules.find((r) => r.primitive === 'classPrefix')
  const exempt = new Set(tables.styleRules.filter((r) => r.exempt === true).map((r) => r.s))
  return { prefix: row?.t ?? 'omnilet-', exempt }
}

/**
 * Template-side static class rewrite (D5 add3-1: 编译器自动加前缀，业务手写免前缀).
 * `box` -> `omnilet-box`; words with an exempt styleRules row and already-prefixed
 * words pass through. The prefix lives in the styleRules `class` row (primitive
 * classPrefix) — css codegen reads the SAME row, so template classes and prefixed
 * wxss selectors can never drift apart. Only static class values are visible here;
 * dynamic :class strings are author responsibility (§2 替代写法: script 层切换 class 名).
 */
export function classPrefix(value: string, tables: TableSet): string {
  const { prefix, exempt } = classPrefixPolicy(tables)
  return prefixWords(value, prefix, exempt)
}

/**
 * The fixed-point behavior table: one entry per PrimName (closed 8-value enum).
 * Rows reference these by `primitive`; the visitor dispatches, no per-row logic.
 * classPrefix is wired into the static-class path (T9); lifecyclePassthrough is the
 * js-side identity whose rows land in T9, consumed by codegen (T10).
 */
export const PRIMITIVES: Record<NonNullable<TableRow['primitive']>, (job: PrimJob, row: TableRow) => PrimResult> = {
  rename: (job, row) => gateAttr(job, row.t ?? job.name, row.wrap === true),

  wrapExpr: (job, row) => gateAttr(job, row.t ?? job.name, true),

  passthrough: (job, row) => ({ attrs: [{ k: row.t ?? job.name, v: job.raw }], diagnostics: [], paths: [] }),

  splitDirective: (job, row) => {
    // v-for header only (D5 splitDirective is scoped to this family — spec §3:
    // no invented `splitDirective.v-for2`). `(item, index) in list` two-tuple.
    const header = /^\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?\)?\s+in\s+([\s\S]+)$/.exec(job.raw)
    if (!header) {
      const proto = negative('vfor-proto')
      const reason = /\bof\b/.test(job.raw) ? '`of` 迭代协议' : '非 `(item, index) in list` 两元形态'
      return { attrs: [], diagnostics: [{ ...proto, message: `${proto.message}（${reason}）` }], paths: [] }
    }
    const [, itemRaw, indexRaw, listRaw] = header
    const item = itemRaw ?? 'item'
    const index = indexRaw ?? 'index'
    const scope: ForScope = { item, index }
    // wrap:true on the v-for row (T10): the list value is an EXPRESSION and real WXML
    // needs it brace-wrapped (`wx:for="{{list}}"`); for-item/for-index stay bare alias
    // names (correct WXML spelling). Table-driven — the brace rule lives in the row, not code.
    const gated = gateAttr({ ...job, raw: (listRaw ?? '').trim(), scope }, row.t ?? 'wx:for', row.wrap === true)
    if (gated.diagnostics.length > 0) return gated
    return {
      attrs: [...gated.attrs, { k: row.forItem ?? 'wx:for-item', v: item }, { k: row.forIndex ?? 'wx:for-index', v: index }],
      diagnostics: [],
      paths: gated.paths,
      scope,
    }
  },

  keyTransform: (job, row) => {
    const parsed = parseExpr(job.raw)
    const violation = parsed.ok ? validateExpr(parsed.node, job.whitelist) : parsed.reason
    if (violation) return { attrs: [], diagnostics: [exprEscape(violation)], paths: [] }
    const name = row.t ?? 'wx:key'
    const node = parsed.ok ? parsed.node : null
    let value: string | null = null
    if (node?.nt === 'lit' && node.lit === 'string') value = node.text
    else if (node?.nt === 'path') {
      const p = node.parts
      if (p.length === 1 && job.scope && p[0] === job.scope.index) value = 'index'
      else if (p.length === 1 && job.scope && p[0] === job.scope.item) value = '*this'
      else if (p.length === 2 && job.scope && p[0] === job.scope.item) value = p[1]
      else if (p.length === 1) value = p[0]
    }
    if (value === null) return { attrs: [], diagnostics: [KEY_UNSUPPORTED()], paths: [] }
    const paths = node ? collectPaths(node, new Set(job.scope ? [job.scope.item, job.scope.index] : [])) : []
    return { attrs: [{ k: name, v: value }], diagnostics: [], paths }
  },

  valueMap: (job, row) => {
    const target = row.t ?? ''
    // handler must be a bare identifier — the static event-table extraction
    // precondition (NEGATIVE 'handler-form', dsl-spec §2).
    if (!/^[A-Za-z_$][\w$]*$/.test(job.raw)) {
      return { attrs: [], diagnostics: [negative('handler-form')], paths: [] }
    }
    for (const m of job.modifiers) {
      if (m !== 'stop') return { attrs: [], diagnostics: [MODIFIER_UNSUPPORTED(m)], paths: [] }
    }
    const name = job.modifiers.includes('stop') ? target.replace(/^bind/, 'catch') : target
    return { attrs: [{ k: name, v: job.raw }], diagnostics: [], paths: [] }
  },

  // Prefixes every word of the static class value; the exempt set only exists in a
  // full table, so the visitor path calls classPrefix(value, tables) instead — both
  // share prefixWords, this direct form pins the row-driven prefix itself.
  classPrefix: (job, row) => ({
    attrs: [{ k: 'class', v: prefixWords(job.raw, row.t ?? 'omnilet-', new Set()) }],
    diagnostics: [],
    paths: [],
  }),

  // js-side hook passthrough (lifecycleMap rows, T9); identity = "词表直通".
  lifecyclePassthrough: (job, row) => ({
    attrs: [{ k: row.t ?? row.s, v: job.raw }],
    diagnostics: [],
    paths: [],
  }),
}

// --------------------------------------------------------------------- visitor

/** Route one parsed directive prop onto its source token: 'v-if' / ':key' / '@tap'. */
function directiveToken(p: PProp): string | null {
  if (p.type !== DIRECTIVE || !p.name) return null
  if (p.name === 'on') return `@${p.arg?.content ?? ''}`
  if (p.name === 'bind') return `:${p.arg?.content ?? ''}`
  return `v-${p.name}`
}

export function rewrite(ast: RootNode, tables: TableSet): RewriteResult {
  const tagIdx = new Map(tables.tagMap.map((r) => [r.s, r]))
  const dirIdx = new Map(tables.directiveMap.map((r) => [r.s, r]))
  const evIdx = new Map(tables.eventMap.map((r) => [r.s, r]))
  // Partition order for fixed attr emission: directiveMap rows, then eventMap rows.
  const emissionRank = new Map<string, number>([
    ...tables.directiveMap.map((r, i) => [r.s, i] as const),
    ...tables.eventMap.map((r, i) => [r.s, tables.directiveMap.length + i] as const),
  ])
  const whitelist = buildExprWhitelist(tables.exprWhitelist)
  const ctx: RewriteCtx = { tables, tagIdx, dirIdx, evIdx, emissionRank, whitelist, diagnostics: [], pathSet: new Set() }
  const root = ast as unknown as PRoot
  const outAst = walkChildren(root.children ?? [], null, ctx)
  return {
    outAst,
    paths: [...ctx.pathSet].sort(),
    diagnostics: ctx.diagnostics,
  }
}

type RewriteCtx = {
  tables: TableSet
  tagIdx: Map<string, TableRow>
  dirIdx: Map<string, TableRow>
  evIdx: Map<string, TableRow>
  emissionRank: Map<string, number>
  whitelist: ExprWhitelist
  diagnostics: Diag[]
  pathSet: Set<string>
}

function walkChildren(children: PNode[], scope: ForScope, ctx: RewriteCtx): OutNode[] {
  const out: OutNode[] = []
  for (const node of children) {
    const walked = walkNode(node, scope, ctx)
    if (walked) out.push(walked)
  }
  return out
}

function walkNode(node: PNode, scope: ForScope, ctx: RewriteCtx): OutNode | null {
  switch (node.type) {
    case TEXT:
      return { kind: 'text', value: String(node.content ?? '') }
    case INTERPOLATION: {
      const expr = node.content as PExp
      const raw = (expr?.content ?? '').trim()
      const violation = gateExpr(raw, ctx.whitelist)
      if (violation) {
        ctx.diagnostics.push(exprEscape(violation))
        return null // not emitted; compileProject (T10) blocks on the error diag
      }
      const parsed = parseExpr(raw)
      if (parsed.ok) collectPaths(parsed.node, scopeSet(scope)).forEach((p) => ctx.pathSet.add(p))
      return { kind: 'interp', raw }
    }
    case ELEMENT:
      return walkElement(node, scope, ctx)
    default:
      return null // ROOT/COMMENT and codegen shapes never appear at parse level
  }
}

function scopeSet(scope: ForScope): ReadonlySet<string> {
  return new Set(scope ? [scope.item, scope.index] : [])
}

function walkElement(el: PNode, outerScope: ForScope, ctx: RewriteCtx): OutNode | null {
  const tag = el.tag ?? ''
  const tagRow = ctx.tagIdx.get(tag)
  if (!tagRow) {
    ctx.diagnostics.push(TAG_UNKNOWN(tag))
    return null // 表外即拒: whole subtree dropped, diagnostic collected
  }

  const props = el.props ?? []
  const mapped: { rank: number; attrs: OutAttr[] }[] = []
  let scope = outerScope

  // Pass 1 — v-for first: it introduces the alias scope other attrs/children see.
  const forProp = props.find((p) => directiveToken(p) === 'v-for')
  if (forProp) {
    const row = ctx.dirIdx.get('v-for')
    const raw = forProp.exp?.content ?? ''
    if (!row) {
      ctx.diagnostics.push(DIRECTIVE_UNKNOWN('v-for'))
    } else {
      const result = PRIMITIVES.splitDirective(
        { name: 'v-for', raw, modifiers: [], scope: outerScope, whitelist: ctx.whitelist },
        row,
      )
      ctx.diagnostics.push(...result.diagnostics)
      result.paths.forEach((p) => ctx.pathSet.add(p))
      if (result.attrs.length > 0) {
        mapped.push({ rank: ctx.emissionRank.get('v-for') ?? 0, attrs: result.attrs })
        scope = result.scope ?? null
      }
    }
  }

  // Pass 2 — every other prop.
  for (const p of props) {
    if (p === forProp) continue
    if (p.type === ATTRIBUTE) {
      continue // static attrs are plain-emitted below
    }
    if (p.type !== DIRECTIVE) continue
    const token = directiveToken(p)
    if (!token) continue
    const rawName = p.rawName ?? token
    if (p.name === 'model') {
      ctx.diagnostics.push(negative('model-sugar'))
      continue
    }
    if (p.name === 'bind' && (p.arg?.content === 'class' || p.arg?.content === 'style')) {
      // §2 class-obj covers ONLY object/array literal syntax (T9 ruling); any other
      // expression shape falls through to the table route (rename+wrap rows :class/
      // :style) where the ordinary expr gate gives 209 when needed.
      const litCheck = parseExpr(p.exp?.content ?? '')
      if (!litCheck.ok && /^(?:object|array) literal/.test(litCheck.reason)) {
        ctx.diagnostics.push(negative('class-obj'))
        continue
      }
    }
    const row = token.startsWith('@') ? ctx.evIdx.get(token) : ctx.dirIdx.get(token)
    if (!row) {
      ctx.diagnostics.push(DIRECTIVE_UNKNOWN(rawName))
      continue
    }
    if (!row.primitive) {
      ctx.diagnostics.push(DIRECTIVE_UNKNOWN(rawName))
      continue
    }
    const result = PRIMITIVES[row.primitive]({
      name: token,
      raw: p.exp?.content ?? '',
      modifiers: (p.modifiers ?? []).map((m) => m.content ?? ''),
      scope,
      whitelist: ctx.whitelist,
    }, row)
    ctx.diagnostics.push(...result.diagnostics)
    result.paths.forEach((path) => ctx.pathSet.add(path))
    if (result.attrs.length > 0) mapped.push({ rank: ctx.emissionRank.get(token) ?? 0, attrs: result.attrs })
  }

  // Static attributes: verbatim except (a) ol: metadata stripped (belongs to ingest),
  // (b) `class` values get the styleRules prefix (classPrefix), (c) `is="{{…}}"`
  // rejects as NEGATIVE dynamic-component. Emitted after mapped attrs, source order.
  const plain: OutAttr[] = []
  for (const p of props) {
    if (p.type !== ATTRIBUTE || !p.name) continue
    if (p.name.startsWith('ol:')) continue
    const v = p.value?.content ?? ''
    if (p.name === 'is' && /\{\{/.test(v)) {
      // 运行时拼接组件名 (§2 dynamic-component, 101): parse keeps the attr value as
      // literal text, so `{{` here is the concat form. Attr dropped, element kept
      // (same conservative granularity as model-sugar). The `<{{tag}}>` spelling is
      // reddened earlier by the LOCKED parser itself (1xx parse family).
      ctx.diagnostics.push(negative('dynamic-component'))
      continue
    }
    plain.push({ k: p.name, v: p.name === 'class' ? classPrefix(v, ctx.tables) : v })
  }

  const attrs = [
    ...mapped
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .flatMap((m) => m.attrs),
    ...plain,
  ]

  return {
    kind: 'el',
    tag: tagRow.t ?? tag, // passthrough primitive: tagMap rows all carry passthrough
    attrs,
    children: walkChildren(el.children ?? [], scope, ctx),
  }
}
