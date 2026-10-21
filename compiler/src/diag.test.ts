import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { NEGATIVE_ENTRIES, negativeEntries, renderExpect, diag } from './diag'

// T4 contract: negative entries AS DATA. 话术单源 = docs/dsl-spec.md §2 表.
// SYNC OBLIGATION (dsl-spec §2 footer): a new negative entry = dsl-spec revision
// + a row in NEGATIVES below (next code in its family) + goldens (T9).
// CANONICAL ID SOURCE (T9 ruling): ids live ONLY in this table. The §2 expected id
// ORDER is derived (specRowIds) by anchoring each row's 形态 column to the one entry
// whose `form` it contains — no duplicated hand-written id list; the derivation IS the pin.

const SPEC_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../docs/dsl-spec.md')

/** Parse §2 markdown table: rows of [形态, 原因, 替代写法], in file order. */
function parseSpecTable(): string[][] {
  const md = readFileSync(SPEC_PATH, 'utf-8')
  const at = md.indexOf('\n## 2.')
  if (at < 0) throw new Error('dsl-spec §2 heading not found')
  const rest = md.slice(at)
  const next = rest.indexOf('\n## ', 1)
  const body = next < 0 ? rest : rest.slice(0, next)
  const rows: string[][] = []
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|')) continue
    const cells = t.slice(1, -1).split('|').map((c) => c.trim())
    if (cells.length !== 3) continue
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue // separator row
    if (cells[0] === '不支持的形态') continue // header row
    rows.push(cells)
  }
  return rows
}

/** Canonical id derivation: exactly one entry's `form` must anchor each §2 形态 cell. */
function specRowIds(rows: string[][]): string[] {
  return rows.map((cells) => {
    const hits = NEGATIVE_ENTRIES.filter((e) => cells[0]!.includes(e.form))
    if (hits.length !== 1) {
      throw new Error(`dsl-spec §2 row '${cells[0]}' anchors ${hits.length} entries (must be exactly 1)`)
    }
    return hits[0]!.id
  })
}

describe('negative entries as data (T4)', () => {
  it('id order is DERIVED from the §2 形态 column — single source is diag.ts (no second list)', () => {
    expect(specRowIds(parseSpecTable())).toEqual(NEGATIVE_ENTRIES.map((e) => e.id))
  })

  it('codes follow the family ranges by row order (1xx form-negative, 2xx whitelist-escape)', () => {
    expect(NEGATIVE_ENTRIES.map((e) => e.code)).toEqual([101, 102, 103, 104, 201, 202, 203, 204, 205])
    expect(NEGATIVE_ENTRIES.map((e) => e.family)).toEqual([
      'form-negative',
      'form-negative',
      'form-negative',
      'form-negative',
      'whitelist-escape',
      'whitelist-escape',
      'whitelist-escape',
      'whitelist-escape',
      'whitelist-escape',
    ])
  })

  it('renderExpect composes code + message + hint from the entry', () => {
    const e = NEGATIVE_ENTRIES.find((x) => x.id === 'model-sugar')!
    expect(renderExpect('model-sugar')).toBe(`${e.code} ${e.message} hint: ${e.hint}`)
    expect(renderExpect('model-sugar')).toContain('替代')
    expect(renderExpect('model-sugar')).toContain('state')
  })

  it('mutation self-proof: renderExpect follows a runtime hint edit (table-only, no hardcoded branches)', () => {
    const live = negativeEntries()
    const target = live.find((e) => e.id === 'class-obj')!
    const original = target.hint
    try {
      target.hint = 'MUTATED-HINT-PROBE'
      expect(renderExpect('class-obj')).toContain('MUTATED-HINT-PROBE')
    } finally {
      target.hint = original
    }
    expect(renderExpect('class-obj')).not.toContain('MUTATED-HINT-PROBE')
    expect(renderExpect('class-obj')).toContain(original)
  })

  it('dsl-spec §2 ↔ NEGATIVE_ENTRIES consistency (spec is the copy source)', () => {
    const rows = parseSpecTable()
    expect(rows.length).toBe(9)
    const entries = NEGATIVE_ENTRIES
    expect(specRowIds(rows)).toEqual(entries.map((e) => e.id)) // canonical ids derived, not duplicated
    for (const [i, e] of entries.entries()) {
      // message column copied verbatim
      expect(e.message).toBe(rows[i][1])
      // 替代写法 column lives in the hint verbatim
      expect(e.hint).toContain(rows[i][2])
      // 形态 column names the id
      expect(rows[i][0]).toContain(e.form)
    }
  })

  it('diag() constructs a Diag from code + entry fields', () => {
    const e = NEGATIVE_ENTRIES[0]
    const d = diag(e.code, e.message, e.hint)
    expect(d).toEqual({ code: 101, message: e.message, hint: e.hint })
  })

  it('renderExpect throws on an unknown id (fail-closed)', () => {
    expect(() => renderExpect('no-such-entry')).toThrow(/no-such-entry/)
  })
})
