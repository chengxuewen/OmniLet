// Table contract types (compile-slice1 T2).
// Enums mirror packages/rule-schema/schema/table.schema.json verbatim;
// the ajv gate (T5) enforces them at the data layer, these enforce at the type layer.

/** The seven parts of the rule table (D5 table-driven compiler). */
export const TABLE_KINDS = [
  'tagMap',
  'directiveMap',
  'eventMap',
  'lifecycleMap',
  'exprWhitelist',
  'styleRules',
  'capabilityRules',
] as const

/** Closed kernel-primitive set (D21 mixed-DSL vocab, 8 values). */
export const PRIM_NAMES = [
  'rename',
  'wrapExpr',
  'splitDirective',
  'keyTransform',
  'valueMap',
  'passthrough',
  'classPrefix',
  'lifecyclePassthrough',
] as const

export type PrimName = (typeof PRIM_NAMES)[number]

/** One row of a rule table; validated against table.schema.json at load time. */
export type TableRow = {
  kind: string
  s: string
  t?: string
  primitive?: PrimName
  /** attr-granular wrap flag (D5 wrapExpr): rename rows declaring true emit the
   *  bare expression wrapped as `{{expr}}` in the output attribute value. */
  wrap?: boolean
  /** styleRules class-word exemption (T9): true = this class word never takes the
   *  omnilet- prefix. Template rewrite and css codegen read the same row (同源词表). */
  exempt?: boolean
  golden: string
}

/**
 * Compiler diagnostic. code families: 1xx lex/parse, 2xx normalize,
 * 3xx table miss, 4xx emit/gate refusal (fail-closed everywhere).
 */
export type Diag = {
  code: number
  message: string
  hint: string
  loc?: { file: string; line: number; col: number }
}
