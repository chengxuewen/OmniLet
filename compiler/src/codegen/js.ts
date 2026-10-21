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
//     The facade contract (implemented by T11 at compiler/runtime/wechat/):
//        createPage(config) — builds Component({ properties: {}, data, methods,
//          ...lifecycles }) from { state, methods, ...pageLifecycleHooks };
//          page-level lifecycle keys (onLoad/onShow/...) ride the Component page
//          config per the lifecycleMap passthrough rows (WeChat accepts them
//          there — *UNCERTAIN* until the T11 behavior tier exercises them live).
//        createApp(config) — App(config) with the same state/methods handling.
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
  declaration?: BNode
}

const FORBIDDEN_TS = ['TSEnumDeclaration', 'TSModuleDeclaration', 'TSParameterProperty'] as const

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
  const shape = validateShape(astTopLevel(ast), file)
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

/** Slice-1 module contract on the top-level statements (see file header). */
function validateShape(body: BNode[], file: string): Diag[] {
  const diags: Diag[] = []
  let defaults = 0
  for (const n of body) {
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

function parseErr(e: unknown, file: string, code: number, label: string): Diag {
  const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
  return diag(code, `${label}: ${msg}`, `修正 ${file} 的脚本语法（1xx = lex/parse 家族，types.ts）`, { file, line: 0, col: 0 })
}
