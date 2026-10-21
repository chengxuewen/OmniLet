// Task 9: the negative matrix representatives — one live probe per code family
// (1xx/2xx/3xx/4xx). The full "each segment >= 1 row" matrix assertion is T12;
// this file guarantees a representative EXISTS per family. Expected wording is
// diffed byte-equal against renderExpect(id) — the T4 single source, never a
// second copy of the话术.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTemplateAst } from './ir'
import { defaultGoldenRoot, loadTables, TableGateError } from './tables'
import { classPrefix, rewrite, serializeAst } from './rewrite'
import { NEGATIVE_ENTRIES, renderExpect } from './diag'
import { checkCapabilities, CAPABILITY_UNREGISTERED } from './capabilities'
import { assertNormalized, loadCapabilities } from '../../packages/rule-schema/src/index'
import { wechatTables } from '../rules/wechat'

const tables = loadTables(wechatTables)

function compileFragment(html: string) {
  const { ast, diagnostics: parseDiags } = buildTemplateAst(html, 'negative-probe')
  expect(parseDiags).toEqual([]) // fragment itself must parse clean; the negative is in the rewrite
  return rewrite(ast, tables)
}

/** Rendered diag = `code message hint: hint` — the negative-volume expect-text. */
const rendered = (html: string): string[] =>
  compileFragment(html).diagnostics.map((d) => `${d.code} ${d.message} hint: ${d.hint}`)

// ------------------------------------------------------------------ 1xx family

describe('1xx form-negative representatives', () => {
  it('<view is="{{x}}"> -> 101 dynamic-component, attr dropped, element survives', () => {
    expect(rendered('<view is="{{x}}"></view>')).toEqual([renderExpect('dynamic-component')])
    expect(serializeAst(compileFragment('<view is="{{x}}"></view>').outAst)).toBe('<view>\n</view>\n')
  })

  it('static is="plain-name" carries no concat — inert attr, zero diagnostics', () => {
    expect(compileFragment('<view is="plain"></view>').diagnostics).toEqual([])
  })

  it('the <{{tagName}}> spelling is reddened at PARSE level (documented conservative cousin of 101)', () => {
    // The LOCKED parser cannot represent a concatenated tag name pre-codegen: it emits
    // 1xx lex/parse noise (ir.ts base 110 + vue code 23 'Invalid end tag'). The visitor
    // detects the `is=` form; this spelling is already fail-closed one stage earlier.
    const res = buildTemplateAst('<{{ tagName }}></view>', 'negative-probe')
    expect(res.diagnostics.length).toBeGreaterThan(0)
    expect(res.diagnostics[0]!.code).toBeGreaterThanOrEqual(110)
    expect(res.diagnostics[0]!.code).toBeLessThan(200)
    expect(res.diagnostics[0]!.message).toContain('Invalid end tag')
    expect(renderExpect('dynamic-component')).toContain('替代') // entry-level copy holds
  })

  it('func-macro / dynamic-include / iframe: entry-level copy pinned; conservative surfacing documented', () => {
    for (const id of ['func-macro', 'dynamic-include', 'iframe']) expect(renderExpect(id)).toContain('替代')
    // <iframe> is off tagMap -> 208 tag-unknown (whole subtree dropped): the fail-closed
    // conservative form of §2 entry 104. Dedicated 104 routing belongs to tagMap negative
    // wiring (§2 footer sync flow); wording here is strictly more conservative, never laxer.
    expect(compileFragment('<iframe src="https://x"></iframe>').diagnostics.map((d) => d.code)).toEqual([208])
  })
})

// ------------------------------------------------------------------ 2xx family

describe('2xx whitelist-escape representatives (NEGATIVE ids drive wording byte-equal)', () => {
  const cases: [string, string][] = [
    ['<view v-model="x"></view>', 'model-sugar'],
    ['<view :class="{ active: on }"></view>', 'class-obj'],
    ['<view :style="[a, b]"></view>', 'class-obj'],
    ['<button @tap="a+b"></button>', 'handler-form'],
  ]

  it.each(cases)('%s -> entry "%s" expected text', (html, id) => {
    expect(rendered(html)).toEqual([renderExpect(id)])
  })

  it('v-for 3-tuple -> 203 vfor-proto table wording + shape reason suffix', () => {
    const e = NEGATIVE_ENTRIES.find((x) => x.id === 'vfor-proto')!
    expect(rendered('<view v-for="(value, key, index) in list"></view>')).toEqual([
      `${e.code} ${e.message}（非 \`(item, index) in list\` 两元形态） hint: ${e.hint}`,
    ])
  })

  it('T9 refinement of class-obj: ONLY object/array literals reject; whitelist-legal exprs emit the target attr', () => {
    const legal = compileFragment('<view :class="box"></view>')
    expect(legal.diagnostics).toEqual([])
    expect(serializeAst(legal.outAst)).toBe('<view class="{{box}}">\n</view>\n') // trimmed-verbatim, serializer style
    expect(legal.paths).toEqual(['box'])
    expect(compileFragment('<view :style="ready ? a : b"></view>').diagnostics).toEqual([])
    // an off-whitelist expr on :class is the ORDINARY 209 escape, not class-obj wording
    expect(compileFragment('<view :class="foo()"></view>').diagnostics.map((d) => d.code)).toEqual([209])
  })

  it('ts-unerasurable (204): entry data pinned now; detection is codegen/js.ts territory (T10)', () => {
    const e = NEGATIVE_ENTRIES.find((x) => x.id === 'ts-unerasurable')!
    expect(e.code).toBe(204)
    expect(renderExpect('ts-unerasurable')).toBe(`${e.code} ${e.message} hint: ${e.hint}`)
    // T10 plan: the js.ts type-stripping kernel routes enum/namespace/parameter-property
    // through this entry (erasableSyntaxOnly discipline). The template layer never sees TS.
  })

  it('206-210 are the table-less escape codes (no §2 row): modifiers/directive/tag/expr/key', () => {
    // Formal mapping (T9 ruling): §2-family diags route through NEGATIVE_ENTRIES ids;
    // these five are escapes WITHOUT a §2 row, wording lives in rewrite.ts, each pinned:
    expect(compileFragment('<button @tap.capture="inc"></button>').diagnostics.map((d) => d.code)).toEqual([206])
    expect(compileFragment('<view v-show="x"></view>').diagnostics.map((d) => d.code)).toEqual([207])
    expect(compileFragment('<div></div>').diagnostics.map((d) => d.code)).toEqual([208])
    expect(compileFragment('<text>{{ f() }}</text>').diagnostics.map((d) => d.code)).toEqual([209])
    expect(compileFragment('<view v-for="(item, idx) in list" :key="item.address.city"></view>').diagnostics.map((d) => d.code)).toEqual([210])
  })
})

// ------------------------------------------------------------------ 3xx family

describe('3xx table-gate representatives (full poisoned probes live in tables.test.ts — cross-ref, no duplication)', () => {
  it('the shipped wechat table clears all three gates (301/302/303 green baseline)', () => {
    expect(() => loadTables(wechatTables)).not.toThrow()
  })

  it('302 bites a capabilityRules row whose golden dir is missing (representative probe)', () => {
    const bad = structuredClone(wechatTables)
    bad.capabilityRules.push({ kind: 'capabilityRules', s: 'camera', golden: 'g999' })
    let err: TableGateError | null = null
    try {
      loadTables(bad)
    } catch (e) {
      if (e instanceof TableGateError) err = e
    }
    expect(err?.gate).toBe('golden-missing')
    expect(err?.code).toBe(302)
  })
})

// ------------------------------------------------------------------ 4xx family

describe('4xx capability family (manifest validator lands T10; check + codes named now)', () => {
  it('storage passes against the registered vocabulary (rule-schema capabilities.json single source)', () => {
    expect(loadCapabilities()).toEqual(['storage'])
    expect(checkCapabilities(['storage'], loadCapabilities())).toEqual([])
    expect(checkCapabilities([], loadCapabilities())).toEqual([])
  })

  it('bluetooth -> one 401 Diag naming D17; dedup keeps first-occurrence order', () => {
    const diags = checkCapabilities(['bluetooth', 'storage', 'bluetooth'], loadCapabilities())
    expect(diags.map((d) => d.code)).toEqual([CAPABILITY_UNREGISTERED])
    expect(diags[0]!.message).toContain('bluetooth')
    expect(diags[0]!.hint).toContain('D17')
  })

  it('storage capabilityRules row exists — the declaration word is table data too', () => {
    expect(tables.capabilityRules.map((r) => r.s)).toEqual(['storage'])
    expect(tables.capabilityRules[0]!.t).toBe('omnilet.storage')
  })
})

// ------------------------------------------------ classPrefix same-source table

describe('classPrefix — template/css same-source word table (g021 volume)', () => {
  it('g021 in.html rewrites byte-for-byte to expected.out.txt', () => {
    const root = defaultGoldenRoot()
    const inHtml = readFileSync(join(root, 'g021', 'in.html'), 'utf8')
    const stored = readFileSync(join(root, 'g021', 'expected.out.txt'), 'utf8')
    expect(() => assertNormalized(stored)).not.toThrow()
    const out = compileFragment(inHtml)
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe(stored)
  })

  it('the exported function and the styleRules class row are ONE lookup — no second prefix constant', () => {
    const row = tables.styleRules.find((r) => r.primitive === 'classPrefix')!
    expect(row.s).toBe('class')
    expect(classPrefix('box', tables)).toBe(`${row.t}box`) // css codegen (T10) composes the same way
    expect(classPrefix('box wide  omnilet-already', tables)).toBe('omnilet-box omnilet-wide omnilet-already')
  })

  it('exempt-flagged styleRules word skips the prefix (table-driven, clone-probed)', () => {
    const mutated = structuredClone(wechatTables)
    mutated.styleRules.push({ kind: 'styleRules', s: 'safe-area', exempt: true, golden: 'g021' })
    expect(classPrefix('safe-area box', loadTables(mutated))).toBe('safe-area omnilet-box')
  })
})
