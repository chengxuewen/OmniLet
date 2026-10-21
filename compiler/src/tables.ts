// Rule-table loader with three load-time gates (compile-slice1 T5).
// "Table is data, data must be legal" — enforced here, before any compilation.
// Gate order (fixed): schema(ajv,301) -> golden-missing(302) -> vocab-overlap(303).
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020'
import { TABLE_KINDS, type TableRow } from './types'

/** The seven-part rule table keyed by kind; each value is a list of rows. */
export type RawTableSet = Record<(typeof TABLE_KINDS)[number], TableRow[]>
/** A validated table set (post-gate; same shape, legality guaranteed). */
export type TableSet = RawTableSet

/** Which of the three gates rejected the table. */
export type GateName = 'schema' | 'golden-missing' | 'vocab-overlap'

/** Thrown by loadTables on the first gate that bites. 3xx family (table miss). */
export class TableGateError extends Error {
  readonly gate: GateName
  readonly code: number
  readonly detail: string
  constructor(gate: GateName, code: number, detail: string) {
    super(`table gate '${gate}' (code ${code}): ${detail}`)
    this.name = 'TableGateError'
    this.gate = gate
    this.code = code
    this.detail = detail
  }
}

// rule-schema ships no TS build; read its JSON schema across the package
// boundary from disk via a path resolved relative to this module (compiler/src).
// One path helper, used by both the schema gate and the golden root default.
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../..')
}

/** Absolute path to packages/rule-schema/schema/table.schema.json. */
export function ruleSchemaPath(): string {
  return join(repoRoot(), 'packages/rule-schema/schema/table.schema.json')
}

/** Default golden volume root: compiler/tests/golden. */
export function defaultGoldenRoot(): string {
  return join(repoRoot(), 'compiler/tests/golden')
}

/**
 * Hardcoded base-directive domain (dsl-spec §1 反丑纪律): the Vue v- family words
 * the kernel always owns. ol: may NEVER claim any of these — ol:/v- vocabularies
 * are disjoint by definition, and ol: must not invade the basic-directive domain.
 */
export const KNOWN_V_PREFIX: readonly string[] = [
  'if', 'else', 'elseif', 'for', 'show', 'model', 'on', 'bind', 'slot',
  'html', 'text', 'cloak', 'pre', 'once', 'memo', 'is', 'ref', 'effect',
]

const V_MARKERS = ['v-', '@']
function isV(s: string): boolean {
  return V_MARKERS.some((m) => s.startsWith(m))
}
function isOl(s: string): boolean {
  return s.startsWith('ol:')
}
/** Strip the family marker to the comparable base word. */
function base(s: string): string {
  if (s.startsWith('v-')) return s.slice(2)
  if (s.startsWith('@')) return s.slice(1)
  if (s.startsWith('ol:')) return s.slice(3)
  return s
}

/**
 * Vocabulary check (gate 3 predicate, exported so it can be tested directly).
 * Returns the sorted base words claimed by BOTH the v-/ol: vocabulary. Only
 * prefix-classified rows (v-/@/ol:) participate; plain tag rows are ignored.
 */
export function vocabOverlap(rows: Iterable<TableRow>): string[] {
  const arr = [...rows]
  const vWords = new Set<string>(KNOWN_V_PREFIX)
  for (const r of arr) if (isV(r.s)) vWords.add(base(r.s))
  const olWords = new Set<string>()
  for (const r of arr) if (isOl(r.s)) olWords.add(base(r.s))
  return [...olWords].filter((w) => vWords.has(w)).sort()
}

function allRows(set: RawTableSet): TableRow[] {
  return TABLE_KINDS.flatMap((kind) => set[kind])
}

function makeValidator(): ReturnType<Ajv2020['compile']> {
  const ajv = new Ajv2020({ allErrors: true })
  const schema = JSON.parse(readFileSync(ruleSchemaPath(), 'utf8')) as object
  return ajv.compile(schema)
}

// gate 1 detail: first ajv error, rendered as "<path> <message> [missing X]".
function schemaDetail(errors: ReturnType<Ajv2020['compile']>['errors']): string {
  const first = errors?.[0]
  if (!first) return 'unknown schema error'
  const where = first.instancePath && first.instancePath !== '' ? first.instancePath : first.schemaPath
  const miss = (first.params as { missingProperty?: string } | undefined)?.missingProperty
  return `${where} ${first.message}${miss ? ` (missing '${miss}')` : ''}`.trim()
}

/**
 * Load and gate a rule table. Throws TableGateError on the first violation.
 * `golden` fields are golden-dir ids resolved under `goldenRoot`.
 *
 * BOUNDARY (controller ruling R2): the g001-g003 volumes here satisfy the
 * golden-existence gate ONLY (dir present + in.html/expected.out.txt non-empty).
 * Their content is the passthrough fragment, NOT a frozen serializer contract —
 * the rewrite layer's own harness (T8) diffs serializer output against NEW
 * per-kind dirs. Do not read g001 content as the canonical outAst serialization.
 */
export function loadTables(rules: RawTableSet, goldenRoot = defaultGoldenRoot()): TableSet {
  const rows = allRows(rules)

  // Gate 1 — schema (ajv) over every row.
  const validate = makeValidator()
  for (const r of rows) {
    if (!validate(r)) throw new TableGateError('schema', 301, schemaDetail(validate.errors))
  }

  // Gate 2 — every row's golden id resolves to a dir with non-empty in/expected pair.
  for (const r of rows) {
    const dir = join(goldenRoot, r.golden)
    for (const f of ['in.html', 'expected.out.txt']) {
      const file = join(dir, f)
      let ok = false
      try {
        ok = statSync(dir).isDirectory() && statSync(file).isFile() && readFileSync(file).length > 0
      } catch {
        ok = false
      }
      if (!ok) {
        throw new TableGateError('golden-missing', 302, `row '${r.s}': golden '${r.golden}' has no dir or empty ${f}`)
      }
    }
  }

  // Gate 3 — v-/ol: vocabulary intersection must be empty.
  const overlap = vocabOverlap(rows)
  if (overlap.length > 0) {
    throw new TableGateError('vocab-overlap', 303, `ol: invades base-directive word(s): ${overlap.join(', ')}`)
  }

  return rules
}
