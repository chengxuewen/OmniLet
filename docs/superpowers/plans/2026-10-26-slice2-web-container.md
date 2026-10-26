# compile-slice-2（web/自有容器目标 + 容器闭环）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一 `counter` 源（零源码改动）`--target web` 产出静态 web 包；同包裸浏览器（localStorage）与 CEF 容器（原生桥存储）双消费者都活——"作者 DSL → 编译 → 自有容器 → 活着"闭环全绿（容器判定 = 非空白像素帧 + DOM 态探针回读初始值）。

**Architecture:** 第二张规则表 `web.ts`（同 RawTableSet 七分区）经既有三闸装载；内核行为零变化，仅 `splitDirective` 读行字段（D22 Card 1，微信产物字节不变）；web 侧 codegen = 新 html.ts/css.ts + manifest 信封生成器（files/sha256/minEngineVersion）+ appjson web 分支 + js.ts 调用点参数化；web runtime 自包含 vendor（facade/expr-evaluator/dom-adapter/storage/vendor-entry），存储双模懒探测（桥面优先，失败不回退）；容器 headless 证明环复用 T7 桥道 + echo 模式（eval 结果通道不存在，native 侧轮询裁决）。

**Tech Stack:** TypeScript + Node(≥22，pixi 环境)、@vue/compiler-dom、@vue/reactivity 3.5.44、@babel/core(preset-typescript)、postcss、esbuild、ajv、vitest(+jsdom+node:vm)、Playwright（本仓首次接线，devDep）；Rust：cef-rs（签名一律读 vendored bindings）、serde_json、sha2（新增于 omnilet-cef）。

**Spec:** `docs/superpowers/specs/2026-10-26-slice2-web-container-design.md`（D22 修订版，执行者与审查者都读它；本计划各任务引用其 §1 红线、§3.1 词表、§4 零新诊断、§5 验收矩阵、§7 deferred minors、§8 重开触发器）。

## Global Constraints

- 一切命令经 `pixi run`（D11 单一环境源）；pnpm 走 `pixi run pnpm …`
- **每任务收尾门禁**：`pixi run pnpm -r test` 全量绿（wechat 侧 fresh-run，数字以当次输出为准——LOW-8 禁止引用静态 206）+ `RECORD_GOLDEN` 未设时 wechat goldens 字节零漂移（g001-g030 + g100-counter-out）
- **内核 [UNCHANGED]**：`tables.ts`、`ir.ts`、`ingest.ts`、`diag.ts`、`capabilities.ts`、`codegen/dts.ts` 本切片零修改（任何 diff = 审查即退）；`rewrite.ts` 仅允许 D22 Card 1 的行字段扩展（splitDirective 读 item/index 名，默认值=现状字面量）
- **零新诊断码**：web 表行非法走 301-303 表闸、越界词走 201-205/209、能力 401、TS 形态 122/123/204（spec §4；"加一个 target 不需要新诊断码"本身就是 D5 验证）
- rpx→px 基准 750 写死（1rpx=0.5px @375px，D22 Card 3）；dsl-spec §4 已同步，不再改
- web v1 事件修饰符不支持（`.stop` 静默丢弃，D22 Card 6）；表达式白名单与 wechat 完全一致（`?.`/`??`/调用不在——加宽 = expr.ts 内核修订，非表行，spec §8）
- CEF/cef-rs API 签名一律从 vendored bindings / 既有 `bridge.rs`/`lib.rs` 用法抄写，禁止凭记忆写（#22 纪律）
- C2：回复与文档禁圈号字符（U+2460-24FF），用 1. 2. 3. / A / B / -
- C3：任何裁决相关表述的旧文同步与 spec 修订同 commit 落地（本切片 dsl-spec §4 已随 D22 落，计划执行中无新增裁决面）
- deferred minors：spec §7 的 17 条 slice-1 尾巴折入"碰到哪个文件顺带清"，不设专门任务；新增 web 事件修饰符缺口进 README 记录（T10）
- 文件形态红线：产物 LF、2 空格、无时间戳/绝对路径（NORMALIZATION.md）；manifest 信封 = 产物定稿后哈希（artifacts first, envelope second，无环）
- 容器侧红线：eval 结果通道不存在（lib.rs:499 硬编码 "null"）——**任何测试禁止 `backend.eval(...)` 的返回值断言**；断言只走 native 存储观测（echo 模式，D22 Card 4）
- 代理路由：Playwright 浏览器下载走系统代理（#39/#40；本机 `http_proxy=10.144.0.1:7897` 实测可用），禁止 `--noproxy '*'`

## File Structure

```
compiler/
├── package.json                                        (T9: +playwright devDep)
├── rules/
│   ├── wechat.ts                                       (T1: v-for 行加 forItem/forIndex 字段)
│   └── web.ts                                          [NEW] (T2)
├── src/
│   ├── rewrite.ts                                      (T1: splitDirective 行字段)
│   ├── compileProject.ts                               (T4: target 分发)
│   ├── cli.ts                                          (T4: --target)
│   ├── vendor.ts                                       (T6: target 参数)
│   ├── codegen/
│   │   ├── html.ts                                     [NEW] (T3)
│   │   ├── css.ts                                      [NEW] (T3)
│   │   ├── manifest.ts                                 (T3: 信封 emitManifestEnvelope)
│   │   ├── appjson.ts                                  (T3: web 分支)
│   │   ├── js.ts                                       (T3: web 调用点)
│   │   └── wxml.ts wxss.ts dts.ts                      [UNCHANGED]
├── runtime/
│   ├── wechat/                                         [UNCHANGED]
│   └── web/
│       ├── facade.ts                                   [NEW] (T5)
│       ├── expr-evaluator.ts                           [NEW] (T5)
│       ├── dom-adapter.ts                              [NEW] (T6)
│       ├── storage.ts                                  [NEW] (T7)
│       └── vendor-entry.ts                             [NEW] (T6)
├── tests/
│   ├── fixtures/counter/                               [REUSED 零改动]
│   ├── golden/g-web-g001..g-web-gNNN/                  [NEW] (T2/T3/T4, RECORD_GOLDEN=1)
│   ├── web-behavior.test.ts                            [NEW] (T9, Playwright)
│   └── out-web/                                        (T10 人眼档产物目录)
crates/omnilet-cef/
├── Cargo.toml                                          (T8: +sha2 serde_json)
├── src/bridge.rs                                       (T8: storage handlers + store_root)
└── src/lib.rs                                          (T8: validate_manifest_version)
crates/omnilet-container/
└── src/main.rs                                         (T8: 证明环扩展)
```

---

### Task 1: splitDirective 行字段扩展（D22 Card 1）+ schema 镜像

**Files:**
- Modify: `packages/rule-schema/schema/table.schema.json`（properties 加 `forItem`/`forIndex`，string，minLength 1）
- Modify: `compiler/src/types.ts`（TableRow 加 `forItem?: string` / `forIndex?: string`）——types.ts 在 [UNCHANGED] 清单**外**（清单只锁 tables/ir/ingest/diag/capabilities/dts），此为 Card 1 唯一允许的类型镜像
- Modify: `compiler/src/rewrite.ts`（splitDirective 原语 ~246 行区域）
- Modify: `compiler/rules/wechat.ts`（v-for 行加 `forItem: 'wx:for-item', forIndex: 'wx:for-index'`）

**Interfaces:**
- Consumes: `PRIMITIVES.splitDirective(job: PrimJob, row: TableRow): PrimResult`（rewrite.ts:227 现签名不变）
- Produces: 行字段 `forItem`（v-for 项别名 attr 名，缺省 `'wx:for-item'`）、`forIndex`（缺省 `'wx:for-index'`）；缺省行为 = 今日字节。wechat 现有行显式写默认值（自证字段通路，字节仍不变）

- [ ] **Step 1: 失败测试**——`compiler/src/primitives.test.ts` 末尾追加 describe（不新建文件，沿用其 `tables`/`compileFragment` 形状；compileFragment 在 rewrite.test.ts:17 同款，primitives.test.ts 已有本地等价 helper，若名不同以其现有导出为准，禁止复制实现）：
```ts
describe('splitDirective row-field extension (D22 Card 1)', () => {
  const forRow = (over: Partial<TableRow>): TableRow => ({
    kind: 'directiveMap', s: 'v-for', t: 'data-for', primitive: 'splitDirective', wrap: true, golden: 'g005', ...over,
  })
  it('forItem/forIndex fields rename the alias attrs; defaults = wx: literals', async () => {
    const { loadTables } = await import('../src/tables')
    const { rewrite } = await import('../src/rewrite')
    const { buildTemplateAst } = await import('../src/ir')
    const { serializeAst } = await import('../src/rewrite')
    const html = '<view v-for="(item, idx) in list"><text>{{ item }}</text></view>'
    const t1 = loadTables({ ...emptySet(), directiveMap: [forRow({ golden: 'g005', forItem: 'data-for-item', forIndex: 'data-for-index' })] })
    const r1 = rewrite((await buildTemplateAst(html, 'f')).ast, t1)
    expect(r1.diagnostics).toEqual([])
    expect(serializeAst(r1.outAst)).toContain('data-for-item="item"')
    expect(serializeAst(r1.outAst)).toContain('data-for-index="idx"')
    const t2 = loadTables({ ...emptySet(), directiveMap: [forRow({ golden: 'g005' })] })
    const r2 = rewrite((await buildTemplateAst(html, 'f')).ast, t2)
    expect(serializeAst(r2.outAst)).toContain('wx:for-item="item"')
    expect(serializeAst(r2.outAst)).toContain('wx:for-index="idx"')
  })
})
```
（`emptySet` 若 primitives.test.ts 无此 helper，就地内联 `tagMap: [], directiveMap: [], eventMap: [], lifecycleMap: [], exprWhitelist: [], styleRules: [], capabilityRules: []`——gates.test.ts:31 形状。）
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/primitives.test.ts` → `data-for-item` 期望失败（今日输出恒 `wx:for-item`）
- [ ] **Step 3: 最小实现**——rewrite.ts splitDirective 内两处：
```ts
// 返回 attrs 处（原 :246）：
return {
  attrs: [...gated.attrs,
    { k: row.forItem ?? 'wx:for-item', v: item },
    { k: row.forIndex ?? 'wx:for-index', v: index }],
  diagnostics: [], paths: gated.paths, scope,
}
```
types.ts TableRow 加两个字段（带注释：D22 Card 1，字段名钉死，语义=alias attr 名）；table.schema.json properties 加同名字符串定义（`additionalProperties: true` 本就放行，此步是**合同显式化**——schema 不加行也能跑，但表合同文档必须镜像，types/schema 双源同 commit）。
- [ ] **Step 4: wechat 行显式化**：rules/wechat.ts v-for 行加 `forItem: 'wx:for-item', forIndex: 'wx:for-index'`
- [ ] **Step 5: 字节不变证明**：`pixi run pnpm -r test` 全绿（g001-g030/g100 零漂移即证明）；再跑一次 `pixi run pnpm --dir compiler exec vitest run src/primitives.test.ts src/rewrite.test.ts src/codegen.test.ts`
- [ ] **Step 6: Commit** `feat(compiler): splitDirective reads alias-attr names from row fields (D22 Card 1; wechat bytes unchanged)`

### Task 2: rules/web.ts 全分区 + g-web 金卷桩 + 表闸装载 + 破坏探针

**Files:**
- Create: `compiler/rules/web.ts`、golden 目录 `compiler/tests/golden/g-web-g001/` 到 `g-web-g019/`（每目录 `in.html` + `expected.out.txt`，内容=真实记录，见 Step 3）
- Modify: `compiler/tests/gates.test.ts`（P1/P3 探针加 web 命名空间变体，T10 再总装，本任务先放破坏探针）

**Interfaces:**
- Produces: `export const webTables: RawTableSet`（七分区，词表 = spec §3.1 全表）；golden 命名空间 `g-web-gNNN`（与 wechat gNNN 前缀隔离，LOW-11）
- Consumes: `loadTables(rules, goldenRoot?)`（tables.ts，不变）

**web 表行全文**（spec §3.1 逐行落表，golden id 与 wechat 同号并行；`in.html` 用与 wechat 行同形的作者片段）：
- tagMap: `view->div` (g-web-g001)、`text->span` (g-web-g002)、`button->button` passthrough (g-web-g003)
- directiveMap: `v-if->data-if` rename+wrap (g-web-g004)、`v-for->data-for` splitDirective+wrap+`forItem:'data-for-item'`+`forIndex:'data-for-index'` (g-web-g005)、`:key->data-key` keyTransform (g-web-g006)、`:class->class` rename+wrap (g-web-g018)、`:style->style` rename+wrap (g-web-g019)
- eventMap: `@tap->click` valueMap (g-web-g007)
- lifecycleMap: onLoad/onShow/onHide/onUnload/onLaunch 五行 lifecyclePassthrough (g-web-g026..g030)
- exprWhitelist: 与 wechat.ts:38-52 十行**逐字段相同**（golden 指向 g-web-g008..g017）
- styleRules: `rpx->px`（**primitive 缺省**——换算是 css.ts 代码消费此行，basis 750 写死在 css.ts，D22 Card 3 诚实注；golden g-web-g020）、`class->omnilet-` classPrefix (g-web-g021)、`selector:class/tag/pseudo` 三行 (g-web-g022..g024)
- capabilityRules: `storage->omnilet.storage` (g-web-g025)

- [ ] **Step 1: 失败测试**——`compiler/src/tables.test.ts` 追加：
```ts
describe('web table loads through the same three gates (slice 2)', () => {
  it('webTables passes schema/golden/vocab gates and exposes the web vocab', async () => {
    const { webTables } = await import('../rules/web')
    const { loadTables } = await import('../src/tables')
    const t = loadTables(webTables)
    expect(t.tagMap.find((r) => r.s === 'view')!.t).toBe('div')
    expect(t.directiveMap.find((r) => r.s === 'v-for')!.t).toBe('data-for')
    expect(t.directiveMap.find((r) => r.s === 'v-for')!.forItem).toBe('data-for-item')
    expect(t.eventMap.find((r) => r.s === '@tap')!.t).toBe('click')
    expect(t.styleRules.find((r) => r.s === 'rpx')!.t).toBe('px')
    expect(t.capabilityRules.map((r) => r.s)).toEqual(['storage'])
  })
  it('web v-for row is breakage-probed: renaming forItem moves the emitted attr', async () => {
    const { webTables } = await import('../rules/web')
    const { loadTables } = await import('../src/tables')
    const { rewrite } = await import('../src/rewrite')
    const { buildTemplateAst } = await import('../src/ir')
    const { serializeAst } = await import('../src/rewrite')
    const mutated = { ...webTables, directiveMap: webTables.directiveMap.map((r) => r.s === 'v-for' ? { ...r, forItem: 'probe-item' } : r) }
    const r = rewrite((await buildTemplateAst('<view v-for="(i, ix) in xs"></view>', 'p')).ast, loadTables(mutated))
    expect(serializeAst(r.outAst)).toContain('probe-item="i"')
  })
})
```
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/tables.test.ts` → web 模块不存在即红
- [ ] **Step 3: 落表 + 金卷桩（真实记录，非手写臆造）**——web.ts 按上文全表落盘；每个 g-web-gNNN 建目录，`in.html` 抄 wechat 同号卷的 in.html（g020/g022-g025 是 codegen 卷，in.html 分别 = g020 同款 css 行 `view { padding: 10rpx; }`、逗号词表 `storage` 等——wechat 卷的 in.html 就是这个形状）；`expected.out.txt` 先写占位单换行再由 Step 4 的记录循环覆盖为 `serializeAst` 实测字节（rewrite 行卷）或留 codegen 卷（g-web-g020..g025 的 expected 由 T3 的 codegen 卷测试记录，本任务先放 in.html + 非空占位，gate 只查非空）。**注意**：g-web-g020..g025 的 expected 在 T3 记录前会因非空但内容空转不匹配——所以本任务装载测试只断言 `loadTables` 不抛 + 词表字段（gate 302 只验非空，不比对内容；内容比对在 T3/T4 的卷循环）。
- [ ] **Step 4: 记录 rewrite 行卷**——临时脚本跑一遍记录（一次性，不入库）：`pixi run pnpm --dir compiler exec tsx -e "…"` 或直接在 tables.test.ts 里临时 `process.env.RECORD_WEB_REWRITE='1'` 分支写入 g-web-g001..g019 的 expected（=web 表 rewrite+serializeAst 输出，模式抄 rewrite.test.ts 的 harness）；记录后移除分支、提交实测字节。断言 div/span/data-if/data-for/data-for-item/click 全部出现在对应卷里。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test`（wechat goldens 零漂移 + web 装载绿）
- [ ] **Step 6: Commit** `feat(compiler): web rule table (7 partitions, spec §3.1) + g-web golden namespace, table-gate proven`

### Task 3: web codegen 家族（html/css/manifest 信封/appjson 分支/js 调用点）

**Files:**
- Create: `compiler/src/codegen/html.ts`、`compiler/src/codegen/css.ts`、`compiler/src/codegen/css.test.ts`、`compiler/src/codegen/html.test.ts`
- Modify: `compiler/src/codegen/manifest.ts`（追加 `emitManifestEnvelope`，原 `emitManifest` 不动——wechat 侧零变化）
- Modify: `compiler/src/codegen/appjson.ts`（追加 `emitAppEntryJs` web 分支）
- Modify: `compiler/src/codegen/js.ts`（追加 `emitPageJsWeb(ts, pageName): JsResult`——web 调用点：factory 仍 `createPage`，runtimeRel 相对路径不变，仅 require 目标同为 `omnilet-runtime.js`；函数体一行转发 `emitModuleJs`）

**Interfaces:**
- Produces:
  - `emitHtml(pages: readonly { name: string }[], opts: { title: string }): string`——shell：`<div id="app"></div>` 挂载点 + 每页一个 `<script type="text/omnilet-template" data-page="<name>">` 模板块（模板交付裁缝口，见文末 reconciliation (a)）+ `<script src="./omnilet-runtime.js"></script>` + `<script src="./main.js"></script>`
  - `emitPageTemplate(pageName: string, outAst: readonly OutNode[]): string`——单页模板的 `text/omnilet-template` 块内容（复用 wxml.ts 的 render 逻辑形状，但 emit div/span 实标签 + data-* 属性 + `{{expr}}` 插值原样保留）
  - `emitCss(css: string, file: string, tables: TableSet): CssResult`——`{ code: string; diagnostics: Diag[] }`；rpx→px（1rpx=0.5px，basis 750 常量 `RPX_BASIS = 750`）；selector 白名单走 `selectorWhitelist(tables)` + `classPrefixPolicy(tables)`（tables.ts 现有导出，**共享不复制**）
  - `emitManifestEnvelope(files: readonly { path: string; bytes: string | Uint8Array }[], pkg: { packageVersion: string; minEngineVersion: string }): string`——`{ schemaVersion: 1, minEngineVersion, packageVersion, files: [{ path, hash: 'sha256:<hex>', size }] }` 按 path 排序；hash 对最终字节（String 用 UTF-8 编码）；**不含 signature 实值**（占位对象 `{ "algorithm": "ed25519", "value": "" }`，spec §1 非目标）
  - `emitAppEntryJs(ts: string): JsResult`——web 分支：`emitModuleJs(ts, { file: 'app.ts', factory: 'createApp', runtimeRel: './omnilet-runtime.js' })` 输出写为 `main.js`（文件名归属 T4 组装，本函数只产代码）
- Consumes: `OutNode`（rewrite.ts）、`TableSet`/`selectorWhitelist`/`classPrefixPolicy`（tables.ts/rewrite.ts）、`emitModuleJs`（js.ts:87）

- [ ] **Step 1: 失败测试**——`compiler/src/codegen/html.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { emitHtml, emitPageTemplate } from './html'
import type { OutNode } from '../rewrite'

describe('emitHtml web shell', () => {
  it('mount point + one template block per page + runtime/main script tags', () => {
    const html = emitHtml([{ name: 'pages/index/index' }], { title: 'counter' })
    expect(html).toContain('<div id="app"></div>')
    expect(html).toContain('<script type="text/omnilet-template" data-page="pages/index/index">')
    expect(html).toContain('<script src="./omnilet-runtime.js"></script>')
    expect(html).toContain('<script src="./main.js"></script>')
  })
  it('template block carries emitted elements verbatim; braces preserved', () => {
    const tpl = emitPageTemplate('pages/index/index', [
      { kind: 'el', tag: 'div', attrs: [{ k: 'data-if', v: '{{ready}}' }], children: [{ kind: 'interp', raw: 'count' }] },
    ] satisfies OutNode[])
    expect(tpl).toContain('<div data-if="{{ready}}">')
    expect(tpl).toContain('{{count}}')
  })
})
```
`compiler/src/codegen/css.test.ts`：
```ts
import { describe, expect, it } from 'vitest'
import { emitCss } from './css'
import { loadTables } from '../tables'
import { webTables } from '../../rules/web'

const t = loadTables(webTables)

describe('emitCss rpx->px (basis 750) + shared whitelist', () => {
  it('10rpx -> 5px; class prefixed via classPrefixPolicy (same-source row)', () => {
    const r = emitCss('.box { color: #333; padding: 10rpx; }', 't.css', t)
    expect(r.diagnostics).toEqual([])
    expect(r.code).toBe('.omnilet-box { color: #333; padding: 5px; }\n')
  })
  it('id selector rejects 212 — same band, zero new codes', () => {
    expect(emitCss('#top { color: red; }', 't.css', t).diagnostics.map((d) => d.code)).toEqual([212])
  })
  it('at-rules reject 212 (parity with wxss whitelist philosophy)', () => {
    expect(emitCss('@media screen { .a { color: red; } }', 't.css', t).diagnostics.map((d) => d.code)).toEqual([212])
  })
})
```
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/codegen/html.test.ts src/codegen/css.test.ts` → 模块不存在
- [ ] **Step 3: 最小实现**——css.ts 结构抄 wxss.ts（postcss parse → walkAtRules/walkRules → 同款 rejectReason/prefixClasses 逻辑，rpx 替换在 declaration 层：`value.replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, n) => `${Number(n) * 0.5}px`)`，常量 `const RPX_PX = 0.5 // 1rpx=0.5px @375px viewport, basis 750 (D22 Card 3)`）；html.ts 用模板串拼 shell + `render` 复制 wxml.ts 的 switch 形状（tag 已是 web 表映射后实标签，属性原样、`{{}}` 原样）。manifest.ts 追加：
```ts
import { createHash } from 'node:crypto'
export const ENVELOPE_FILE = 'manifest.json'
export function emitManifestEnvelope(
  files: readonly { path: string; bytes: string | Uint8Array }[],
  pkg: { packageVersion: string; minEngineVersion: string },
): string {
  const list = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => {
    const bytes = typeof f.bytes === 'string' ? Buffer.from(f.bytes, 'utf8') : f.bytes
    return { path: f.path, hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, size: bytes.length }
  })
  return `${JSON.stringify({ schemaVersion: 1, minEngineVersion: pkg.minEngineVersion, packageVersion: pkg.packageVersion, files: list, signature: { algorithm: 'ed25519', value: '' } }, null, 2)}\n`
}
```
appjson.ts 追加 `emitAppEntryJs`（一行转发 emitModuleJs 如上）。
- [ ] **Step 4: manifest 卷记录**——`g-web-g025` 的 expected 覆写为 `emitManifestEnvelope([{path:'index.html',bytes:'x'}], {packageVersion:'0.1.0',minEngineVersion:'0.1.0'})` 实测字节（在 css.test.ts 或新 manifest-web describe 里做卷比对，模式抄 codegen.test.ts:112 的 VOLUMES 循环）；g-web-g020 覆写为 `emitCss('view { padding: 10rpx; }','t.css',t).code` 实测（`view { padding: 5px; }`）。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test`
- [ ] **Step 6: Commit** `feat(compiler): web codegen family — html shell+template blocks, css rpx->px basis-750, manifest envelope (files+sha256+minEngineVersion)`

### Task 4: compileProject target 分发 + CLI --target web + 双目标同源红线 + 隔离探针

**Files:**
- Modify: `compiler/src/compileProject.ts`（target: 'wechat' | 'web'；web 分支装载 webTables、ingest platform:'web'、codegen 走 html/css/manifestEnvelope、无 app.json、app.ts→main.js、信封最后生成）
- Modify: `compiler/src/cli.ts`（`--target wechat|web`，缺省 wechat，错误信息沿用 usage 行）
- Create: `compiler/src/same-source.test.ts`
- Create golden: `compiler/tests/golden/g-web-g100-counter-out/`（RECORD_GOLDEN=1 记录）

**Interfaces:**
- Produces: `compileProject({ root, outDir, target: 'web', mode? }): Promise<CompileResult>`——web 产物文件集（spec §2 + 裁缝口 (a)）：`index.html`、`pages/index/index.js`、`pages/index/index.css`、`manifest.json`、`omnilet.manifest.json`、`omnilet.d.ts`、`omnilet-runtime.js`、`main.js`。fail-closed 语义不变：任何诊断 → 零文件写入（信封含内）；信封 = 其他文件字节定稿后生成（artifacts first, envelope second）。
- Consumes: `webTables`（T2）、`emitHtml/emitPageTemplate/emitCss/emitManifestEnvelope/emitAppEntryJs/emitPageJsWeb`（T3）、`buildVendor`（T6 后接 target 参数；本任务先以现状 `buildVendor(mode)` 落位，T6 改签名时同步此处）

- [ ] **Step 1: 失败测试**——`compiler/src/same-source.test.ts`（spec §5 红线 4 具名测试）：
```ts
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { compileProject } from './compileProject'

const SRC = dirname(fileURLToPath(import.meta.url))
const fixture = join(SRC, '..', 'tests', 'fixtures', 'counter')
const dirs = [mkdtempSync(join(tmpdir(), 'omnilet-same-wx-')), mkdtempSync(join(tmpdir(), 'omnilet-same-web-'))]
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('red-line 4: same source compiles clean on BOTH targets, --target is the only delta', () => {
  it('fixture hash unchanged between compiles; both ok', async () => {
    const hash = () => createHash('sha256').update(`${fixture}:` + ['app.json', 'app.ts', 'pages/index/index.html', 'pages/index/index.ts', 'pages/index/index.css', 'pages/index/index.json'].map((f) => require('node:fs').readFileSync(join(fixture, f))).join('|')).digest('hex')
    const before = hash()
    const wx = await compileProject({ root: fixture, outDir: dirs[0]!, target: 'wechat' })
    const web = await compileProject({ root: fixture, outDir: dirs[1]!, target: 'web' })
    expect(wx.ok).toBe(true)
    expect(web.ok).toBe(true)
    expect(hash()).toBe(before)
    expect(web.artifacts).toContain('index.html')
    expect(web.artifacts).toContain('manifest.json')
    expect(web.artifacts).not.toContain('app.json')
  })
  it('red-line 5: wechat dispatch does not import webTables; rename probe keeps wechat output byte-identical', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(join(SRC, 'compileProject.ts'), 'utf8'))
    const webBranch = src.slice(src.indexOf("target === 'web'"), src.indexOf("target === 'wechat'") + 2000)
    // wechat dispatch region must not reference web tables (cross-table isolation grep)
    const wxRegion = src.slice(src.indexOf('function compileProject'), src.indexOf("target === 'web'")) + src.slice(src.indexOf("target === 'wechat'"))
    expect(wxRegion.includes('webTables')).toBe(false)
    void webBranch
  })
})
```
（隔离探针的 grep 目标 = compileProject.ts 源文本；`target === 'web'`/`target === 'wechat'` 字符串由本任务实现自带，先写测试即红。rename probe 的字节级证明由 g100 零漂移承担——web.ts 存在与否不触碰 wechat 行。）
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/same-source.test.ts` → target:'web' 类型错误/断言红
- [ ] **Step 3: 最小实现**——compileProject.ts：
```ts
target?: 'wechat' | 'web'
// station 1:
const isWeb = (options.target ?? 'wechat') === 'web'
const tables = loadTables(isWeb ? webTables : wechatTables)
const units = ingest(root, { platform: isWeb ? 'web' : 'wechat' })
```
compilePage 加 target 分支：web 时模板走 `emitPageTemplate`（进 index.html 的块）、css 走 emitCss（`${page.name}.css`）、js 走 emitPageJsWeb、page json 不发射；app 层 web 分支无 mergeAppJson、`files.set('main.js', emitAppEntryJs(units.app.ts).code)`（app.ts 缺省时 emitAppEntryJs 传 `export default {}` 缺省源——直接跳过，不写 main.js，web 包无 app 级行为）；末尾 web 分支：
```ts
if (isWeb) {
  const envelopeFiles = [...files.entries()].filter(([rel]) => rel !== ENVELOPE_FILE).map(([path, bytes]) => ({ path, bytes }))
  files.set(ENVELOPE_FILE, emitManifestEnvelope(envelopeFiles, { packageVersion: '0.1.0', minEngineVersion: '0.1.0' }))
}
```
cli.ts：`--target` 解析（`'wechat' | 'web'`，非法值报 usage），透传 compileProject。
- [ ] **Step 4: 记录 web 全链金卷**——`RECORD_GOLDEN=1 pixi run pnpm --dir compiler exec vitest run src/codegen.test.ts` 前先在 codegen.test.ts 追加 web 全链 describe（文件集断言 + 每文件字节比对 g-web-g100-counter-out，模式抄 :262 的 g100 describe；`RECORD_GOLDEN` 分支写盘）；跑一次记录，再跑一次确认零漂移。spot-pin：`index.html` 含 template 块、`pages/index/index.js` 含 `require('../../omnilet-runtime.js')` 与 `createPage(`、`manifest.json` 的 files 数组含全部 7 文件且 hash 前缀 `sha256:`、无 `app.json`。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test`（wechat g100 零漂移 + web g-web-g100 绿）
- [ ] **Step 6: Commit** `feat(compiler): --target web end-to-end (target dispatch, CLI flag, g-web-g100 full-chain golden, same-source + isolation red-lines)`

### Task 5: runtime/web facade + expr-evaluator + 单向合同测试

**Files:**
- Create: `compiler/runtime/web/facade.ts`、`compiler/runtime/web/expr-evaluator.ts`、`compiler/src/web-expr.test.ts`

**Interfaces:**
- Produces:
  - facade.ts：`export { reactive, ref, computed, watch, effect, toRaw } from '@vue/reactivity'`（同四作者词，wechat/facade.ts 同款两行）
  - expr-evaluator.ts：`evalExpr(raw: string, scope: Record<string, unknown>): unknown`——dsl-spec §1 语法（数据读取/算术/比较/三原语/字面量；无调用/`?.`/`??`）；路径按 `.` 下钻 scope；for 别名作用域由 dom-adapter 传入（`data-for-item`/`data-for-index` 名绑值）
- Consumes: dsl-spec §1 语法（与 src/expr.ts 同 grammar——运行时是编译时白名单的**超集实现必须相等**，单向合同）

- [ ] **Step 1: 失败测试**——`compiler/src/web-expr.test.ts`：
```ts
import { describe, expect, it } from 'vitest'

describe('runtime expr-evaluator (dsl-spec §1 grammar)', () => {
  it('path / arithmetic / comparison / ternary / literals', async () => {
    const { evalExpr } = await import('../runtime/web/expr-evaluator')
    const scope = { count: 3, list: ['a', 'b'], item: 'a', ready: true }
    expect(evalExpr('count', scope)).toBe(3)
    expect(evalExpr('count + 1', scope)).toBe(4)
    expect(evalExpr('count * 2 >= 6', scope)).toBe(true)
    expect(evalExpr("ready ? 'y' : 'n'", scope)).toBe('y')
    expect(evalExpr('item', scope)).toBe('a')
    expect(evalExpr('!ready', scope)).toBe(false)
  })
  it('one-way contract: every compile-accepted sample evaluates; call/optional-chain rejected', async () => {
    const { evalExpr } = await import('../runtime/web/expr-evaluator')
    expect(() => evalExpr('foo(1)', {})).toThrow(/call|whitelist/i)
    expect(() => evalExpr('a?.b', {})).toThrow(/whitelist|chaining/i)
    expect(() => evalExpr('a ?? b', {})).toThrow(/whitelist/i)
  })
})
```
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/web-expr.test.ts` → 模块不存在
- [ ] **Step 3: 最小实现**——expr-evaluator.ts：移植 src/expr.ts 的 tokenize+ExprParser（**复制裁剪而非 import**——src/ 是编译时、runtime/ 会打进产物，import 编译时模块会把 node:fs 拉进 bundle；文件头注释写明"copy of src/expr.ts grammar, sync obligation = one-way contract test"）；ExprNode 走完后加 `evaluate(node, scope)`：path→下钻、lit→JSON 值、bin/log/un/cond→JS 运算符直映射。
- [ ] **Step 4: 单向合同测试**——web-expr.test.ts 追加：用 src/expr.ts 的 `parseExpr` 枚举 10 个正例（与 wechat.ts exprWhitelist 十行一一对应），断言 `parseExpr(x).ok === true` 且 `evalExpr(x, scope)` 不抛、值符合手算；负例 3 个（call/`?.`/`??`）两边同拒。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test`
- [ ] **Step 6: Commit** `feat(runtime): web facade (same 4 words) + expr-evaluator with one-way compile>=runtime contract test`

### Task 6: dom-adapter（整域重绘/微任务队列/事件委托/detach 钩子）+ vendor-entry（require shim）+ buildVendor target

**Files:**
- Create: `compiler/runtime/web/dom-adapter.ts`、`compiler/runtime/web/vendor-entry.ts`、`compiler/src/dom-adapter.test.ts`
- Modify: `compiler/src/vendor.ts`（`buildVendor(mode, target: CompileTarget = 'wechat')`——ENTRY 按 target 切 `runtime/wechat|web/vendor-entry.ts`；cache key 加 target；`RUNTIME_VERSION = '0.1.0-slice2'`）
- Modify: `compiler/src/compileProject.ts`（web 分支 `buildVendor(mode, 'web')`）

**Interfaces:**
- Produces:
  - `createPage(def: PageDef): void`（web 版）——def 形状 = codegen/js.ts 合同（`{ state, methods, onLoad, onShow, onHide, onUnload }`）；首调：state→reactive、渲染 effect 建立挂到微任务 flush 队列、`data-page` 模板块取出 → `evalExpr` 求值 data-if/data-for → `#app` 内整域 innerHTML 重建、根级事件委托（click → 最近 `[data-omnilet-event]` → methods）；生命周期：onLoad 页面装载即调（一次）、onShow/onHide 挂 `document.visibilitychange`、onUnload 挂 detach + `beforeunload`、onLaunch 首个页面挂载时调一次（模块级 `launched` 旗标，F9）
  - `window.omnilet.page.detach(): void`——停 effect、解 visibilitychange/beforeunload、清空 `#app`（浏览器档 detach 冻结断言的钩子）
  - flush 队列：`queueFlush(render)` microtask 合并（同一 tick 双写一次重绘，命名调度器 = test-honesty F5）
  - `buildVendor(mode: CompileMode, target?: 'wechat' | 'web'): Promise<string>`
- Consumes: `evalExpr`（T5）、`omnilet.storage`（T7 的 storage.ts 挂到 vendor-entry 全局）、`@vue/reactivity`（effect 停止 = `runner.effect.stop()`，adapter.ts:28 同款 API 形状）

**可测性关键**（本任务的 TDD 面板）：DOM 交互面收敛到注入点——`createPage(def, doc?: Document)` 第二参缺省 `globalThis.document`；测试传 fake Document（手写最小 stub：createElement/querySelectorAll/addEventListener/removeEventListener），不必 jsdom。重绘断言只看 `innerHTML` 字符串与队列调用次数。

- [ ] **Step 1: 失败测试**——`compiler/src/dom-adapter.test.ts`：
```ts
import { describe, expect, it } from 'vitest'

type FakeEl = { tagName: string; attrs: Record<string, string>; children: FakeEl[]; innerHTML?: string; textContent?: string }
function fakeDoc(): Document & { root: FakeEl; querySelAll: FakeEl[]; listeners: Map<string, EventListener> } {
  const listeners = new Map<string, EventListener>()
  const root: FakeEl = { tagName: 'DIV', attrs: { id: 'app' }, children: [] }
  const doc = {
    root, listeners, querySelAll: [] as FakeEl[],
    createElement: (tag: string): FakeEl => ({ tagName: tag.toUpperCase(), attrs: {}, children: [] }),
    querySelector: (sel: string) => (sel === '#app' ? (root as unknown as Element) : null),
    querySelectorAll: () => doc.querySelAll as unknown as Element[],
    addEventListener: (t: string, l: EventListener) => void listeners.set(t, l),
    removeEventListener: (t: string) => void listeners.delete(t),
    visibilityState: 'visible',
  }
  return doc as never
}

describe('dom-adapter whole-region repaint (fake Document, no jsdom)', () => {
  it('initial paint from template block state; write -> one repaint per microtask (same-tick merge)', async () => {
    const { createPage } = await import('../runtime/web/dom-adapter')
    const { reactive } = await import('../runtime/web/facade')
    const doc = fakeDoc()
    let repaints = 0
    const state = reactive({ count: 0 })
    createPage(
      {
        state,
        methods: { inc() { state.count++ } },
        pageName: 'pages/index/index',
        template: '<div data-if="{{ready}}"><span>{{count}}</span><button data-omnilet-event="inc">+1</button></div>',
        exprs: ['ready', 'count'],
      },
      doc as unknown as Document,
      () => { repaints++ }, // render-sink injection: counts whole-region rebuilds
    )
    await Promise.resolve() // flush microtask queue
    expect((doc.root.innerHTML ?? '').toContain('<span>0</span>')).toBe(true)
    state.count++
    state.count++ // same tick
    await Promise.resolve()
    expect(repaints).toBe(2) // initial + ONE merged repaint (not 3)
    expect(doc.root.innerHTML).toContain('<span>2</span>')
  })
  it('detach hook stops repaints and removes listeners', async () => {
    const { createPage } = await import('../runtime/web/dom-adapter')
    const doc = fakeDoc()
    const g = globalThis as { omnilet?: { page?: { detach?: () => void } } }
    createPage({ state: { n: 0 }, methods: {}, pageName: 'p', template: '<span>{{n}}</span>', exprs: ['n'] }, doc as unknown as Document)
    await Promise.resolve()
    expect(typeof g.omnilet?.page?.detach).toBe('function')
    const paints = doc.root.innerHTML
    g.omnilet!.page!.detach!()
    expect(doc.root.innerHTML).toBe('') // region cleared
    expect(doc.listeners.has('visibilitychange')).toBe(false)
    void paints
  })
})
```
（`template`/`exprs`/`pageName` 为显式注入参数——vendor-entry 的 createPage 包装层负责从 DOM 取模板块后调它；fake-doc 测试不需要真实 DOM。render-sink 第三参缺省 = 内建 innerHTML 重建。）
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/dom-adapter.test.ts` → 模块不存在
- [ ] **Step 3: 最小实现**——dom-adapter.ts（~150 行）：
```ts
// runtime/web/dom-adapter.ts — whole-region repaint (spec §3, 3A), named flush
// scheduler (test-honesty F5), root event delegation (survives repaint),
// detach test hook (browser tier freezes via window.omnilet.page.detach()).
import { effect } from './facade'
import { evalExpr } from './expr-evaluator'

type AnyRecord = Record<string, unknown>
type PageDef = { state?: AnyRecord; methods?: AnyRecord; pageName: string; template: string; exprs: string[] }
let launched = false // F9: onLaunch fires ONCE at FIRST page mount

export function createPage(def: PageDef, doc: Document = globalThis.document, repaint?: () => void): void {
  const g = globalThis as { omnilet?: AnyRecord }
  g.omnilet = g.omnilet ?? {}
  const state = (def.state ?? {}) as AnyRecord
  const host = doc.querySelector('#app') as { innerHTML: string } | null
  let stopped = false
  let queued = false
  const renderRegion = (): void => {
    // whole-region rebuild: data-if falsy drops the node; data-for repeats with
    // data-for-item/index aliases fed into evalExpr scope; {{expr}} unwrapped.
    host!.innerHTML = renderTemplate(def.template, state, def.methods ?? {})
    if (repaint) repaint()
  }
  const runner = effect(() => {
    void state // observe: touch every top-level key via render reads
    renderRegion()
    if (!queued) {
      queued = true
      Promise.resolve().then(() => { queued = false; renderRegion() })
    }
  })
  const onVis = (): void => { /* onShow/onHide per doc.visibilityState */ }
  doc.addEventListener('visibilitychange', onVis)
  const onUnload = (): void => { def.onUnload?.() }
  doc.addEventListener('beforeunload', onUnload)
  ;(g.omnilet as AnyRecord).page = {
    detach: () => {
      if (stopped) return
      stopped = true
      runner.effect.stop()
      doc.removeEventListener('visibilitychange', onVis)
      doc.removeEventListener('beforeunload', onUnload)
      if (host) host.innerHTML = ''
    },
  }
  def.onLoad?.()
  if (!launched) { launched = true; (globalThis as AnyRecord).__omniletOnLaunch?.() }
  // root-level click delegation: bound ONCE, survives innerHTML rebuilds
  doc.addEventListener('click', (ev: Event) => {
    const t = (ev.target as { closest?: (s: string) => Element | null })?.closest?.('[data-omnilet-event]')
    const method = t?.getAttribute('data-omnilet-event')
    if (method) (def.methods as AnyRecord)[method as string]?.()
  })
  void onVis
}
// renderTemplate: template -> region string. data-if="{{x}}" strip -> falsy omit;
// data-for + data-for-item/index -> repeat; {{e}} -> evalExpr(e, scopeWithAliases).
// (implementation ~40 lines, string-building only — no DOM mutation inside)
function renderTemplate(tpl: string, state: AnyRecord, methods: AnyRecord): string { void tpl; void state; void methods; return '' /* replaced in this step */ }
```
（Step 3 内把 renderTemplate 补全：正则切片 `data-if="{{…}}"` / `data-for="{{…}}"` / `{{…}}` 三类标记；事件 attr 发射为 `data-omnilet-event="inc"`；exprs 数组本实现不用可留作 contract 面。）
- [ ] **Step 4: vendor-entry + buildVendor**——`runtime/web/vendor-entry.ts`：
```ts
// F4: the browser require shim for emitted CJS require-heads is owned HERE —
// emitted pages are CJS (`const { reactive, createPage } = require('../../omnilet-runtime.js')`)
// but <script> tags give the bundle only a global. vendor-entry installs both faces:
export { reactive, ref, computed, watch } from './facade'
export { createPage } from './dom-adapter'
export { storage } from './storage'
// --- global + require shim (esbuild platform=neutral keeps `module` free) ---
declare const module: { exports: Record<string, unknown> }
const api = { reactive, ref, computed, watch, createPage, storage }
if (typeof globalThis !== 'undefined') {
  (globalThis as Record<string, unknown>).omnilet = { ...(globalThis as Record<string, unknown>).omnilet as object, storage }
}
if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, api)
```
vendor.ts：ENTRY 改 `const ENTRY = (target) => resolve(dirname(fileURLToPath(import.meta.url)), '..', 'runtime', target === 'web' ? 'web' : 'wechat', 'vendor-entry.ts')`；`buildVendor(mode, target = 'wechat')` cache key `` `${target}:${mode}` ``；banner 加 `target=${target}`。
- [ ] **Step 5: 裸 vm 冒烟**——dom-adapter.test.ts 追加一条：compileProject web 目标产物 `omnilet-runtime.js` 在 node:vm 裸上下文（device-detach.test.ts:20 的 loadVendorBareVm 形状）加载后 `typeof module.exports.createPage === 'function'` 且 `window/document/process` 未定义也加载成功（esbuild define NODE_ENV 已由 wechat 侧 T11 证明，web entry 不得引入新全局依赖）。
- [ ] **Step 6: 全门禁 + Commit**：`pixi run pnpm -r test`；`feat(runtime): web dom-adapter (whole-region repaint, microtask flush, delegation, detach hook) + vendor-entry require shim + buildVendor(target)`

### Task 7: storage.ts 双模探测 + 裸 vm 单元档（device-detach 模式）

**Files:**
- Create: `compiler/runtime/web/storage.ts`、`compiler/src/storage.test.ts`

**Interfaces:**
- Produces: `export const storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }`
  - 懒探测（首次调用一次）：`typeof window.omnilet?.storage?.get === 'function' && typeof window.cefQuery === 'function'` → 桥模式（get 走 `window.omnilet.storage.get(key, cb)` 包装成 Promise，set 走 `set` + 失败 reject）；否则 localStorage 模式（get/set 直映射，JSON 值）。
  - **探测后不静默回退**：桥模式下调用的 onFailure → Promise reject（console.error 面已在 bridge.rs BOOTSTRAP_JS；spec §4 "probe once, degrade once"）。
- Consumes: `window.omnilet.storage`（bridge.rs BOOTSTRAP_JS:232 注入面）、`window.localStorage`（裸浏览器）

- [ ] **Step 1: 失败测试**——`compiler/src/storage.test.ts`：
```ts
import { describe, expect, it } from 'vitest'

type Faces = { omnilet?: { storage?: { get(k: string, cb: (v: string) => void): void; set(k: string, v: string): void } }; cefQuery?: (o: unknown) => void; localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } }

function install(faces: Faces): void {
  const g = globalThis as unknown as Faces
  delete g.omnilet
  delete g.cefQuery
  delete g.localStorage
  Object.assign(g, faces)
}

describe('storage dual-mode lazy probe (spec §4: probe once, degrade once)', () => {
  it('both surfaces present -> bridge mode; get resolves via cefQuery onSuccess', async () => {
    const calls: string[] = []
    install({
      omnilet: { storage: { get: (k, cb) => { calls.push(`get:${k}`); cb('"7"') }, set: (k, v) => { calls.push(`set:${k}=${v}`) } } },
      cefQuery: () => {},
    })
    const { storage } = await import('../runtime/web/storage')
    await storage.set('probe', '7')
    expect(calls).toContain('set:probe=7')
    expect(await storage.get('probe')).toBe('7')
    expect(calls).toContain('get:probe')
    install({})
  })
  it('surfaces absent -> localStorage fallback; value round-trips', async () => {
    const mem = new Map<string, string>()
    install({ localStorage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) } })
    const { storage } = await import('../runtime/web/storage')
    await storage.set('k', 'v')
    expect(await storage.get('k')).toBe('v')
    install({})
  })
  it('bridge mode failure propagates — NO silent localStorage fallback', async () => {
    install({
      omnilet: { storage: { get: (_k, _cb) => { /* never answers */ }, set: () => {} } },
      cefQuery: (o: { onFailure?: (c: number, m: string) => void }) => { o.onFailure?.(-1, 'boom') },
    })
    const { storage } = await import('../runtime/web/storage')
    await expect(storage.get('x')).rejects.toThrow(/boom/)
    install({})
  })
})
```
- [ ] **Step 2: 跑红**：`pixi run pnpm --dir compiler exec vitest run src/storage.test.ts`
- [ ] **Step 3: 最小实现**——storage.ts（~60 行）：模块级 `let mode: 'bridge' | 'local' | null = null`；`probe()` 首次调用判双面（如上 Interfaces 谓词）；`get`/`set` 各自按模式分支，桥 get 包 onSuccess/onFailure 成 Promise。
- [ ] **Step 4: 裸 vm 单元档**——storage.test.ts 追加（device-detach.test.ts 模式）：compileProject web 产物 vendor 在 `vm.createContext({ module: { exports: {} } })` 裸上下文加载（无 window/document/process/localStorage），断言 `exports.storage` 存在且首次 `get` 在无任何面时**抛出可读错误**（两面全无 = 无处降级，fail-loud 而非假成功——此为 probe 语义的裸环境极端例）。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test`
- [ ] **Step 6: Commit** `feat(runtime): web storage dual-mode (lazy both-surface probe, no silent fallback) + bare-vm unit tier`

### Task 8: Rust 桥存储处理器 + manifest 版本校验 + 容器 headless 证明环

**Files:**
- Modify: `crates/omnilet-cef/src/bridge.rs`（`register_storage_handlers(dir: &Path)`：`omnilet.storage.get/.set` 两 handler；store 根 = `<dir>-omnilet-data/`（包根**外**兄弟目录，invariant-6 by construction）；单 JSON 文件 `store.json`；temp+rename 原子写；create_dir_all 首写时）
- Modify: `crates/omnilet-cef/src/lib.rs`（`pub fn validate_manifest_version(manifest_bytes: &str, engine: &str) -> Result<(), String>`——解析 schemaVersion/minEngineVersion，minEngineVersion > engine 版本段 → Err 拒载；load_offline_dir 调用面由 T9 容器环接线，本任务只落函数+单测）
- Modify: `crates/omnilet-cef/Cargo.toml`（+`sha2`、`serde_json` 已有则不动）
- Modify: `crates/omnilet-container/src/main.rs`（`load_headless` 证明环扩展）

**Interfaces:**
- Consumes: `bridge_registry()`（bridge.rs:26）、`SharedBridge = Arc<dyn Fn(BridgeRequest) + Send + Sync>`（bridge.rs:32）、`BridgeRequest { method, payload, responder }` + `BridgeResponder::respond(BridgeResult)`（lib.rs omnilet-webview，恰好一次）、`BOOTSTRAP_JS` 的 wire 格式 `{"m":"omnilet.storage.set","a":"[\"k\",\"v\"]"}` / `{"m":"omnilet.storage.get","a":"k"}`（bridge.rs:237-247 逐字）
- Produces:
  - `pub(crate) fn register_storage_handlers(root: &std::path::Path)`——幂等（registry insert 覆盖同键）；get：读 store.json（缺文件 → `"null"`），payload 即 key，`responder.respond(Ok(value_json))` **恰好一次**（T7 set handler 是反例教材：dropped responder = JS 静默挂起）；set：payload `["k","v"]` 数组反序列化，写 store.json（serde_json Map，temp 文件 + `std::fs::rename` 原子替换），responder 恰好一次 `Ok("{}")`。
  - `pub fn validate_manifest_version(manifest_bytes: &str, engine: &str) -> Result<(), String>`
  - main.rs 证明环：pump 循环判定条件扩展为三腿——(1) `backend.painted() && backend.offline_served() > 0`（既有）；(2) 像素非空白：`backend.center_pixel()` 出现过任一 `Some((r,g,b))` 且非全 `(0,0,0)`；(3) DOM 态探针：页面 JS 已通过 `omnilet.storage.set('probe', document.querySelector('#app span').textContent)` 回写——native 侧轮询 store.json 出现 `"probe"` 键且值 = `"0"`。verdict 行：`LOADED <dir> painted served=N probe=OK` rc=0（三腿全真），任一腿超时（15s）→ rc=1 带缺失腿名。

**HANDLER 纪律**（写码前读这行）：handler 体在 browser UI 线程 registry 读锁下运行——**禁止 re-enter registry**、禁止 responder 二次消费（类型上 FnOnce 已防）、同步文件 I/O 在此体量可接受（spec §3 F4）。

- [ ] **Step 1: 失败测试**——`crates/omnilet-cef/src/bridge.rs` `#[cfg(test)]` 追加（store 根用 tempdir）：
```rust
#[cfg(test)]
mod storage_handler_tests {
    use super::*;
    use omnilet_webview::BridgeRequest;

    fn temp_store_root(tag: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("omnilet-store-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn set_then_get_roundtrips_through_store_json() {
        let root = temp_store_root("roundtrip");
        register_storage_handlers(&root);
        let set_val = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
        let sv = set_val.clone();
        // call the registered handler directly through the registry (read-lock contract)
        let reg = bridge_registry().read().unwrap();
        let set_h = reg.get("omnilet.storage.set").expect("set handler registered").clone();
        let payload = serde_json::to_string(&["probe".to_string(), "0".to_string()]).unwrap();
        set_h(BridgeRequest {
            method: "omnilet.storage.set".into(),
            payload,
            responder: omnilet_webview::BridgeResponder::new(move |res| {
                assert!(res.is_ok());
            }),
        });
        let get_h = reg.get("omnilet.storage.get").expect("get handler registered").clone();
        let gh = get_h.clone();
        let rx = std::sync::mpsc::channel();
        let tx = rx.0;
        std::thread::spawn(move || {
            gh(BridgeRequest {
                method: "omnilet.storage.get".into(),
                payload: "probe".into(),
                responder: omnilet_webview::BridgeResponder::new(move |res| {
                    let _ = tx.send(res);
                }),
            });
        });
        let answered = rx.1.recv_timeout(std::time::Duration::from_secs(5)).expect("get answered exactly once");
        assert_eq!(answered.unwrap(), "\"0\"");
        let raw = std::fs::read_to_string(root.join("store.json")).unwrap();
        assert!(raw.contains("\"probe\""));
        drop(reg);
        let _ = std::fs::remove_dir_all(&root);
        let _ = set_val; let _ = sv;
    }

    #[test]
    fn get_of_missing_key_answers_null_exactly_once() {
        let root = temp_store_root("miss");
        register_storage_handlers(&root);
        let reg = bridge_registry().read().unwrap();
        let get_h = reg.get("omnilet.storage.get").unwrap().clone();
        let (tx, rx) = std::sync::mpsc::channel();
        get_h(BridgeRequest {
            method: "omnilet.storage.get".into(),
            payload: "nope".into(),
            responder: omnilet_webview::BridgeResponder::new(move |res| {
                let _ = tx.send(res);
            }),
        });
        assert_eq!(rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap().unwrap(), "null");
        drop(reg);
        let _ = std::fs::remove_dir_all(&root);
    }
}
```
（若 handler 直调跨线程触 UI-thread 断言，则把直调改为抽出的 `storage_handle(root, method, payload) -> BridgeResult` 纯函数 + handler 体一行委托——以 cargo test 首跑结果为准，两种形状择一，断言不变。）
- [ ] **Step 2: 跑红**：`pixi run cargo test -p omnilet-cef storage_handler` → `register_storage_headers` 未定义编译红
- [ ] **Step 3: 最小实现**——bridge.rs：
```rust
/// Per-package native store root: OUTSIDE the package (sibling <dir>-omnilet-data/)
/// — load_offline_dir serves ANY file under the package root (F3), so an in-package
/// store would leak via omnilet://app/ and pollute the served-count proof.
static STORE_ROOT: OnceLock<std::path::PathBuf> = OnceLock::new();

pub(crate) fn register_storage_handlers(root: &std::path::Path) {
    let _ = STORE_ROOT.set(root.join(format!("{}-omnilet-data", root.file_name().and_then(|n| n.to_str()).unwrap_or("pkg"))));
    let store_path = STORE_ROOT.get().unwrap().join("store.json");
    bridge_registry().write().unwrap().insert(
        "omnilet.storage.set".to_string(),
        std::sync::Arc::new(move |req: BridgeRequest| {
            // payload = JSON ["k","v"]; temp+rename atomic; responder EXACTLY once.
            let val: Result<(String, String), _> = serde_json::from_str(&req.payload);
            let res = match val {
                Ok((k, v)) => storage_write(&store_path, &k, &v),
                Err(e) => Err(format!("bad set payload: {e}")),
            };
            req.responder.respond(res.map(|_| "{}".to_string()));
        }),
    );
    bridge_registry().write().unwrap().insert(
        "omnilet.storage.get".to_string(),
        std::sync::Arc::new(move |req: BridgeRequest| {
            let v = storage_read(&store_path, &req.payload);
            req.responder.respond(Ok(v));
        }),
    );
}

fn store_map(path: &std::path::Path) -> serde_json::Map<String, serde_json::Value> {
    std::fs::read_to_string(path).ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

fn storage_write(path: &std::path::Path, key: &str, value: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
    let mut map = store_map(path);
    map.insert(key.to_string(), serde_json::Value::String(value.to_string()));
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_string(&map).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn storage_read(path: &std::path::Path, key: &str) -> String {
    store_map(path).get(key).map(|v| v.to_string()).unwrap_or_else(|| "null".into())
}
```
（serde_json Map/Value 已在 Cargo 依赖面——若 omnilet-cef 未直接依赖 serde_json 则按 Cargo.toml 现状补 `serde_json = "1"`，不引新生态。）
- [ ] **Step 4: validate_manifest_version**——lib.rs 追加 + 单测：
```rust
/// Envelope version gate (D22 Card 2): schemaVersion must be 1 and
/// minEngineVersion must be <= engine (semver-ish segment compare on dots).
pub fn validate_manifest_version(manifest_bytes: &str, engine: &str) -> Result<(), String> {
    let v: serde_json::Value = serde_json::from_str(manifest_bytes).map_err(|e| format!("manifest.json unreadable: {e}"))?;
    let schema = v.get("schemaVersion").and_then(|x| x.as_i64()).ok_or("schemaVersion missing")?;
    if schema != 1 { return Err(format!("schemaVersion {schema} unsupported (engine speaks 1)")); }
    let min = v.get("minEngineVersion").and_then(|x| x.as_str()).ok_or("minEngineVersion missing")?;
    let seg = |s: &str| -> Vec<u64> { s.split('.').map(|p| p.parse().unwrap_or(0)).collect() };
    let (mins, engs) = (seg(min), seg(engine));
    for i in 0..mins.len().max(engs.len()) {
        let m = mins.get(i).copied().unwrap_or(0);
        let e = engs.get(i).copied().unwrap_or(0);
        if m > e { return Err(format!("package needs engine >= {min}, this engine is {engine}")); }
        if m < e { return Ok(()); }
    }
    Ok(())
}

#[cfg(test)]
mod manifest_gate_tests {
    #[test]
    fn min_engine_gate_bites_and_passes() {
        let ok = r#"{"schemaVersion":1,"minEngineVersion":"0.1.0","packageVersion":"0.1.0","files":[]}"#;
        assert!(super::validate_manifest_version(ok, "0.1.0").is_ok());
        assert!(super::validate_manifest_version(ok, "0.2.0").is_ok());
        assert!(super::validate_manifest_version(ok, "0.0.9").is_err());
        assert!(super::validate_manifest_version(r#"{"schemaVersion":2}"#, "0.1.0").is_err());
        assert!(super::validate_manifest_version("not json", "0.1.0").is_err());
    }
}
```
- [ ] **Step 5: 容器证明环**——main.rs `load_headless`：`load_offline_dir` 前调 `omnilet_cef::bridge::register_storage_handlers(dir)`（需要 `pub(crate)` 提升为 `pub` 或经 `omnilet_cef` re-export——择 re-export，冻结面零扩：非 trait 面）；循环改三腿判定 + store.json 轮询：
```rust
let store = dir.join(format!("{}-omnilet-data", dir.file_name().and_then(|n| n.to_str()).unwrap_or("pkg"))).join("store.json");
let mut pixel_ok = false;
let mut probe_ok = false;
// in the existing pump loop, after painted/served check:
if let Some((r, g, b)) = backend.center_pixel() {
    if (r, g, b) != (0, 0, 0) { pixel_ok = true; }
}
if let Ok(raw) = std::fs::read_to_string(&store) {
    if raw.contains("\"probe\"") && raw.contains("\"0\"") { probe_ok = true; }
}
```
timeout 10s→15s；verdict：三腿 → `println!("LOADED {dir:?} painted served={} probe=OK", backend.offline_served())` rc 0；否则 `eprintln!("error: proof incomplete painted={} served={} pixel={} probe={}", …)` rc 1。main.rs 现有单测（help/missing-dir/manifest-fail）保持绿。
- [ ] **Step 6: 全门禁 + Commit**：`pixi run cargo test --workspace && pixi run cargo clippy --workspace --all-targets -- -D warnings`；`feat(cef): native storage handlers (out-of-root store, atomic write, exactly-once responder) + manifest version gate + container proof loop (pixel/DOM-probe legs)`

### Task 9: Playwright 首接线 + 浏览器行为档 + 容器闭环腿

**Files:**
- Modify: `compiler/package.json`（devDeps + `"@playwright/test"` 精确锁版；scripts + `"test:browser": "playwright test"`）
- Create: `compiler/playwright.config.ts`、`compiler/tests/web-behavior.test.ts`（Playwright spec）
- Modify: `compiler/src/compileProject.ts`（load_offline_dir 侧不在此 crate——此处仅确认 web 产物 `manifest.json` 供容器消费，无码改则记录"无改动"）

**Interfaces:**
- Consumes: `compileProject({target:'web'})` 产物目录（T4）、`npx playwright install chromium`（代理路由 #39）、容器二进制 `target/debug/omnilet-container --dir <pkg>`（T8 证明环）
- Produces: 浏览器档四断言（spec §1.2）：初始 0/a/b；tap +1 x3 → 3；同 tick 双击 → 一次合并刷新；detach 冻结。容器腿：跑二进制断言 `LOADED … probe=OK` rc=0。

- [ ] **Step 1: 接线（一次性 bring-up，~0.5 任务记风险账 spec §6.3）**：`pixi run pnpm --dir compiler add -D @playwright/test`（锁 exact 版本回写 package.json）；`pixi run pnpm --dir compiler exec playwright install chromium`（走系统代理；若下载失败记录到 pitfalls 并重试一次——#39 分层诊断：直连 vs 代理）。`playwright.config.ts`：`testDir: 'tests'`, `testMatch: 'web-behavior.test.ts'`, `use: { headless: true }`, `webServer` 不用（测试内先编译）。
- [ ] **Step 2: 失败测试**——`compiler/tests/web-behavior.test.ts`：
```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const SRC = dirname(fileURLToPath(import.meta.url))
let out: string
test.beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'omnilet-pw-'))
  // run through the REAL compiler, then load the artifact (test-matrix honesty)
  const { compileProject } = await import('../src/compileProject')
  const r = await compileProject({ root: join(SRC, 'fixtures', 'counter'), outDir: out, target: 'web' })
  if (!r.ok) throw new Error(`compile failed: ${JSON.stringify(r.diagnostics)}`)
})
test.afterAll(() => rmSync(out, { recursive: true, force: true }))

test('initial 0 / a / b rendered from the compiled package', async ({ page }) => {
  await page.goto('file://' + join(out, 'index.html'))
  await page.waitForSelector('#app span')
  const texts = await page.$$eval('#app span', (els) => els.map((e) => e.textContent))
  expect(texts).toEqual(['0', 'a', 'b'])
})

test('tap +1 x3 -> 3; same-tick double-tap merges into one repaint', async ({ page }) => {
  await page.goto('file://' + join(out, 'index.html'))
  const btn = page.locator('#app button')
  for (let i = 0; i < 3; i++) { await btn.click() }
  await expect(page.locator('#app span').first()).toHaveText('3')
  await btn.click({ clickCount: 1 }); await btn.click({ clickCount: 1 }) // same tick pair
  await expect(page.locator('#app span').first()).toHaveText('5')
})

test('detach freezes rendering', async ({ page }) => {
  await page.goto('file://' + join(out, 'index.html'))
  await page.waitForSelector('#app span')
  await page.evaluate(() => (window as { omnilet: { page: { detach: () => void } } }).omnilet.page.detach())
  const before = await page.locator('#app').innerHTML()
  await page.locator('#app button').click({ force: true }).catch(() => {})
  const after = await page.locator('#app').innerHTML()
  expect(after).toBe(before) // region cleared + frozen — no repaint after detach
})

test('localStorage mode (no cefQuery surface) persists a storage value', async ({ page }) => {
  await page.goto('file://' + join(out, 'index.html'))
  const v = await page.evaluate(async () => {
    const w = window as unknown as { omnilet: { storage: { set(k: string, v: string): Promise<void>; get(k: string): Promise<string | null> } } }
    await w.omnilet.storage.set('k', 'v')
    return w.omnilet.storage.get('k')
  })
  expect(v).toBe('v')
})

test('container closed loop: headless run on the compiled web package proves LOADED probe=OK', async () => {
  const { spawnSync } = await import('node:child_process')
  const bin = join(SRC, '..', '..', 'target', 'debug', 'omnilet-container')
  const r = spawnSync(bin, ['--dir', out], { encoding: 'utf8', timeout: 60000 })
  expect(r.status).toBe(0)
  expect(r.stdout).toContain('LOADED')
  expect(r.stdout).toContain('probe=OK')
})
```
（容器腿属 T8 证明环的 TS 侧消费；若 target/debug/omnilet-container 不存在 → 测试内 `cargo build -p omnilet-container` 一次（spawnSync cargo），失败即红——诚实暴露环境缺口。）
- [ ] **Step 3: 跑红→修**：`pixi run pnpm --dir compiler exec playwright test`；逐断言修 dom-adapter/storage 的真浏览器行为差异（fake-doc 测试的盲区：真实 click 合并、file:// 下的模板块读取）。允许的真实缺口修法：vendor-entry 补模板块解析（`document.querySelector('script[type="text/omnilet-template"][data-page="pages/index/index"]').textContent` → createPage 的 template 参数——本步落真实现，替代 T6 的注入参数默认路径）。
- [ ] **Step 4: 双面存储断言**（容器内 cefQuery 面）已由容器腿的 probe=OK 覆盖（页面 JS 走 `omnilet.storage.set` → 桥模式）——本步核对该腿产物 store.json 在 `<pkg>-omnilet-data/`（包外）而非包内：`test.afterAll` 里 `existsSync(join(out, 'omnilet-data'))` 必须为 false（防 F3 泄漏回归）。
- [ ] **Step 5: 全门禁**：`pixi run pnpm -r test` + `pixi run pnpm --dir compiler exec playwright test` 双绿
- [ ] **Step 6: Commit** `feat(compiler): Playwright browser tier + container closed-loop leg green (first browser wiring, proxy-routed install)`

### Task 10: web 四探针门禁总装 + 结构探针 + README runbook + 文档账

**Files:**
- Modify: `compiler/tests/gates.test.ts`（web 侧 P1-P4 变体）
- Create: `compiler/src/structure-web.test.ts`（结构探针组）
- Modify: `compiler/README.md`（web target runbook 段 + measured bytes 表 + deferred minor 登记）
- Modify: `.agents/memorys/status.md`（phase 行 + next steps）
- Modify: `docs/mvp-checklist.md`（若 B0 行适用 web 消费面则注一行，不新增条目）
- Create: `compiler/tests/out-web/`（人眼档产物，.gitignore 若 tests/out 已忽略则同款处理——先查 `git check-ignore compiler/tests/out`）

**Interfaces:**
- Consumes: 全前序任务的绿面
- Produces: 门禁探针永久化（每条 = 故意破坏必红）

- [ ] **Step 1: web 四探针**——gates.test.ts 追加：
  - P1-web：`webTables` 单行 golden 改 `g-web-g999-no-such` → `loadTables` 抛 302（抄 P1 形状 gates.test.ts:51）
  - P3-web：web 表加 `ol:slot` 行 + `v-slot` 行 → 303（抄 P3）
  - P4-web：DCE 顺序在 web 分发同样成立——gates.test.ts P4 的 fixture 复用，`compileProject({target:'web'})` 断言零 regenerator + 死字节不泄漏（REGEN_RE 既有）
  - P2（话术变异）与目标无关，不加 web 变体（注释说明一行）
- [ ] **Step 2: 结构探针**——structure-web.test.ts：
```ts
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileProject } from './compileProject'

const SRC = dirname(fileURLToPath(import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'omnilet-struct-web-'))
let files: string[]
beforeAll(async () => {
  const r = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'counter'), outDir: out, target: 'web' })
  expect(r.ok).toBe(true)
  files = readdirSync(out, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? [e.name + '/'] : [e.name])).sort()
})
afterAll(() => rmSync(out, { recursive: true, force: true }))

describe('web structural tier (spec §5 structural row)', () => {
  it('package tree is EXACT: shell + pages js/css + main.js + envelope + sidecars + runtime', () => {
    expect(files).toEqual(['index.html', 'main.js', 'manifest.json', 'omnilet-runtime.js', 'omnilet.d.ts', 'omnilet.manifest.json', 'pages/'].sort())
  })
  it('envelope files list == disk; every sha256 matches the bytes on disk', () => {
    const env = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as { schemaVersion: number; minEngineVersion: string; files: { path: string; hash: string; size: number }[] }
    expect(env.schemaVersion).toBe(1)
    const onDisk = files.filter((f) => f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.css')).sort()
    expect(env.files.map((f) => f.path).sort()).toEqual(onDisk)
    for (const f of env.files) {
      const bytes = readFileSync(join(out, f.path))
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.hash.replace('sha256:', ''))
      expect(bytes.length).toBe(f.size)
    }
  })
  it('require-heads point at the package-root runtime (../../ depth for pages/index)', () => {
    const pageJs = readFileSync(join(out, 'pages', 'index', 'index.js'), 'utf8')
    expect(pageJs).toContain("require('../../omnilet-runtime.js')")
  })
  it('shell carries one template block per page (delivery seam (a))', () => {
    const html = readFileSync(join(out, 'index.html'), 'utf8')
    expect(html).toContain('data-page="pages/index/index"')
    expect(html).toContain('id="app"')
  })
  it('fail-closed: envelope absent when a diag blocks (401 shape, nothing written)', async () => {
    const bad = mkdtempSync(join(tmpdir(), 'omnilet-struct-web-bad-'))
    const outBad = join(bad, 'pkg')
    try {
      const { writeFileSync, mkdirSync } = await import('node:fs')
      mkdirSync(join(bad, 'pages', 'index'), { recursive: true })
      writeFileSync(join(bad, 'pages', 'index', 'index.html'), '<view ol:requires="network"><text>x</text></view>')
      writeFileSync(join(bad, 'pages', 'index', 'index.ts'), "import { reactive } from 'omnilet'\nexport default { state: reactive({}) }")
      const r = await compileProject({ root: bad, outDir: outBad, target: 'web' })
      expect(r.ok).toBe(false)
      expect(r.diagnostics.map((d) => d.code)).toEqual([401])
      expect(existsSync(outBad)).toBe(false)
    } finally {
      rmSync(bad, { recursive: true, force: true })
    }
  })
})
```
（envelope files 断言面 = index.html + pages js/css + main.js + omnilet-runtime.js；侧车 omnilet.manifest.json / omnilet.d.ts / manifest.json 自身不在 files 列表——与 T4 实现的 envelopeFiles 过滤一致，若 T4 落地选择了别的过滤面则以此测试为合同对齐实现，测试先行即红。）
- [ ] **Step 3: 全门禁**：`pixi run pnpm -r test` + `pixi run pnpm --dir compiler exec playwright test`
- [ ] **Step 4: README runbook**——compiler/README.md 追加 `## web target (slice 2)` 段：CLI 用法（`--target web`）；产物构成表（8 文件）；measured bytes（web vendor dev/prod 实测记入，对照 wechat 49,868/17,451 表）；人眼档步骤（浏览器直开 `tests/out-web/index.html` + 容器 `pixi run cargo run -p omnilet-container -- --dir tests/out-web`）；deferred minor 登记：web v1 事件修饰符 `.stop` 静默丢弃（D22 Card 6，重开触发器 = 出现需 `.stop` 的 fixture → 编译期拒绝门或 tStop 行字段）；eval 结果通道重开触发器引用（"文字可读"红线）。
- [ ] **Step 5: 文档账（C3 同轮）**：status.md phase 行加 slice-2 green + 测试计数（fresh-run 实数）；next steps 勾掉 web/container 切片、留 winmac-wry / HMI-Renderer / compile-slice2 人眼档；mvp-checklist 若 B0 有 web 消费面行则补注（无则不动，不硬造）。spec 头部状态行补"implemented by plan 2026-10-26-slice2-web-container.md"（若有既定格式则遵循）。
- [ ] **Step 6: Commit** `test(compiler): web gate assembly (P1/P3/P4 web probes, structural tier) + README web runbook + docs closeout`

---

## Spec 覆盖映射（spec §1-§8 → 任务）

| spec 条目 | 任务 |
|---|---|
| §1.1 同源双目标（--target 唯一 delta） | T4（same-source.test.ts 红线 4 具名） |
| §1.2 浏览器行为档（Playwright 真 Chromium，非 jsdom） | T9（+T7 裸 vm 层） |
| §1.3 容器两腿判定（像素非空白 + DOM 探针） | T8（证明环）+ T9（闭环腿） |
| §1.4 桥存储往返（native 观测，禁 eval 返回） | T7（双模）+ T8（handler + store 轮询） |
| §1.5 微信回归红线（fresh-run + 零漂移） | 每任务门禁 + Global Constraints |
| §2 文件布局 / D15-4 和解（自包含 + minEngineVersion） | T3（信封）+ T8（validate_manifest_version） |
| §3 组件清单（NEW/MOD 全表） | T1-T9 Files 面 |
| §3.1 词表（4A 全宽） | T2（web.ts 全表） |
| §4 零新诊断码 + 降级语义 | T2/T3（复用 301/302/303/212）+ T7（probe once degrade once） |
| §5 验收矩阵（结构/行为双层） | T9（双层）+ T10（结构） |
| §5 红线 4/5 具名测试 | T4（same-source + 隔离 grep） |
| §6 风险（repaint 队列命名、Playwright 接线账、probe 时序） | T6（微任务队列）+ T9 Step 1 + T7（懒探测） |
| §7 deferred minors 折叠 | Global Constraints + T10 Step 4 |
| §8 重开触发器 | T10 Step 4/5 登记 |

## Plan Self-Review 记录

- **覆盖**：spec §1-§8 逐条映射上表 ✓；D22 六卡全落点（Card 1→T1、Card 2→T3/T8、Card 3→T3 css.ts、Card 4→T8/T9、Card 5→T9+T7、Card 6→T10 登记）✓
- **占位符扫描**：全部代码块可运行；T6 renderTemplate 的函数体在 Step 3 内补全为声明契约（测试先行的合法 RED 阶段形状，非 TBD）✓
- **类型一致**：`TableRow.forItem/forIndex`（T1 定义，T2 消费）✓；`emitManifestEnvelope`（T3 定义，T4 消费）✓；`buildVendor(mode, target)`（T6 定义，T4 引用注 明 T6 时同步）✓；`createPage(def, doc?, repaint?)`（T6 定义，T9 消费）✓；`storage.get/set` Promise 面（T7 定义，T9 localStorage 断言消费）✓；Rust `register_storage_handlers(&Path)` / `validate_manifest_version(&str, &str)`（T8 内自洽）✓
- **诊断码**：全计划新增诊断 = 0（301/302/303/212/401/402 复用）✓

## Spec-code reconciliation notes

1. **页面模板的交付通道**（spec §2 文件列表不含页面模板文件）：spec §2 的 web 包文件清单（index.html / pages/*/index.js|css / manifest.json / 两个侧车 / omnilet-runtime.js）是字节钉死的冻结面（golden + 结构探针），但 dom-adapter 需要 per-page 模板（data-if/data-for/data-key 重写后的 DOM 形状）。裁缝口：**模板内联进 shell**——`index.html` 每页一个 `<script type="text/omnilet-template" data-page="<name>">` 块（T3 emitHtml / T4 组装 / T6 vendor-entry 解析 / T10 结构探针 `data-page=` 断言）。理由：文件清单零扩（不新增 pages/*/index.html 产物文件）；无 fetch/CORS 面（file:// 与 omnilet:// 双协议都活——fetch 相对路径在 omnilet:// 自定义协议下需要 serving 面配合，内联完全绕开）；模板字节仍由 web golden 钉死（g-web-g100 的 index.html 含块内容）。代价：单文件 shell 变大——counter 量级无关紧要，多页大模板的重排是重开触发器级别的未来议题。
2. **splitDirective 行字段命名**（spec §0/§2 说 "item/index attr names from the row" 未钉标识符）：落为 `forItem` / `forIndex`（TableRow 可选 string，schema 同名镜像）。理由：与微信 `wx:for-item`/`wx:for-index` 语义一一对应、与现有 `t`/`wrap`/`exempt` 短行字段风格一致；缺省值 = 今日字面量，wechat 行显式写默认值后字节零变有既有 golden 背书。
3. **探测面细节**（spec §2 写 "`window.cefQuery`" 面而 D22 评审折入项已改 omnilet.storage 面）：以 spec §3/§4 的修订后谓词为准——`window.omnilet?.storage?.get === 'function' && window.cefQuery === 'function'` 双面同时为真才走桥（T7 实现与此一致）；与 spec §2 "runtime detects no window.cefQuery" 的简写不冲突（那是单面简述）。
4. **Rust handler 注册时机**（spec §3 说 "registration inside browser_router() get_or_init (race-free) or before first pump"）：落为 **load_offline_dir 时显式注册**（before-first-pump 路线）——store 根依赖 `--dir` 运行期参数，get_or_init 里拿不到；幂等性由 registry insert 覆盖语义保证，与两选一许可兼容。
