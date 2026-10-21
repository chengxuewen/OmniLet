// Task 8: rewrite end-to-end — per-row golden harness (the serializer contract in
// action), the counter fixture as one rewrite pass, whitelist escape diagnostics,
// and kill-probes proving the output is table-driven (mutate a row -> output moves).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildTemplateAst } from './ir'
import { defaultGoldenRoot, loadTables, type RawTableSet } from './tables'
import { rewrite, serializeAst } from './rewrite'
import type { TableRow } from './types'
import { wechatTables } from '../rules/wechat'
import { assertNormalized } from '../../packages/rule-schema/src/index'
import { NEGATIVE_ENTRIES, renderExpect } from './diag'

const GOLDEN = defaultGoldenRoot()
const tables = loadTables(wechatTables)

function compileFragment(html: string) {
  const { ast, diagnostics: parseDiags } = buildTemplateAst(html, 'fragment')
  expect(parseDiags).toEqual([])
  return rewrite(ast, tables)
}

// ---------------------------------------------------------------- golden harness

// Every mapping-partition + whitelist row owns a golden pair: in.html parsed and
// rewritten must serialize byte-for-byte to expected.out.txt (NORMALIZATION pre-
// check first — a failing golden never reaches diff). This harness is the positive
// volume machine; T9 extends the same loop with negative volumes.
const rowPartitions: TableRow[][] = [tables.tagMap, tables.directiveMap, tables.eventMap, tables.exprWhitelist]

describe('per-row positive goldens (rewrite + serializeAst byte contract)', () => {
  const seen = new Set<string>()
  for (const partition of rowPartitions) {
    for (const row of partition) {
      if (seen.has(row.golden)) continue
      seen.add(row.golden)
      it(`${row.golden}: '${row.s}' -> expected.out.txt`, () => {
        const inHtml = readFileSync(join(GOLDEN, row.golden, 'in.html'), 'utf8')
        const stored = readFileSync(join(GOLDEN, row.golden, 'expected.out.txt'), 'utf8')
        expect(() => assertNormalized(stored)).not.toThrow()
        const out = compileFragment(inHtml)
        expect(out.diagnostics).toEqual([]) // positive volume: clean rewrite
        expect(serializeAst(out.outAst)).toBe(stored)
      })
    }
  }

  it('all 17 row goldens g001-g017 are covered by the loop', () => {
    expect(seen.size).toBe(17)
  })
})

// ------------------------------------------------------------------- fixture e2e

describe('counter fixture template rewrites in one pass', () => {
  const fixtureHtml = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'counter', 'pages', 'index', 'index.html'),
    'utf8',
  )

  it('produces the frozen WXML-flat shape, alias-free paths, zero diagnostics', () => {
    const out = compileFragment(fixtureHtml)
    expect(out.diagnostics).toEqual([])
    expect(serializeAst(out.outAst)).toBe(
      '<view wx:if="{{ready}}" class="box">\n' +
        '  <text>\n' +
        '    {{count}}\n' +
        '  </text>\n' +
        '  <view wx:for="list" wx:for-item="item" wx:for-index="idx" wx:key="index">\n' +
        '    <text>\n' +
        '      {{item}}\n' +
        '    </text>\n' +
        '  </view>\n' +
        '  <button bindtap="inc">\n' +
        '    text:+1\n' +
        '  </button>\n' +
        '</view>\n',
    )
    expect(out.paths).toEqual(['count', 'list', 'ready'])
  })

  it('ol:requires is consumed by ingest (T6) and never reaches WXML output', () => {
    const out = compileFragment('<view ol:requires="storage"></view>')
    expect(serializeAst(out.outAst)).toBe('<view>\n</view>\n')
  })

  it('input AST is not mutated: serializing the source twice is stable', () => {
    const first = buildTemplateAst(fixtureHtml, 'counter')
    rewrite(first.ast, tables)
    const shapeOfOriginal = JSON.stringify(first.ast)
    rewrite(first.ast, tables)
    expect(JSON.stringify(first.ast)).toBe(shapeOfOriginal)
  })
})

// -------------------------------------------------------------- whitelist escapes

describe('expression whitelist rejects off-grammar shapes with 2xx (never throws)', () => {
  const rejects: [string, RegExp][] = [
    ['{{ user.getName() }}', /function call/],
    ['{{ a?.b }}', /optional chaining/],
    ['{{ a ?? b }}', /nullish/],
    ['{{ total = 1 }}', /assignment/],
    ['{{ list[0] }}', /computed access/],
    ['{{ `hi ${name}` }}', /template literal/],
    ['{{ a@b }}', /unexpected character/],
  ]

  it.each(rejects)('%s drops the node and reports reason', (html, reasonRe) => {
    const out = compileFragment(`<text>${html}</text>`)
    expect(out.diagnostics.map((d) => d.code)).toEqual([209])
    expect(out.diagnostics[0]!.message).toMatch(reasonRe)
    expect(out.outAst).toEqual([{ kind: 'el', tag: 'text', attrs: [], children: [] }]) // interp not emitted
  })

  it('a bad interpolation does not stop the walk: siblings and later errors keep coming', () => {
    const out = compileFragment('<text>{{ f() }}</text><text>{{ ok }}</text><div></div>')
    expect(out.diagnostics.map((d) => d.code)).toEqual([209, 208])
    expect(serializeAst(out.outAst)).toBe('<text>\n</text>\n<text>\n  {{ok}}\n</text>\n')
  })

  it('typeof/in/new stay out of the whitelist (conservative, spec §9 UNCERTAIN)', () => {
    expect(compileFragment('<text>{{ typeof x }}</text>').diagnostics[0]!.message).toMatch(/typeof/)
    expect(compileFragment('<text>{{ a in b }}</text>').diagnostics[0]!.message).toMatch(/unexpected 'in'/)
  })

  it('unrecognized operator is a token-level escape (bitwise & never tokenizes)', () => {
    expect(compileFragment('<text>{{ a & b }}</text>').diagnostics[0]!.message).toMatch(/unexpected character '&'/)
  })

  it('directives carrying escaped expressions drop only their attr, element survives', () => {
    const out = compileFragment('<view v-if="cond()"></view>')
    expect(out.diagnostics.map((d) => d.code)).toEqual([209])
    expect(serializeAst(out.outAst)).toBe('<view>\n</view>\n')
  })
})

describe('NEGATIVE entries drive their codes through rewrite (话术单源)', () => {
  it('v-model -> 201, :class object -> 202, v-for `of` -> 203, handler expr -> 205', () => {
    expect(compileFragment('<view v-model="x"></view>').diagnostics.map((d) => d.code)).toEqual([201])
    expect(compileFragment('<view :class="{ active: on }"></view>').diagnostics.map((d) => d.code)).toEqual([202])
    expect(compileFragment('<view v-for="row of rows"></view>').diagnostics.map((d) => d.code)).toEqual([203])
    expect(compileFragment('<button @tap="go(a)"></button>').diagnostics.map((d) => d.code)).toEqual([205])
  })

  it('the emitted copy equals the NEGATIVES table render (no second source)', () => {
    const out = compileFragment('<view :class="a + b"></view>')
    const d = out.diagnostics.find((x) => x.code === 202)!
    const entry = NEGATIVE_ENTRIES.find((e) => e.code === 202)!
    expect(`${d.code} ${d.message} hint: ${d.hint}`).toBe(renderExpect(entry.id))
  })

  it('off-table directive -> 207 directive-unknown', () => {
    expect(compileFragment('<view v-show="x"></view>').diagnostics.map((d) => d.code)).toEqual([207])
  })
})

// ------------------------------------------------------------------- kill probes

const cloneTables = (): RawTableSet => structuredClone(wechatTables)

describe('kill-probes: output is table-driven (mutate row -> output moves)', () => {
  it('tagMap view row t=probe-view-tag moves the g001 element line', () => {
    const mutated = cloneTables()
    mutated.tagMap[0]!.t = 'probe-view-tag'
    const probe = rewrite(buildTemplateAst('<view></view>', 'probe').ast, loadTables(mutated))
    const real = rewrite(buildTemplateAst('<view></view>', 'probe').ast, tables)
    expect(serializeAst(probe.outAst)).toBe('<probe-view-tag>\n</probe-view-tag>\n')
    expect(serializeAst(probe.outAst)).not.toBe(serializeAst(real.outAst))
  })

  it('directiveMap v-if row t=probe-if moves the g004 attr name', () => {
    const mutated = cloneTables()
    mutated.directiveMap[0]!.t = 'probe-if'
    const probe = rewrite(buildTemplateAst('<view v-if="ready"></view>', 'probe').ast, loadTables(mutated))
    expect(serializeAst(probe.outAst)).toBe('<view probe-if="{{ready}}">\n</view>\n')
  })

  it('eventMap @tap row t=probe-tap moves the g007 binding name', () => {
    const mutated = cloneTables()
    mutated.eventMap[0]!.t = 'probe-tap'
    const probe = rewrite(buildTemplateAst('<button @tap="inc"></button>', 'probe').ast, loadTables(mutated))
    expect(serializeAst(probe.outAst)).toBe('<button probe-tap="inc">\n</button>\n')
  })

  it('exprWhitelist row removal rejects that node type (g008 Identifier row deleted)', () => {
    const mutated = cloneTables()
    mutated.exprWhitelist = mutated.exprWhitelist.filter((r) => r.s !== 'Identifier')
    const probe = rewrite(buildTemplateAst('<text>{{ count }}</text>', 'probe').ast, loadTables(mutated))
    expect(probe.diagnostics.map((d) => d.code)).toEqual([209])
    expect(probe.diagnostics[0]!.message).toMatch(/Identifier not in exprWhitelist/)
  })

  it('restored tables reproduce the shipped goldens byte-for-byte (probe is not permanent)', () => {
    const restored = loadTables(cloneTables())
    const out = rewrite(buildTemplateAst('<view v-if="ready"></view>', 'probe').ast, restored)
    expect(serializeAst(out.outAst)).toBe(readFileSync(join(GOLDEN, 'g004', 'expected.out.txt'), 'utf8'))
  })
})
