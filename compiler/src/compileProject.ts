// Task 10 (compile-slice1): compileProject — the four-station pipeline assembly
// (spec §2: ingest -> IR -> table rewrite -> codegen+pack) and the fail-closed
// contract: ANY diagnostic (1xx/2xx/3xx-throw/4xx) blocks file emission entirely
// — a package with known defects is never written; the caller gets diagnostics.
//
// Emitted tree (wechat target, counter fixture measured):
//   app.json                    mergeAppJson (author passthrough + pages injection)
//   app.js                      when author app.ts exists (createApp facade shape)
//   pages/<...>.wxml|.js|.wxss|.json   per ingest PageUnit (css/json optional)
//   omnilet.manifest.json       capability sidecar (401-gated before emit)
//   omnilet.d.ts                OUT-sidecar facade types (TYPE tier input;
//                               part of outDir, outside the PACKAGE file set —
//                               WeChat never loads it)
// ponytail: mode dev/prod accepts both but emits IDENTICAL bytes in slice 1 —
// prod minify policy is a §8 unfrozen parameter (add when a measurement asks).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { loadCapabilities } from '../../packages/rule-schema/src/index'
import { checkCapabilities } from './capabilities'
import { emitAppJs, emitPageJs } from './codegen/js'
import { emitPageJson, mergeAppJson } from './codegen/appjson'
import { DTS_FILE, emitDts } from './codegen/dts'
import { MANIFEST_FILE, emitManifest } from './codegen/manifest'
import { emitWxml } from './codegen/wxml'
import { emitWxss } from './codegen/wxss'
import { buildTemplateAst } from './ir'
import { ingest } from './ingest'
import { rewrite } from './rewrite'
import { loadTables } from './tables'
import { wechatTables } from '../rules/wechat'
import type { PageUnit } from './ingest'
import type { Diag } from './types'

export type CompileMode = 'dev' | 'prod'

export type CompileOptions = {
  root: string
  outDir: string
  /** slice 1 ships the wechat target only; web/container targets register their
   *  own rules+codegen modules in their slices (spec §1 明确不做). */
  target?: 'wechat'
  mode?: CompileMode
}

export type CompileResult = {
  ok: boolean
  diagnostics: Diag[]
  /** package-root-relative artifact paths, sorted */
  artifacts: string[]
}

export async function compileProject(options: CompileOptions): Promise<CompileResult> {
  const { root, outDir } = options
  const diagnostics: Diag[] = []

  // [station 1] rule tables (throws TableGateError 301-303 — compile cannot
  // proceed without legal data; the CLI surfaces it) + ingest (throws IngestError).
  const tables = loadTables(wechatTables)
  const units = ingest(root, { platform: 'wechat' })

  // [gate 4xx FIRST — spec §2] capability words must be registered (D17) before
  // anything emits: manifest refusal = whole-build refusal (fail-closed).
  const allRequires = units.pages.flatMap((p) => p.requires)
  diagnostics.push(...checkCapabilities(allRequires, loadCapabilities()))

  // [stations 2+3+4] per page: parse -> rewrite -> wxml/wxss/js/json codegen.
  const files = new Map<string, string>()
  for (const page of units.pages) {
    for (const [rel, text] of compilePage(page, tables, diagnostics)) files.set(rel, text)
  }

  // app-level: merged app.json (+ app.js when the author shipped app.ts).
  const pageNames = units.pages.map((p) => p.name)
  const app = mergeAppJson(units.app.json, pageNames)
  diagnostics.push(...app.diagnostics)
  if (app.json !== null) files.set('app.json', app.json)
  if (units.app.ts !== null) {
    const appJs = emitAppJs(units.app.ts)
    diagnostics.push(...appJs.diagnostics)
    if (appJs.code !== null) files.set('app.js', appJs.code)
  }

  files.set(MANIFEST_FILE, emitManifest(allRequires))
  files.set(DTS_FILE, emitDts())

  const ok = diagnostics.length === 0
  const artifacts = [...files.keys()].sort()
  if (ok) {
    for (const rel of artifacts) {
      const abs = join(outDir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, files.get(rel)!)
    }
  }
  return { ok, diagnostics, ...(ok ? { artifacts } : { artifacts: [] }) }
}

function compilePage(
  page: PageUnit,
  tables: ReturnType<typeof loadTables>,
  diagnostics: Diag[],
): [string, string][] {
  const out: [string, string][] = []
  const htmlFile = `${page.name}.html`

  const ir = buildTemplateAst(page.html, htmlFile)
  diagnostics.push(...tag(ir.diagnostics, htmlFile))
  const rw = rewrite(ir.ast, tables)
  diagnostics.push(...tag(rw.diagnostics, htmlFile))
  // template-side escape: the page's wxml would ship a hole where the rejected
  // node was — the blocking diag already turns ok=false; skip the file itself.
  const templateClean = ir.diagnostics.length === 0 && rw.diagnostics.length === 0
  if (templateClean) out.push([`${page.name}.wxml`, emitWxml(rw.outAst)])

  const js = emitPageJs(page.ts, page.name)
  diagnostics.push(...tag(js.diagnostics, `${page.name}.ts`))
  if (js.code !== null) out.push([`${page.name}.js`, js.code])

  if (page.css !== null) {
    const wxss = emitWxss(page.css, `${page.name}.css`, tables)
    diagnostics.push(...tag(wxss.diagnostics, `${page.name}.css`))
    if (wxss.code !== '') out.push([`${page.name}.wxss`, wxss.code])
  }

  const pj = emitPageJson(page.json, `${page.name}.json`)
  diagnostics.push(...tag(pj.diagnostics, `${page.name}.json`))
  if (pj.json !== null) out.push([`${page.name}.json`, pj.json])

  return out
}

/** Negative/whitelist diags arrive location-free; label them with the source
 *  file (line 0 = "whole file", honest for shape-level rejections). */
function tag(diags: Diag[], file: string): Diag[] {
  return diags.map((d) => (d.loc ? d : { ...d, loc: { file, line: 0, col: 0 } }))
}
