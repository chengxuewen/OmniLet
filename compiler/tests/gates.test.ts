// Task 12 (compile-slice1): GATE ASSEMBLY — the four permanent "deliberately
// break it and it MUST redden" regression probes, one named suite (spec §2
// redlines; dsl-spec §5 + D21 engineering line: dead-code elimination runs
// BEFORE Babel lowering — the mpx regenerator trap as the cautionary source).
//
//   P1 缺卷           schema-legal row whose golden dir is absent   -> 302
//   P2 话术变异        negative-copy edit must follow the DATA table -> render
//   P3 词表交集        v-X / ol:X base-word collision                -> 303
//   P4 DCE 顺序        async stuffed in the DEAD branch (base index.ts that
//                      lost to index.wechat.ts) must never reach Babel:
//                      zero dead bytes + zero regenerator helpers in output
//
// Aggregation strategy (chosen deliberately — comment per brief): P1-P3 are
// SELF-CONTAINED re-implementations at this level, not name-registry reruns of
// the originals (tables.test.ts gates 2/3, diag.test.ts mutation self-proof).
// These probes are cheap pure-function calls, so a copy here stays permanently
// valid while the original files get refactored; the originals remain as
// dev-time companions next to their code under test. P4 is NEW here — this is
// the "regenerator dead-branch volume = Task 12 assembly" slot recorded in
// codegen.test.ts:2-3 and task-10-report.md:112. The @babel module-boundary
// scan STAYS SOLELY in codegen.test.ts (fs-walking src/ twice would duplicate,
// not aggregate — the DCE-order probe plus that boundary is the full redline).
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadTables, TableGateError, type RawTableSet } from '../src/tables'
import { negativeEntries, renderExpect } from '../src/diag'
import { compileProject } from '../src/compileProject'

const emptySet = (): RawTableSet => ({
  tagMap: [],
  directiveMap: [],
  eventMap: [],
  lifecycleMap: [],
  exprWhitelist: [],
  styleRules: [],
  capabilityRules: [],
})

function catchGate(fn: () => unknown): TableGateError {
  try {
    fn()
  } catch (e) {
    if (e instanceof TableGateError) return e
    throw e
  }
  throw new Error('expected TableGateError, none thrown')
}

describe('gate P1: 缺卷 — golden-missing (table gate 302)', () => {
  it('schema-legal row pointing at an absent golden dir is refused at load (bites if gate weakened)', () => {
    const bad: RawTableSet = {
      ...emptySet(),
      tagMap: [{ kind: 'tagMap', s: 'view', t: 'view', primitive: 'passthrough', golden: 'g999-no-such-vol' }],
    }
    const err = catchGate(() => loadTables(bad))
    expect(err.gate).toBe('golden-missing')
    expect(err.code).toBe(302)
    expect(err.detail).toMatch(/g999-no-such-vol/)
  })
})

describe('gate P2: 话术变异 — negative copy is data, not hardcoded prose', () => {
  it('mutating an entry hint at runtime moves renderExpect output with it (no branch hardcodes copy)', () => {
    // distinct target from diag.test.ts ('class-obj'): independence, not order luck
    const entry = negativeEntries().find((e) => e.id === 'model-sugar')
    if (!entry) throw new Error('model-sugar entry missing — probe lost its anchor')
    const original = entry.hint
    try {
      entry.hint = 'T12-P2-MUTATED-COPY'
      expect(renderExpect('model-sugar')).toContain('T12-P2-MUTATED-COPY')
    } finally {
      entry.hint = original
    }
    expect(renderExpect('model-sugar')).not.toContain('T12-P2-MUTATED-COPY')
    expect(renderExpect('model-sugar')).toContain(original)
  })
})

describe('gate P3: 词表交集 — vocab-overlap (table gate 303)', () => {
  it('a table declaring both v-slot and ol:slot refuses to load (bites if overlap check removed)', () => {
    // goldens must exist (g001/g002) so the golden gate (302, ordered first)
    // does not mask the vocab gate — proven in tables.test.ts, pinned here.
    const bad: RawTableSet = {
      ...emptySet(),
      directiveMap: [
        { kind: 'directiveMap', s: 'v-slot', t: 'wx:slot', primitive: 'rename', golden: 'g001' },
        { kind: 'directiveMap', s: 'ol:slot', t: 'ol-slot', primitive: 'rename', golden: 'g002' },
      ],
    }
    const err = catchGate(() => loadTables(bad))
    expect(err.gate).toBe('vocab-overlap')
    expect(err.code).toBe(303)
    expect(err.detail).toMatch(/slot/)
  })
})

describe('gate P4: DCE 顺序 — dead-branch elimination precedes Babel lowering', () => {
  const root = mkdtempSync(join(tmpdir(), 'omnilet-dce-'))
  const out = join(root, 'pkg')
  const pages = join(root, 'pages', 'index')
  const DEAD_SENTINEL = 'DEAD-BRANCH-SENTINEL-t12p4' // unique marker in the dead file

  beforeAll(async () => {
    mkdirSync(pages, { recursive: true })
    writeFileSync(join(root, 'app.json'), '{ "pages": ["pages/index/index"] }')
    writeFileSync(
      join(pages, 'index.html'),
      '<view><text>{{ n }}</text><button @tap="inc">+1</button></view>\n',
    )
    // DEAD branch: the base index.ts losing to index.wechat.ts (dsl-spec §5
    // 覆写消解 at the file-selection layer = this slice's DCE). Stuffed with
    // async/await + the sentinel: any leak past selection into (or through)
    // Babel shows as dead bytes or regenerator helpers in the artifact.
    writeFileSync(
      join(pages, 'index.ts'),
      [
        "import { reactive } from 'omnilet'",
        'const state = reactive({ n: 0 })',
        `const ${DEAD_SENTINEL} = 'leak'`,
        'async function deadBranch() { await Promise.resolve(); state.n = 99 }',
        'export default { state, methods: { go() { void deadBranch() } } }',
        '',
      ].join('\n'),
    )
    // LIVE branch: the platform override actually consumed by ingest.
    writeFileSync(
      join(pages, 'index.wechat.ts'),
      [
        "import { reactive } from 'omnilet'",
        'const state = reactive({ n: 0 })',
        'export default { state, methods: { inc() { state.n++ } } }',
        '',
      ].join('\n'),
    )
    const r = await compileProject({ root, outDir: out })
    expect(r.diagnostics).toEqual([])
    expect(r.ok).toBe(true)
  })

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  // Predicate self-probe first (testing-honesty #2): a zero-hit gate is a
  // false green — prove both needles CAN match before asserting absence.
  it('the two bite predicates match their positive controls', () => {
    expect(REGEN_RE.test('var regeneratorRuntime = require("x"); regeneratorRuntime.mark(g)')).toBe(true)
    expect(REGEN_RE.test('function _asyncToGenerator(fn) { return function () { } }')).toBe(true)
    expect(REGEN_RE.test('async function live() { await p }')).toBe(false) // passthrough is legal
    expect(readFileSync(join(pages, 'index.ts'), 'utf8')).toContain(DEAD_SENTINEL)
  })

  it('artifact carries ZERO dead-branch bytes and ZERO regenerator helpers', () => {
    const all = walk(out).map((abs) => readFileSync(abs, 'utf8'))
    // dead file never crossed the selection boundary into any artifact
    expect(all.some((t) => t.includes(DEAD_SENTINEL))).toBe(false)
    expect(all.some((t) => t.includes('deadBranch'))).toBe(false)
    // DCE-before-Babel form: live async would pass through UNtranspiled;
    // any lowering helper means regenerator-shaped ES5 ran on the pipeline
    expect(all.some((t) => REGEN_RE.test(t))).toBe(false)
    // AND the live override was consumed (not a silent empty build)
    const pageJs = readFileSync(join(out, 'pages', 'index', 'index.js'), 'utf8')
    expect(pageJs).toContain('inc')
    expect(pageJs).not.toContain('go(')
  })
})

// Babel-ES5 / regenerator-shape helpers (async-to-generator lowering marks).
const REGEN_RE = /regeneratorRuntime|_?asyncToGenerator|asyncGeneratorStep|_asyncGenerator/i

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

describe('gate P5: web golden namespace isolation (slice 2) — g-web-gNNN never collides with wechat gNNN', () => {
  it('every web-table golden id carries the g-web- prefix; ids exist on disk and stay disjoint from wechat ids', async () => {
    // data-file isolation probe (slice-2 brief): the wechat table owns gNNN ids,
    // the web table owns g-web-gNNN ids — a shared dir would let either target's
    // re-record clobber the other's golden bytes. Bites if a web row drops the prefix.
    const { webTables } = await import('../rules/web')
    const { wechatTables } = await import('../rules/wechat')
    const { defaultGoldenRoot } = await import('../src/tables')
    const G = defaultGoldenRoot()
    const webIds = Object.values(webTables).flatMap((rows) => rows.map((r) => r.golden))
    const wxIds = Object.values(wechatTables).flatMap((rows) => rows.map((r) => r.golden))
    expect(webIds.length).toBeGreaterThan(0)
    for (const id of webIds) {
      expect(id.startsWith('g-web-')).toBe(true)
      expect(wxIds).not.toContain(id)
    }
    // ids unique within the web table (each row owns its own volume)
    expect(new Set(webIds).size).toBe(webIds.length)
    // and every web golden dir actually exists with both non-empty files (gate 302 positive proof)
    for (const id of webIds) {
      expect(readFileSync(join(G, id, 'in.html')).length).toBeGreaterThan(0)
      expect(readFileSync(join(G, id, 'expected.out.txt')).length).toBeGreaterThan(0)
    }
  })
})

