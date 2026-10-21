// Task 7: template IR — @vue/compiler-dom parse with LOCKED options + shape canary.
//
// Entry-point choice (read from the installed .d.ts / cjs, @vue/compiler-dom 3.5.44,
// not from memory): we use `parse` (compiler-dom dist, compiler-dom.cjs.js:915), NOT
// compiler-core `baseParse` directly. `parse` is `baseParse(template,
// extend({}, parserOptions, options))` — it layers the DOM parser options
// (parseMode:'html', isVoidTag, getNamespace…) that a real-HTML fixture needs,
// while `baseParse` alone defaults to module-mode parsing. Neither pre-transforms:
// the returned RootNode is the raw parse tree.
//
// `transform` is deliberately NOT run in this slice: it is codegen-oriented — it
// mutates the AST (IfNode/ForNode/TextCall restructuring), parses every expression
// with @babel/parser (a DSL expr outside Vue's grammar would raise extra 1xx noise
// before our own gates run), and pins behavior semantics we re-derive per the rule
// tables (T8/T9). The IR this slice needs is the stable parse shape.
import type { CompilerError, RootNode } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-dom'
import { diag } from './diag'
import type { Diag } from './types'

export type TemplateAstResult = {
  ast: RootNode
  diagnostics: Diag[]
}

/**
 * LOCKED parse options — preconditions of tests/canary/ast-shape.json and of emit
 * determinism, not free defaults. Changing either one MUST re-record the canary and
 * re-audit every golden: `condense` fixes which text nodes survive (whitespace-only
 * ones vanish between elements), `comments:false` fixes COMMENT nodes out of the tree.
 */
const LOCKED_OPTIONS = {
  whitespace: 'condense',
  comments: false,
} as const

/**
 * vue ErrorCodes run 0..64 (enum __EXTEND_POINT__ = 54 core / 65 dom);
 * base 110 keeps them clear of the 101-109 negative-entry band (diag.ts)
 * while staying inside the 1xx lex/parse family (types.ts).
 */
const PARSE_DIAG_BASE = 110

export function buildTemplateAst(html: string, file = '<anon>'): TemplateAstResult {
  const diagnostics: Diag[] = []
  // onError is REQUIRED here: vue's default error sink throws on syntax errors;
  // ours collects 1xx Diags and lets baseParse's error recovery return a tree.
  const ast = parse(html, {
    ...LOCKED_OPTIONS,
    onError: (err: CompilerError) => diagnostics.push(toDiag(err, file)),
  })
  return { ast, diagnostics }
}

function toDiag(err: CompilerError, file: string): Diag {
  const line = err.loc?.start.line ?? 0
  const col = err.loc?.start.column ?? 0
  // err.code is typed `number | string` on SyntaxError; vue always sets a numeric ErrorCodes
  const code = err.code
  return diag(
    PARSE_DIAG_BASE + (typeof code === 'number' ? code : -1),
    `template parse error: ${err.message}`,
    `fix the template markup at ${file}:${line}:${col} (vue parser code ${err.code}; ` +
      `1xx = lex/parse family, see types.ts)`,
    { file, line, col },
  )
}

const TYPE_NAMES = [
  'ROOT',
  'ELEMENT',
  'TEXT',
  'COMMENT',
  'SIMPLE_EXPRESSION',
  'INTERPOLATION',
  'ATTRIBUTE',
  'DIRECTIVE',
  'COMPOUND_EXPRESSION',
  'IF',
  'IF_BRANCH',
  'FOR',
  'TEXT_CALL',
] as const

/**
 * Deterministic structural digest: node types + tag/attr/directive names + child
 * counts, tree order, one line per node. Whitespace-insensitive by construction
 * (condense removes whitespace-only text nodes) — the canary only reddens on
 * SHAPE changes, which is the point (spec §7 compiler-upgrade tripwire).
 */
export function astShapeSummary(ast: RootNode): string {
  const lines: string[] = []
  // parse-time node fields (content: string on TEXT/COMMENT) vs codegen shapes differ;
  // the summary only reads the parse-time subset, hence the structural cast.
  walk(ast as unknown as ShapeNode, 0, lines)
  return lines.join('\n')
}

type ShapeNode = {
  type: number
  tag?: string
  children?: ShapeNode[]
  props?: ShapeProp[]
  content?: string
  name?: string
  rawName?: string
}
type ShapeProp = { name?: string; rawName?: string }

function walk(node: ShapeNode, depth: number, out: string[]): void {
  const kind = TYPE_NAMES[node.type] ?? `#${node.type}`
  let label = `${'  '.repeat(depth)}${kind}`
  switch (node.type) {
    case 0: // ROOT
      label += ` children=${node.children?.length ?? 0}`
      break
    case 1: // ELEMENT
      label += ` <${node.tag}> props=${node.props?.length ?? 0} children=${node.children?.length ?? 0}`
      break
    case 2: // TEXT
    case 3: // COMMENT
      label += ` [${node.content}]`
      break
    case 5: // INTERPOLATION — content is the ExpressionNode, use its raw text
      label += ` {{ ${(node.content as unknown as ShapeNode | undefined)?.content ?? ''} }}`
      break
    case 7: // DIRECTIVE (standalone; also summarised under ELEMENT props below)
      label += ` ${node.rawName ?? node.name}`
      break
  }
  out.push(label)
  if (node.type === 1 && node.props) {
    for (const p of node.props) {
      // DIRECTIVE nodes carry rawName at parse time; ATTRIBUTE nodes never do
      const isDirective = p.rawName !== undefined
      out.push(`${'  '.repeat(depth + 1)}${isDirective ? 'DIR' : 'ATTR'} ${p.rawName ?? p.name}`)
    }
  }
  for (const c of node.children ?? []) walk(c, depth + 1, out)
}
