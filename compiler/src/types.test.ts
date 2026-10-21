import { describe, it, expect } from 'vitest'
import { PRIM_NAMES, TABLE_KINDS, type Diag, type TableRow } from './types'

// T2 contract: runtime values of the enum sources + legal/illegal construction.
// Type-level enforcement is proven by `tsc --noEmit` (the @ts-expect-error below
// fails the typecheck if the PrimName union is open).
describe('compiler table-contract types (T2)', () => {
  it('exposes the 8 primitives verbatim', () => {
    expect([...PRIM_NAMES]).toEqual([
      'rename',
      'wrapExpr',
      'splitDirective',
      'keyTransform',
      'valueMap',
      'passthrough',
      'classPrefix',
      'lifecyclePassthrough',
    ])
  })
  it('exposes the seven table kinds', () => {
    expect([...TABLE_KINDS]).toEqual([
      'tagMap',
      'directiveMap',
      'eventMap',
      'lifecycleMap',
      'exprWhitelist',
      'styleRules',
      'capabilityRules',
    ])
  })
  it('constructs a legal row + diag', () => {
    const row: TableRow = { kind: 'tagMap', s: 'view', t: 'div', primitive: 'rename', golden: '<div></div>' }
    const diag: Diag = { code: 101, message: 'unknown tag', hint: 'add a tagMap row', loc: { file: 'a.wxml', line: 1, col: 2 } }
    expect(row.golden).toBe('<div></div>')
    expect(diag.code).toBe(101)
  })
  it('rejects an unknown primitive at type level', () => {
    // @ts-expect-error primitive union is closed to the 8 PrimNames
    const row: TableRow = { kind: 'tagMap', s: 'x', primitive: 'wrapBlock', golden: 'g' }
    expect(row.primitive).toBe('wrapBlock')
  })
})
