import { describe, it, expect } from 'vitest'
import {
  loadTables,
  TableGateError,
  vocabOverlap,
  KNOWN_V_PREFIX,
  defaultGoldenRoot,
  type RawTableSet,
} from './tables'
import { wechatTables } from '../rules/wechat'
import type { TableRow } from './types'

// T5 contract: rule-table loader with three load-time gates, run in order
// schema(ajv, 301) -> golden-missing(302) -> vocab-overlap(303); any failure
// throws TableGateError. "Table is data, data must be legal" is enforced here,
// before any compilation runs. Each gate carries a permanent poisoned-probe
// regression (goes red if the gate is weakened/removed).

const emptySet = (): RawTableSet => ({
  tagMap: [],
  directiveMap: [],
  eventMap: [],
  lifecycleMap: [],
  exprWhitelist: [],
  styleRules: [],
  capabilityRules: [],
})

// The schema gate is a DATA-layer check; these probes must inject an
// out-of-enum primitive past the type layer, hence the deliberate cast.
const poison = (row: Record<string, unknown>): TableRow => row as unknown as TableRow

const withTag = (rows: RawTableSet['tagMap']): RawTableSet => ({ ...emptySet(), tagMap: rows })
const withDir = (rows: RawTableSet['directiveMap']): RawTableSet => ({
  ...emptySet(),
  directiveMap: rows,
})

describe('loadTables happy path (real wechat table)', () => {
  it('loads the shipped wechat table without throwing; tagMap=3, other six empty', () => {
    const set = loadTables(wechatTables)
    expect(set.tagMap.map((r) => r.s)).toEqual(['view', 'text', 'button'])
    expect(set.directiveMap).toEqual([])
    expect(set.eventMap).toEqual([])
    expect(set.lifecycleMap).toEqual([])
    expect(set.exprWhitelist).toEqual([])
    expect(set.styleRules).toEqual([])
    expect(set.capabilityRules).toEqual([])
  })

  it('defaultGoldenRoot points at compiler/tests/golden (g001-g003 exist)', () => {
    expect(defaultGoldenRoot().replace(/\\/g, '/')).toMatch(/compiler\/tests\/golden$/)
  })
})

describe('gate 1: schema (ajv) — code 301', () => {
  // Probe: a row whose primitive is outside the closed 8-value enum.
  it('rejects a row with an illegal primitive (poisoned probe — bites if gate removed)', () => {
    const bad = withTag([poison({ kind: 'tagMap', s: 'view', primitive: 'wrapBlock', golden: 'g001' })])
    const err = catchGate(() => loadTables(bad))
    expect(err).toBeInstanceOf(TableGateError)
    expect(err.gate).toBe('schema')
    expect(err.code).toBe(301)
    expect(err.detail).toMatch(/primitive/)
  })

  it('rejects a row missing the required golden field', () => {
    const bad = withTag([{ kind: 'tagMap', s: 'view' } as RawTableSet['tagMap'][number]])
    expect(catchGate(() => loadTables(bad)).gate).toBe('schema')
  })

  // Gate ORDER self-proof: schema runs first. A row that is BOTH schema-illegal
  // AND golden-missing must be reported as 'schema', not 'golden-missing'.
  it('schema gate precedes golden gate (ordering probe)', () => {
    const bad = withTag([poison({ kind: 'tagMap', s: 'view', primitive: 'wrapBlock', golden: 'no-such' })])
    expect(catchGate(() => loadTables(bad)).gate).toBe('schema')
  })
})

describe('gate 2: golden existence — code 302', () => {
  // Probe: schema-valid row whose golden id has no directory.
  it('rejects a row whose golden dir is missing (poisoned probe)', () => {
    const bad = withTag([{ kind: 'tagMap', s: 'view', golden: 'g999' }])
    const err = catchGate(() => loadTables(bad))
    expect(err.gate).toBe('golden-missing')
    expect(err.code).toBe(302)
    expect(err.detail).toMatch(/g999/)
  })

  it('golden gate precedes vocab gate (ordering probe): colliding rows w/ missing goldens report golden-missing', () => {
    const bad = withDir([
      { kind: 'directiveMap', s: 'v-slot', golden: 'no-such' },
      { kind: 'directiveMap', s: 'ol:slot', golden: 'no-such' },
    ])
    expect(catchGate(() => loadTables(bad)).gate).toBe('golden-missing')
  })
})

describe('gate 3: v-/ol: vocabulary intersection — code 303', () => {
  it('rejects a table-declared collision (v-slot + ol:slot share base word, poisoned probe)', () => {
    const bad = withDir([
      { kind: 'directiveMap', s: 'v-slot', golden: 'g001' },
      { kind: 'directiveMap', s: 'ol:slot', golden: 'g001' },
    ])
    const err = catchGate(() => loadTables(bad))
    expect(err.gate).toBe('vocab-overlap')
    expect(err.code).toBe(303)
    expect(err.detail).toMatch(/slot/)
  })

  it('rejects an ol: row invading the hardcoded base-directive domain (ol:show, "反丑纪律")', () => {
    const bad = withDir([{ kind: 'directiveMap', s: 'ol:show', golden: 'g001' }])
    expect(catchGate(() => loadTables(bad)).gate).toBe('vocab-overlap')
  })

  it('vocabOverlap() predicate runs directly over rows (check function exists + bites)', () => {
    expect(vocabOverlap(withDir([{ kind: 'directiveMap', s: 'v-slot', golden: 'g001' }]).directiveMap)).toEqual([])
    expect(
      vocabOverlap([
        { kind: 'directiveMap', s: 'v-slot', golden: 'g001' },
        { kind: 'directiveMap', s: 'ol:slot', golden: 'g002' },
      ]),
    ).toEqual(['slot'])
  })

  it('KNOWN_V_PREFIX pins the reserved base-directive words ol: may never claim', () => {
    for (const w of ['if', 'for', 'model', 'show', 'slot']) expect(KNOWN_V_PREFIX).toContain(w)
  })

  it('a tagMap row named "text" is NOT pulled into the vocab sets (prefix-classified only)', () => {
    expect(vocabOverlap(wechatTables.tagMap)).toEqual([])
  })
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
