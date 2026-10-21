// Task 7: template IR on @vue/compiler-dom — locked parse options + shape canary.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { astShapeSummary, buildTemplateAst } from './ir'

const FIXTURE_HTML = readFileSync(
  fileURLToPath(new URL('../tests/fixtures/counter/pages/index/index.html', import.meta.url)),
  'utf8',
)

/** Recursively collect directive rawNames in tree order. */
function directiveNames(node: unknown): string[] {
  const n = node as { props?: unknown[]; children?: unknown[] }
  const out: string[] = []
  for (const p of n.props ?? []) {
    // type 7 = NodeTypes.DIRECTIVE (ATTRIBUTE is 6 — must not leak in here)
    const d = p as { type: number; rawName?: string; name?: string }
    const dn = d.rawName ?? d.name
    if (d.type === 7 && dn !== undefined) out.push(dn)
  }
  for (const c of n.children ?? []) out.push(...directiveNames(c))
  return out
}

describe('buildTemplateAst — locked parse options', () => {
  it('parses the counter fixture into the 5-element skeleton with v-if/v-for/v-on in place', () => {
    const { ast, diagnostics } = buildTemplateAst(FIXTURE_HTML, 'pages/index/index.html')
    expect(diagnostics).toEqual([])
    expect(ast.type).toBe(0) // NodeTypes.ROOT
    expect(ast.children).toHaveLength(1)
    const root = ast.children[0] as { tag: string; children: unknown[] }
    expect(root.tag).toBe('view')
    // condensed children: text, view, button (whitespace-only text nodes gone
    // between elements -> exactly 3, proof `whitespace: 'condense'` is live)
    expect(root.children).toHaveLength(3)
    expect(directiveNames(ast).sort()).toEqual([':key', '@tap', 'v-for', 'v-if'])
  })

  it('comments:false — an html comment is absent from the AST', () => {
    const { ast } = buildTemplateAst('<view><!--x--><text>hi</text></view>')
    const summary = astShapeSummary(ast)
    expect(summary).not.toContain('COMMENT')
  })

  it('syntax error → 1xx diagnostics, no throw, line/col carried', () => {
    const { ast, diagnostics } = buildTemplateAst('<view v-if="a"\n<text>{{ b }}</text>', 'bad.html')
    expect(ast).toBeDefined() // parse recovered, tree still returned
    expect(diagnostics.length).toBeGreaterThan(0)
    for (const d of diagnostics) {
      expect(d.code).toBeGreaterThanOrEqual(130)
      expect(d.code).toBeLessThan(200)
      // band separation (final-review wave item 1): parse diags must never land
      // on the codegen lex/parse codes 121-125 (old base 110 + vue codes 11-15 did)
      expect([121, 122, 123, 124, 125].includes(d.code)).toBe(false)
      expect(d.loc?.line).toBeGreaterThan(0)
      expect(d.loc?.col).toBeGreaterThan(0)
      expect(d.loc?.file).toBe('bad.html')
    }
  })

  it('unclosed <view> at EOF is diagnosed, not thrown', () => {
    const { diagnostics } = buildTemplateAst('<view>', 'unclosed.html')
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics.every((d) => d.code >= 130 && d.code < 200)).toBe(true)
  })
})

describe('ast-shape canary (compiler-upgrade tripwire, spec §7)', () => {
  it('fixture summary equals the recorded canary卷', () => {
    const goldenPath = new URL('../tests/canary/ast-shape.json', import.meta.url)
    const { ast } = buildTemplateAst(FIXTURE_HTML, 'pages/index/index.html')
    const summary = astShapeSummary(ast)
    const recorded = readFileSync(fileURLToPath(goldenPath), 'utf8').trim()
    // canary file is recorded from measured output (2026-10-21, @vue/compiler-dom 3.5.44);
    // a compiler-dom upgrade that changes AST shape reddens this, not the emit goldens only.
    expect(JSON.stringify(summary)).toBe(recorded)
  })
})
