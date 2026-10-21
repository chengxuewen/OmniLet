// Task 8: per-primitive worked examples (the brief's "附录实例" obligation, encoded).
// Each primitive gets (a) a direct PRIMITIVES call pinning its fixed-point behavior
// and (b) an end-to-end fragment through rewrite() where a shipped row exercises it.
// classPrefix / lifecyclePassthrough have no rows yet (T9) — their entries are
// pinned by direct calls so the closed Record<PrimName, fn> stays exhaustively tested.
import { describe, expect, it } from 'vitest'
import { PRIMITIVES, rewrite, serializeAst, type ForScope, type PrimJob } from './rewrite'
import { buildExprWhitelist } from './expr'
import { buildTemplateAst } from './ir'
import { loadTables } from './tables'
import { PRIM_NAMES } from './types'
import type { TableRow } from './types'
import { wechatTables } from '../rules/wechat'

const tables = loadTables(wechatTables)
const whitelist = buildExprWhitelist(wechatTables.exprWhitelist)

const rowOf = (s: string): TableRow => {
  const all = [...tables.tagMap, ...tables.directiveMap, ...tables.eventMap, ...tables.exprWhitelist]
  const row = all.find((r) => r.s === s)
  if (!row) throw new Error(`no table row '${s}'`)
  return row
}

const job = (raw: string, over: Partial<PrimJob> = {}): PrimJob => ({
  name: 'probe',
  raw,
  modifiers: [],
  scope: null,
  whitelist,
  ...over,
})

const run = (html: string) => {
  const { ast, diagnostics } = buildTemplateAst(html, 'primitive-probe')
  expect(diagnostics).toEqual([])
  return rewrite(ast, tables)
}

/** Fabricated row for primitives whose real rows land in T9. */
const synthetic = (s: string, t: string, primitive: TableRow['primitive']): TableRow => ({
  kind: 'directiveMap',
  s,
  t,
  primitive,
  golden: 'unused-in-direct-call',
})

describe('PRIMITIVES record covers the closed primitive set', () => {
  it('has exactly one entry per PrimName (D21 8-value enum)', () => {
    expect(Object.keys(PRIMITIVES).sort()).toEqual([...PRIM_NAMES].sort())
  })
})

describe('passthrough — tagMap identity rows ("不在表里=不存在")', () => {
  it('view row: tag kept, children walked end-to-end', () => {
    const out = run('<view><text>x</text></view>')
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe('<view>\n  <text>\n    text:x\n  </text>\n</view>\n')
  })

  it('word-level entry is identity: name -> same attr', () => {
    expect(PRIMITIVES.passthrough(job('x', { name: 'view' }), rowOf('view')).attrs).toEqual([
      { k: 'view', v: 'x' },
    ])
  })

  it('off-table tag is rejected whole-subtree (2xx tag-unknown, spec §3 白名单哲学)', () => {
    const out = run('<div><text>gone</text></div><view></view>')
    expect(out.diagnostics.map((d) => d.code)).toEqual([208])
    expect(serializeAst(out.outAst)).toBe('<view>\n</view>\n')
  })
})

describe('rename — v-if -> wx:if (table token swap)', () => {
  it('direct: target name from row.t, value untouched when row has no wrap', () => {
    const row: TableRow = { kind: 'directiveMap', s: 'v-show', t: 'hidden', primitive: 'rename', golden: 'unused' }
    expect(PRIMITIVES.rename(job('ready'), row).attrs).toEqual([{ k: 'hidden', v: 'ready' }])
  })

  it('end-to-end with the shipped wrap:true row: wx:if="{{ready}}" + path ready', () => {
    const out = run('<view v-if="ready"></view>')
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe('<view wx:if="{{ready}}">\n</view>\n')
    expect(out.paths).toEqual(['ready'])
  })
})

describe('wrapExpr — attribute-granular wrapping (D5 mixed mode)', () => {
  it('direct: bare expr wrapped into {{…}} for a wrap-declared row', () => {
    const row = synthetic('v-show', 'hidden', 'wrapExpr')
    expect(PRIMITIVES.wrapExpr(job('ready'), row).attrs).toEqual([{ k: 'hidden', v: '{{ready}}' }])
  })

  it('direct: wrap:false row passes the value through bare (wx:for list mode)', () => {
    const row = synthetic('v-test', 'bare', 'wrapExpr')
    expect(PRIMITIVES.rename(job('list'), row).attrs).toEqual([{ k: 'bare', v: 'list' }])
  })
})

describe('splitDirective — v-for header split (`:of`/3-tuple rejected, no invented variant)', () => {
  it('direct: (item, idx) in list -> wx:for + wx:for-item + wx:for-index + alias scope', () => {
    const res = PRIMITIVES.splitDirective(job('(item, idx) in list'), rowOf('v-for'))
    expect(res.attrs).toEqual([
      { k: 'wx:for', v: 'list' },
      { k: 'wx:for-item', v: 'item' },
      { k: 'wx:for-index', v: 'idx' },
    ])
    expect(res.scope).toEqual({ item: 'item', index: 'idx' })
    expect(res.paths).toEqual(['list'])
  })

  it('direct: `of` iteration protocol -> 203 (NEGATIVE vfor-proto wording + reason)', () => {
    const res = PRIMITIVES.splitDirective(job('item of list'), rowOf('v-for'))
    expect(res.attrs).toEqual([])
    expect(res.diagnostics.map((d) => d.code)).toEqual([203])
    expect(res.diagnostics[0]!.message).toMatch(/of.*迭代协议/)
  })

  it('direct: 3-tuple destructuring -> 203', () => {
    const res = PRIMITIVES.splitDirective(job('(value, key, index) in list'), rowOf('v-for'))
    expect(res.diagnostics.map((d) => d.code)).toEqual([203])
  })

  it('end-to-end: aliases are emitted explicitly (wx:for-item/wx:for-index always)', () => {
    const out = run('<view v-for="(row, i) in rows"><text>{{ i }}</text></view>')
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe(
      '<view wx:for="rows" wx:for-item="row" wx:for-index="i">\n  <text>\n    {{i}}\n  </text>\n</view>\n',
    )
    expect(out.paths).toEqual(['rows']) // `i` is a loop alias, not a data path
  })
})

describe('keyTransform — :key -> wx:key (static string vs index-value rules)', () => {
  const scope = { item: 'item', index: 'idx' }
  const key = (raw: string, sc: ForScope = scope) => PRIMITIVES.keyTransform(job(raw, { scope: sc }), rowOf(':key'))

  it('index alias -> "index"', () => {
    expect(key('idx').attrs).toEqual([{ k: 'wx:key', v: 'index' }])
  })
  it('loop item itself -> "*this"', () => {
    expect(key('item').attrs).toEqual([{ k: 'wx:key', v: '*this' }])
  })
  it('item property -> property name', () => {
    expect(key('item.id').attrs).toEqual([{ k: 'wx:key', v: 'id' }])
  })
  it("static string literal -> its text", () => {
    expect(key("'stable'").attrs).toEqual([{ k: 'wx:key', v: 'stable' }])
  })
  it('bare identifier outside a loop -> treated as the property name', () => {
    expect(key('id', null).attrs).toEqual([{ k: 'wx:key', v: 'id' }])
  })
  it('nested member path -> 210 unsupported', () => {
    expect(key('item.address.city').diagnostics.map((d) => d.code)).toEqual([210])
  })
})

describe('valueMap — @tap -> bindtap, `.stop` -> catchtap (parameterised rename)', () => {
  const ev = (raw: string, modifiers: string[] = []) =>
    PRIMITIVES.valueMap(job(raw, { modifiers }), rowOf('@tap'))

  it('direct: handler name passes through as the binding value', () => {
    expect(ev('inc').attrs).toEqual([{ k: 'bindtap', v: 'inc' }])
  })
  it('direct: .stop switches bind -> catch', () => {
    expect(ev('inc', ['stop']).attrs).toEqual([{ k: 'catchtap', v: 'inc' }])
  })
  it('direct: any other modifier -> 206', () => {
    expect(ev('inc', ['capture']).diagnostics.map((d) => d.code)).toEqual([206])
  })
  it('direct: non-identifier handler -> 205 (NEGATIVE handler-form)', () => {
    expect(ev('a + b').diagnostics.map((d) => d.code)).toEqual([205])
  })
  it('end-to-end: @tap.stop on a button', () => {
    const out = run('<button @tap.stop="inc">+1</button>')
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe('<button catchtap="inc">\n  text:+1\n</button>\n')
  })
})

describe('classPrefix / lifecyclePassthrough — minimal entries (rows land in T9)', () => {
  it('classPrefix prefixes the template-side class value from row.t', () => {
    const row = synthetic('class', 'omnilet-', 'classPrefix')
    expect(PRIMITIVES.classPrefix(job('box'), row).attrs).toEqual([{ k: 'class', v: 'omnilet-box' }])
  })
  it('lifecyclePassthrough keeps the hook word (词表直通 witness)', () => {
    const row: TableRow = { kind: 'lifecycleMap', s: 'onLoad', primitive: 'lifecyclePassthrough', golden: 'unused' }
    expect(PRIMITIVES.lifecyclePassthrough(job('onLoad'), row).attrs).toEqual([{ k: 'onLoad', v: 'onLoad' }])
  })
})

describe('attribute emission order is table-driven, not source-driven', () => {
  it(':key written before v-for still emits wx:key after the wx:for family (row order)', () => {
    const out = run('<view :key="idx" v-for="(item, idx) in list"></view>')
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe(
      '<view wx:for="list" wx:for-item="item" wx:for-index="idx" wx:key="index">\n</view>\n',
    )
  })

  it('mapped attrs precede plain attrs; plain attrs keep source order', () => {
    const out = run('<view id="a" v-if="ready" class="box"></view>')
    expect(serializeAst(out.outAst)).toBe('<view wx:if="{{ready}}" id="a" class="box">\n</view>\n')
  })
})
