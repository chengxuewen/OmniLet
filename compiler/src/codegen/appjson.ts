// Task 10 (compile-slice1): app.json merge + page .json emission.
//
// app.json merge rule (spec §2 "作者透传、生成注入、冲突=报错"), kept honest-minimal:
//   - author file passes through verbatim (every key, author order kept);
//   - `pages` is the compiler-owned key: absent -> generated from ingest (sorted);
//     present -> must NAME THE SAME SET the scanner found (author order wins, it
//     encodes the home page); set mismatch = 402 error diag (a package that lies
//     about its page list is not shipped);
//   - nothing else is injected in slice 1 (no `style:"v2"`, no usingComponents —
//     add when a real consumer needs them).
// page .json: author passthrough + compiler-owned `component: true`
//   (Component-shape pages — README Task-1 measured verdict; a file claiming
//   `component: false` contradicts the shipped .js = 403).
// JSON invalid = 1xx (lex/parse family): 124 app.json, 125 page json.
import { diag } from '../diag'
import type { Diag } from '../types'

export type JsonMerge = { json: string | null; diagnostics: Diag[] }

export function mergeAppJson(raw: string | null, pageNames: readonly string[]): JsonMerge {
  const parsed = parseJsonObject(raw, 'app.json', 124)
  if ('diagnostics' in parsed) return { json: null, diagnostics: parsed.diagnostics }
  const obj = parsed.obj
  const generated = [...pageNames].sort()
  if ('pages' in obj) {
    const author = obj.pages
    const ok =
      Array.isArray(author) &&
      author.length === generated.length &&
      [...(author as unknown[])].sort().join('\n') === generated.join('\n')
    if (!ok) {
      return {
        json: null,
        diagnostics: [
          diag(
            402,
            `app.json pages 与扫描到的页面不一致（作者: ${JSON.stringify(author)}；扫描: ${JSON.stringify(generated)}）`,
            '冲突=报错（spec §2 合并规则）：删除 app.json 的 pages 让编译器生成，或补齐/改对页面清单',
          ),
        ],
      }
    }
    // author wins (order = home page first); pass-through
  } else {
    obj.pages = generated
  }
  return { json: stableJson(obj), diagnostics: [] }
}

export function emitPageJson(raw: string | null, file: string): JsonMerge {
  const parsed = parseJsonObject(raw, file, 125)
  if ('diagnostics' in parsed) return { json: null, diagnostics: parsed.diagnostics }
  const obj = parsed.obj
  if ('component' in obj && obj.component !== true) {
    return {
      json: null,
      diagnostics: [
        diag(
          403,
          `${file} 声明 component: ${JSON.stringify(obj.component)}，与组件式页面形态冲突`,
          '切片 1 微信产物页面一律 Component() 形状（README Task-1 实测判定）；删除 component 键或置 true',
        ),
      ],
    }
  }
  obj.component = true
  return { json: stableJson(obj), diagnostics: [] }
}

function parseJsonObject(
  raw: string | null,
  file: string,
  code: number,
): { obj: Record<string, unknown> } | { diagnostics: Diag[] } {
  if (raw === null) return { obj: {} }
  try {
    const v = JSON.parse(raw) as unknown
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      return { diagnostics: [diag(code, `${file} 顶层需为 JSON 对象`, '配置文件 = 对象字面量', { file, line: 0, col: 0 })] }
    }
    return { obj: v as Record<string, unknown> }
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    return { diagnostics: [diag(code, `${file} JSON 解析失败: ${msg}`, '修正 JSON 语法（1xx = lex/parse 家族）', { file, line: 0, col: 0 })] }
  }
}

// 2-space + LF + trailing newline: NORMALIZATION-conform output.
function stableJson(obj: Record<string, unknown>): string {
  return `${JSON.stringify(obj, null, 2)}\n`
}
