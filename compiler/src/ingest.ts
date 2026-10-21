// Task 6: ingest — directory scan, four-file pairing, platform-override SELECTION,
// ol:requires collection. 覆写消解发生在这里（配对选择层，dsl-spec §5 / 设计 §2 步[1]）；
// IR 内覆写区消费选择结果属 T8。红线1前半：产物零 #ifdef 由"编译前选文件"保证。
//
// Deliberately dumb: no JSON validation, no template parsing — diagnostics are T7+.
// Authoring errors of the missing-required-file class throw IngestError (CLI surfaces).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** One page's paired source files, platform-resolved. Contract consumed by T8/T10. */
export type PageUnit = {
  /** path relative to root, no extension — e.g. 'pages/index/index' */
  name: string
  html: string
  ts: string
  /** null when absent — dsl-spec lists the four-piece set, but css/json are
   *  optional per D5 thin-authoring: html+ts REQUIRED, css+json optional. */
  css: string | null
  json: string | null
  /** root element's ol:requires, split on ',' — feeds T8 capabilityRules gate */
  requires: string[]
}

/** App-level sources; json is raw text (T10 merges+validates), ts required by convention. */
export type AppUnit = {
  json: string | null
  ts: string | null
}

export type IngestResult = {
  pages: PageUnit[]
  app: AppUnit
}

export class IngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IngestError'
  }
}

export type IngestOptions = {
  /** build platform; `index.<platform>.<ext>` beats `index.<ext>` (dsl-spec §5) */
  platform?: string
}

const DEFAULT_PLATFORM = 'wechat'

export function ingest(root: string, options: IngestOptions = {}): IngestResult {
  const platform = options.platform ?? DEFAULT_PLATFORM
  const pages: PageUnit[] = []

  // Anchor on .html: page units are conventionally index.{html,ts,css,json};
  // `*.wechat.html` is an override of an existing page, never a page of its own
  // (test: 'bare .wechat.html (no base) ... — no page'). Deep override semantics: T8.
  const pagesRoot = join(root, 'pages')
  if (existsSync(pagesRoot)) {
    for (const file of walkHtmlFiles(pagesRoot)) {
      const name = toUnitName(root, file.slice(0, -'.html'.length))
      pages.push(pairPage(root, name, platform))
    }
    pages.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  }

  const appJson = selectFile(root, 'app', platform, 'json')
  const appTs = selectFile(root, 'app', platform, 'ts')
  return {
    pages,
    // App files are not authoring-mandatory at this stage (T10 decides);
    // degenerate/temp projects without them stay ingestable.
    app: {
      json: appJson === null ? null : readFileSync(appJson, 'utf8'),
      ts: appTs === null ? null : readFileSync(appTs, 'utf8'),
    },
  }
}

/** Pair one page — all four parts route through selectFile (override parity, §5). */
function pairPage(root: string, name: string, platform: string): PageUnit {
  // html anchors the walker on its BASE file; content still loses to
  // `index.<platform>.html` when co-present — §5 parity.
  const htmlPath = selectFile(root, name, platform, 'html')
  if (htmlPath === null) {
    throw new IngestError(`page '${name}' is missing required file '${name}.html'`)
  }
  const html = readFileSync(htmlPath, 'utf8')
  const tsPath = selectFile(root, name, platform, 'ts')
  if (tsPath === null) {
    throw new IngestError(`page '${name}' is missing required file '${name}.ts'`)
  }
  const ts = readFileSync(tsPath, 'utf8')
  const cssOpt = selectFile(root, name, platform, 'css')
  const jsonOpt = selectFile(root, name, platform, 'json')
  return {
    name,
    html,
    ts,
    css: cssOpt === null ? null : readFileSync(cssOpt, 'utf8'),
    json: jsonOpt === null ? null : readFileSync(jsonOpt, 'utf8'),
    requires: collectRequires(html),
  }
}

/** `<base>.<platform>.<ext>` beats `<base>.<ext>`; null when neither exists. */
function selectFile(root: string, relBase: string, platform: string, ext: string): string | null {
  const parts = relBase.split('/')
  const leaf = parts[parts.length - 1]
  const dir = join(root, ...parts.slice(0, -1))
  const overridden = join(dir, `${leaf}.${platform}.${ext}`)
  if (existsSync(overridden)) return overridden
  const base = join(dir, `${leaf}.${ext}`)
  return existsSync(base) ? base : null
}

/**
 * Collect the ROOT element's ol:requires. Regex on the first tag instead of a
 * full template parse (documented shortcut — the AST is built in T7; the root
 * tag cannot nest, so first `<...>` + its attribute span is sufficient here).
 */
function collectRequires(html: string): string[] {
  const tag = /<[^!>][^>]*>/.exec(html) // skips <!-- comments -->; first real element tag
  if (!tag) return []
  // (?<![-\w]) = attribute boundary: `data-ol:requires` must NOT match
  const m = /(?<![-\w])ol:requires\s*=\s*("([^"]*)"|'([^']*)')/.exec(tag[0])
  if (!m) return []
  const value = m[2] ?? m[3] ?? ''
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Recursive sweep of page-anchor .html files under `dir` (absolute paths). */
function walkHtmlFiles(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    // descend: the directory name IS the new path prefix (entry.name already in rel)
    if (entry.isDirectory()) out.push(...walkHtmlFiles(join(dir, entry.name), prefix ? rel : entry.name))
    // `*.<platform>.html` shape (hyphen/case allowed) = override, never a page anchor
    else if (entry.isFile() && entry.name.endsWith('.html') && !/\.[a-zA-Z][a-zA-Z0-9_-]*\.html$/.test(entry.name)) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

function toUnitName(root: string, absNoExt: string): string {
  return relative(root, absNoExt).split(sep).join('/')
}
