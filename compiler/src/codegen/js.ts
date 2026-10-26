// Task 10 (compile-slice1): JS codegen — THE ONLY @babel resident in src/
// (spec §2 IR-order redline: everything else must stay Babel-free; codegen.test.ts
// scans imports to enforce the module boundary).
//
// Two jobs, in this order:
//  1. PRE-transform detection of TS non-erasable syntax (enum / namespace /
//     parameter properties). preset-typescript only ERASES types; on those shapes
//     it either fails or silently drops runtime code — so we parse first, and any
//     hit is the NEGATIVE entry 'ts-unerasurable' (204) + the file is NOT emitted
//     (undetectable-strip safety: shipping a half-stripped file is worse than
//     shipping none; the blocking diag makes ok=false).
//  2. Type-strip ONLY (@babel/preset-typescript, no targets => no ES5 downlevel —
//     async/optional-chaining pass through untouched), then module surgery on the
//     stripped text at AST node spans:
//        import { x[, y as z] } from 'omnilet'   ->  const { x, y: z, <factory> } =
//                                                    require('<rel>omnilet-runtime.js')
//        export default { ... }                  ->  <factory>({ ... })
//     The facade contract — implemented at runtime/wechat/ (T11), bundled into
//     RUNTIME_VENDOR by src/vendor.ts:
//        createPage(config) — registers Component({ properties: {}, data,
//          methods, created, detached, ...hooks }) from { state, methods,
//          ...pageLifecycleHooks }; measured (behavior.test.ts): onLoad fires
//          at created (adapter-side, single call — the framework's own onLoad
//          slot is left empty), onUnload at detached; onShow/onHide ride the
//          top-level config for the real device framework (simulate has no
//          navigation driver).
//        createApp(config) — App(config) when the global exists; no-App
//          contexts (simulate/unit) fire onLaunch directly.
//     Module contract beyond that is closed (slice 1): imports ONLY from 'omnilet'
//     (named specifiers), exactly one `export default <object literal>`; anything
//     else = 2xx shape escape, file not emitted.
import { parseSync, transformSync } from '@babel/core'
import presetTs from '@babel/preset-typescript'
import { NEGATIVE_ENTRIES, diag } from '../diag'
import type { Diag } from '../types'

/** Vendor shim file name written at the PACKAGE ROOT by compileProject/T11. */
export const RUNTIME_VENDOR = 'omnilet-runtime.js'

export type JsResult = { code: string | null; diagnostics: Diag[] }

type EmitOpts = { file: string; factory: 'createPage' | 'createApp'; runtimeRel: string }

// Structural casts: @babel/parser's typed AST would need @babel/types imports
// (still babel-side, still in this file — but the shape we READ here is a tiny
// subset, so we cast like rewrite.ts does against the vue AST rather than widen
// the dependency surface even further).
type BNode = {
  type: string
  start?: number
  end?: number
  program?: BNode
  body?: BNode[]
  source?: { value?: string }
  specifiers?: BNode[]
  imported?: { name?: string }
  local?: { name?: string }
  name?: string
  id?: BNode
  declaration?: BNode
  declarations?: BNode[] // Babel 8 ESTree field name (probed from the real ast)
  properties?: BNode[]
  elements?: BNode[]
  value?: BNode
  argument?: BNode // RestElement carry (probed: `...reactive` -> argument.name)
}

const FORBIDDEN_TS = ['TSEnumDeclaration', 'TSModuleDeclaration', 'TSParameterProperty'] as const

// Words the emitted `const { ...bindings, <factory> } = require(...)` head binds.
// An author top-level declaration of any of these = duplicate-const SyntaxError
// (name also imported) or facade-shadow (name not imported) shipping with ZERO
// diagnostics — validateShape rejects the file before codegen (T10 fix R1-1).
const FACADE_WORDS = ['reactive', 'ref', 'computed', 'watch'] as const

export function emitPageJs(ts: string, pageName: string): JsResult {
  const dir = pageName.slice(0, pageName.lastIndexOf('/') + 1) // 'pages/index/'
  const depth = dir === '' ? 0 : dir.split('/').filter((s) => s !== '').length
  const rel = `${'../'.repeat(depth)}${RUNTIME_VENDOR}`
  return emitModuleJs(ts, { file: `${pageName}.ts`, factory: 'createPage', runtimeRel: rel })
}

export function emitAppJs(ts: string): JsResult {
  return emitModuleJs(ts, { file: 'app.ts', factory: 'createApp', runtimeRel: `./${RUNTIME_VENDOR}` })
}

export function emitModuleJs(ts: string, opts: EmitOpts): JsResult {
  const { file, factory, runtimeRel } = opts
  // [1] TS parse (detection + shape validation happen on the AUTHOR ast).
  let ast: BNode | null
  try {
    ast = parseSync(ts, { configFile: false, babelrc: false, parserOpts: { plugins: ['typescript'] } }) as unknown as BNode | null
  } catch (e) {
    return { code: null, diagnostics: [parseErr(e, file, 122, 'script parse error')] }
  }
  if (!ast) return { code: null, diagnostics: [diag(122, 'script parse returned no ast', '内部错误：babel parseSync null', { file, line: 0, col: 0 })] }

  const forbidden = FORBIDDEN_TS.filter((kind) => hasNodeKind(ast, kind))
  if (forbidden.length > 0) {
    return { code: null, diagnostics: forbidden.map((kind) => tsUnerasurable(kind)) }
  }
  const shape = validateShape(astTopLevel(ast), file, factory)
  if (shape.length > 0) return { code: null, diagnostics: shape }

  // [2] type-strip transform, then module surgery on the STRIPPED text.
  let stripped: string | null
  try {
    stripped = transformSync(ts, {
      configFile: false,
      babelrc: false,
      sourceType: 'module',
      presets: [presetTs],
    })?.code ?? null
  } catch (e) {
    return { code: null, diagnostics: [parseErr(e, file, 123, 'type-strip transform error')] }
  }
  if (stripped === null) return { code: null, diagnostics: [diag(123, 'type-strip returned no code', '内部错误：transformSync null', { file, line: 0, col: 0 })] }

  let strippedAst: BNode | null
  try {
    strippedAst = parseSync(stripped, { configFile: false, babelrc: false, sourceType: 'module' }) as unknown as BNode | null
  } catch (e) {
    return { code: null, diagnostics: [parseErr(e, file, 122, 'stripped script parse error')] }
  }
  if (!strippedAst) return { code: null, diagnostics: [diag(122, 'stripped parse returned no ast', '内部错误', { file, line: 0, col: 0 })] }
  const body = astTopLevel(strippedAst)

  const bindings: string[] = []
  const edits: { from: number; to: number; text: string }[] = []
  for (const n of body) {
    if (n.type === 'ImportDeclaration') {
      for (const s of n.specifiers ?? []) {
        const imported = s.imported?.name ?? ''
        const local = s.local?.name ?? ''
        bindings.push(imported === local ? imported : `${imported}: ${local}`)
      }
      edits.push({ from: n.start ?? 0, to: eatLineEnd(stripped, n.end ?? 0), text: '' })
    } else if (n.type === 'ExportDefaultDeclaration' && n.declaration) {
      const decl = n.declaration
      edits.push({ from: n.start ?? 0, to: decl.start ?? 0, text: `${factory}(` })
      edits.push({ from: decl.end ?? 0, to: decl.end ?? 0, text: ')' })
    }
  }
  edits.sort((a, b) => a.from - b.from)
  let pos = 0
  let rest = ''
  for (const e of edits) {
    rest += stripped.slice(pos, e.from) + e.text
    pos = e.to
  }
  rest += stripped.slice(pos)
  const head = `const { ${[...bindings, factory].join(', ')} } = require('${runtimeRel}')`
  const code = `${head}\n${rest.replace(/^([ \t]*\n)+/, '')}`
  return { code: code.endsWith('\n') ? code : `${code}\n`, diagnostics: [] }
}

// ------------------------------------------------------------------ internals

function astTopLevel(ast: BNode): BNode[] {
  return ast.program?.body ?? []
}

/** Recursive node-type probe over every object/array value (no @babel/traverse). */
function hasNodeKind(node: unknown, kind: string): boolean {
  if (Array.isArray(node)) return node.some((x) => hasNodeKind(x, kind))
  if (node !== null && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if (rec.type === kind) return true
    return Object.values(rec).some((v) => typeof v === 'object' && hasNodeKind(v, kind))
  }
  return false
}

/** Slice-1 module contract on the top-level statements (see file header).
 *  Also guards the emitted `const { ...facade, <factory> } = require(...)` line:
 *  a top-level author declaration binding any facade word (imported or not)
 *  = duplicate-const SyntaxError or silent shadow -> 214, file not emitted. */
function validateShape(body: BNode[], file: string, factory: EmitOpts['factory']): Diag[] {
  const diags: Diag[] = []
  let defaults = 0
  for (const n of body) {
    for (const bound of topLevelBindings(n)) {
      if (FACADE_WORDS.includes(bound as (typeof FACADE_WORDS)[number]) || bound === factory) {
        diags.push(shadowReject(bound, file))
      }
    }
    if (n.type === 'ImportDeclaration') {
      const src = n.source?.value ?? ''
      if (src !== 'omnilet') diags.push(shapeReject(`import from '${src}'（切片 1 门面词表只有 'omnilet'）`, file))
      for (const s of n.specifiers ?? []) {
        if (s.type !== 'ImportSpecifier') diags.push(shapeReject('default/namespace import 形态（仅支持具名导入）', file))
      }
    } else if (n.type === 'ExportDefaultDeclaration') {
      defaults += 1
      if (n.declaration?.type !== 'ObjectExpression') diags.push(shapeReject('export default 需为对象字面量（页面配置对象）', file))
    } else if (n.type.startsWith('Export')) {
      diags.push(shapeReject(`命名导出 '${n.type}'（出口唯一 = export default）`, file))
    }
  }
  if (defaults !== 1) diags.push(shapeReject(`export default 出现 ${defaults} 次（要求恰好 1）`, file))
  return diags
}

function eatLineEnd(src: string, end: number): number {
  let p = end
  if (src[p] === ';') p += 1
  if (src[p] === '\n') p += 1
  return p
}

function tsUnerasurable(kind: string): Diag {
  const e = NEGATIVE_ENTRIES.find((x) => x.id === 'ts-unerasurable')
  if (!e) throw new Error('ts-unerasurable entry missing from NEGATIVE_ENTRIES')
  return { ...diag(e.code, e.message, e.hint), message: `${e.message}（${kind}）` }
}

function shapeReject(reason: string, file: string): Diag {
  return diag(
    213,
    `模块形态越界：${reason}`,
    "切片 1 js 入口合同：import 仅 'omnilet' 具名 + 唯一 export default 对象字面量（其余模块系统随后续切片）",
    { file, line: 0, col: 0 },
  )
}

/** Top-level names a statement binds (var/let/const, function, class) — the
 *  shadow-collision surface. Import declarations are NOT included (they route
 *  to the require head, checked separately). */
function topLevelBindings(n: BNode): string[] {
  switch (n.type) {
    case 'VariableDeclaration':
      return (n.declarations ?? []).flatMap((d) => patternNames(d.id))
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return n.id?.name ? [n.id.name] : []
    default:
      return []
  }
}

/** binding names of a binding pattern: `const x`, `const { reactive }`,
 *  `const [watch]` — every shape collides with the require head the same way. */
function patternNames(id: BNode | undefined): string[] {
  if (!id) return []
  if (id.name) return [id.name]
  if (id.type === 'RestElement') return patternNames(id.argument)
  if (id.type === 'ObjectPattern')
    return (id.properties ?? []).flatMap((p) => (p.type === 'RestElement' ? patternNames(p) : patternNames(p.value)))
  if (id.type === 'ArrayPattern') return (id.elements ?? []).flatMap((e) => patternNames(e))
  return []
}

function shadowReject(bound: string, file: string): Diag {
  return diag(
    214,
    `顶层声明 '${bound}' 遮蔽运行时门面名`,
    "reactive/ref/computed/watch 与 createPage/createApp 由产物顶部的 require 行绑定，顶层同名声明会重复声明或静默遮蔽（零诊断）——换个名字，或删掉 import",
    { file, line: 0, col: 0 },
  )
}

function parseErr(e: unknown, file: string, code: number, label: string): Diag {
  const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
  return diag(code, `${label}: ${msg}`, `修正 ${file} 的脚本语法（1xx = lex/parse 家族，types.ts）`, { file, line: 0, col: 0 })
}

// ------------------------------------------------- web call-sites (slice-2 T3)
// emitPageJsWeb: the web target's page emitter — same factory (createPage),
// same relative-depth runtime path (T4's dispatch builds the package root the
// same way); the only wechat-side difference lives in the TABLE, not here.
// One-line forward: emitModuleJs stays the single Babel resident.
export function emitPageJsWeb(ts: string, pageName: string): JsResult {
  const dir = pageName.slice(0, pageName.lastIndexOf('/') + 1) // 'pages/index/'
  const depth = dir === '' ? 0 : dir.split('/').filter((s) => s !== '').length
  const rel = `${'../'.repeat(depth)}${RUNTIME_VENDOR}`
  return emitModuleJs(ts, { file: `${pageName}.ts`, factory: 'createPage', runtimeRel: rel })
}

// emitAppEntryJs: the web branch's app entry — same createApp facade shape as
// emitAppJs; the OUTPUT FILE is main.js (naming belongs to compileProject's
// web dispatch, T4 — this function only produces code).
export const emitAppEntryJs = emitAppJs
