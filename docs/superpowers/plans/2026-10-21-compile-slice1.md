# compile-slice-1（微信端到端薄切片）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `compileProject()` 把极薄 counter 样例编译成微信开发者工具可开的包，三层机器验收全绿 + 四道门禁咬合探针各红过一次。

**Architecture:** 四站管线（ingest→IR→查表改写→codegen/装包），规则表=纯数据 + 6 定点原语 + 表内自认定点；@vue/reactivity 经 runtime 垫片 vendor-bundle 进产物（Component 式页面）；golden 逐表行字节比对，负面话术从表渲染。

**Tech Stack:** TypeScript + Node(≥22，pixi 环境)、@vue/compiler-dom、@babel/core(preset-typescript)、postcss、esbuild、ajv、vitest(+jsdom)、miniprogram-simulate、miniprogram-compiler、pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-10-21-compile-slice1-design.md`（v2，执行者与审查者都读它；本计划各任务隐含引用其 §2 红线、§6 验收、§8 重开条件）

## Global Constraints

- 一切命令经 `pixi run`（D11 单一环境源）；pnpm 走 `pixi run pnpm …`
- 依赖精确锁版（@vue/compiler-dom 升级 = 全量 golden 重跑触发，spec §7）；`pnpm-lock.yaml` 必入库（lockfile 纪律）
- 文件形态：每页拆 `index.html/ts/css/json` + `app.json`，无专属扩展名（D21 修订）
- 词表纪律：`v-` 与 `ol:` 分区交集非空 = 表加载抛（编译器拒启动）；golden 行缺卷 = 表加载抛
- 产物归一化（golden 前提）：LF、2 空格缩进、属性发射顺序固定、无时间戳/绝对路径
- 诊断家族号：1xx 形态负面 / 2xx 白名单越界 / 3xx 表结构 / 4xx manifest·D17；报错中文
- 每任务收尾：`pixi run pnpm -r test` 绿 + conventional commit；unwrap 纪律（测试内可用，src 禁 throw-without-Diag）
- IR-order 红线：覆写消解/死代码只在 IR 层，Babel 仅 `codegen/js.ts` 可 import（模块边界测试在 T12 装配探针组）

## File Structure

```
compiler/
├── package.json  vitest.config.ts  tsconfig.json          (T0)
├── src/
│   ├── types.ts          Diag / PageUnit / TableSet / GoldenRef 共享类型   (T2)
│   ├── tables.ts         表加载 + 三闸（schema/缺卷/交集）                 (T5)
│   ├── ingest.ts         同名配对 + 覆写选择 + ol:requires 收集            (T6)
│   ├── ir.ts             模板 AST（@vue/compiler-dom, 锁 parse 选项）+ 金丝雀卷 (T7)
│   ├── rewrite.ts        查表 visitor + 6 原语 + 2 自认定点 + 白名单校验   (T8,T9)
│   ├── codegen/
│   │   ├── wxml.ts  wxss.ts  js.ts  appjson.ts  manifest.ts  dts.ts       (T10)
│   ├── vendor.ts         esbuild 打包 runtime → 产物 vendor/              (T11)
│   ├── compileProject.ts 五站编排 + 全量诊断聚合                          (T10)
│   └── cli.ts            bin 薄壳（参数非冻结，spec §8）                  (T10)
│   └── diag.ts           Diag 渲染 + 负面条目（话术数据）+ 期望文本渲染器  (T4)
├── rules/wechat.ts       首表（七分区，逐任务加行+填卷）                   (T5-T10)
├── runtime/wechat/
│   ├── facade.ts  adapter.ts  vendor-entry.ts  门面词 from 'omnilet'      (T11)
├── tests/
│   ├── fixtures/counter/            样例工程（所有 golden 的共同输入）      (T3)
│   ├── golden/<gNNN>/…              每表行一卷（正卷=产物文件组；负卷=源+期望诊断渲染）
│   ├── golden-harness.ts            checkRowCoverage / compareGolden / renderExpect
│   └── *.test.ts                    各单元卷
packages/rule-schema/
├── schema/table.schema.json          表 JSON Schema                       (T2)
├── capabilities.json                 storage 起步的唯一词表               (T2)
└── NORMALIZATION.md                  归一化规范（golden 字节合同）         (T2)
```

---

### Task 0: 环境、依赖与锁文件纪律

**Files:**
- Modify: `compiler/package.json`（deps/devDeps/scripts）
- Create: `compiler/vitest.config.ts`、`compiler/tsconfig.json`、`pnpm-workspace.yaml` 校验
- Delete（若 tracked）: 根 `package-lock.json`（npm 残留，pnpm workspace 的冲突源——spec §7 杂项债）

**Interfaces:**
- Produces: 可运行的 `pixi run pnpm -r test`（vitest 全绿）；后续任务 `import { parse, transform } from '@vue/compiler-dom'` 等全部依赖就位

- [ ] **Step 1: 盘点现状**：`git ls-files package-lock.json` 与 `pixi run pnpm -v`；若 package-lock.json tracked → `git rm package-lock.json && rm -rf node_modules`（保留 .pnpm store）；提交此删除 `chore: retire npm lock in favor of pnpm workspace`
- [ ] **Step 2: 连通探针（spec §7 前置）**：`pixi run pnpm install --dir compiler` 先装 1 个新包 `@vue/compiler-dom`，记录所用 registry/代理路由（无 `.npmrc` 时经系统代理——把结论写进 `compiler/README.md` 一段，镜像策略后续切片再议）
- [ ] **Step 3: 依赖清单一次装齐并锁版**：deps = `@vue/compiler-dom @babel/core @babel/preset-typescript postcss esbuild ajv`；devDeps = `typescript vitest jsdom miniprogram-simulate miniprogram-compiler @types/node`；版本以 install 结果 `pnpm list --depth=0` 写 exact pin 回 package.json
- [ ] **Step 4: vitest 配置**：`test.environment='node'`，`testTimeout=20000`（simulate 用例会要 jsdom，per-file `// @vitest-environment jsdom` 标注，不全局开）
- [ ] **Step 5: 冒烟**：`compiler/src/smoke.test.ts` 保留；`pixi run pnpm -r test` 全绿；`pnpm-lock.yaml` 出现
- [ ] **Step 6: Commit** `chore(compiler): pin toolchain deps for slice-1 (proxy install measured, lockfile committed)`

### Task 1: simulate spike（30 分钟，行为档形状定形）

**Files:**
- Create: `/tmp/omnilet-sim-spike/`（一次性，不入库）+ `compiler/README.md` 追加一段结论
- [ ] **Step 1:** 手写一个最小 Component 式微信页面产物（wxml+js+json，counter 逻辑手工写）
- [ ] **Step 2:** `simulate.load(路径, dom)` 跑通：断言初始文本 `0`，`triggerEvent` 或直接调 handler 后文本 `1`
- [ ] **Step 3:** 同法试 page 形态（`index.js = Page({...})`）——记录 load 是否真要求 Component 签名
- [ ] **Step 4: 结论成文**（README.md：行为档最终形状=Component 式 or 两者皆可；jsdom 所需 API 面）→ commit `docs(compiler): simulate spike verdict (behavior tier shape decided by measurement)`

### Task 2: 表合同 + 能力词表 + 归一化规范（rule-schema 包）

**Files:**
- Create: `packages/rule-schema/schema/table.schema.json`、`packages/rule-schema/capabilities.json`、`packages/rule-schema/NORMALIZATION.md`、`packages/rule-schema/src/schema.test.ts`（扩展）
- Create: `compiler/src/types.ts`

**Interfaces:**
- Produces:
  - `type Diag = { code: number; message: string; hint: string; loc?: { file: string; line: number; col: number } }`（code=1xx-4xx 家族）
  - `type TableRow = { kind: string; s: string; t?: string; primitive?: 'rename'|'wrapExpr'|'splitDirective'|'keyTransform'|'valueMap'|'passthrough'|'classPrefix'|'lifecyclePassthrough'; golden: string }`
  - `loadCapabilities(): string[]`（读 capabilities.json；T5/T9/T10 消费）
  - `assertNormalized(text: string): void`（行尾 LF/无 CRLF、2 空格缩进步进、无绝对路径正则 `/home/|/tmp/`）——golden 比对前置检查
- [ ] **Step 1:** 写 `schema.test.ts` 失败测试：capabilities.json 含 `"storage"`；table.schema.json 要求每行必有 `golden: string(minLength 1)` 且 primitive 枚举=上述 8 值；`types.ts` 尚不存在 → TS 编译失败即红
- [ ] **Step 2:** 实现 schema + capabilities + types.ts 使绿（`pixi run pnpm -r test`）
- [ ] **Step 3:** NORMALIZATION.md：LF、2 空格、wxml 属性序=表序驱动固定、禁时间戳/绝对路径；`assertNormalized` 按此实现并测（含一条故意 CRLF 输入必红的自证用例）
- [ ] **Step 4:** Commit `feat(rule-schema): table contract, capability vocab source, golden normalization spec`

### Task 3: counter 样例 fixture（共同输入）

**Files:**
- Create: `compiler/tests/fixtures/counter/app.json`、`pages/index/index.{html,ts,css,json}`、`app.ts`

**Interfaces:**
- Produces: 唯一输入基准——**内容一次定稿**（golden 全部由它派生；改动样例=改全量卷，需 R3 登记）：
```
index.html:  <view v-if="ready" ol:requires="storage"><text>{{ count }}</text>
               <view v-for="(item, idx) in list" :key="idx"><text>{{ item }}</text></view>
               <button @tap="inc">+1</button></view>
index.ts:    import { reactive } from 'omnilet'
             const state = reactive({ ready: true, count: 0, list: ['a','b'] })
             export default { state, methods: { inc() { state.count++ } }, onLoad() {} }
index.css:   .box { color: #333; padding: 10rpx; }
index.json:  { "navigationBarTitleText": "counter" }
app.json:    { "pages": ["pages/index/index"] }
```
- [ ] **Step 1:** 按上表创建（`{{ }}` 内表达式白名单、`:key` 语义均已在 dsl-spec v0.3）
- [ ] **Step 2:** 无测试；commit `test(compiler): counter fixture frozen as golden input baseline`

### Task 4: 诊断与负面条目（话术=数据）

**Files:** Create `compiler/src/diag.ts`、`compiler/src/diag.test.ts`

**Interfaces:**
- Produces: `NEGATIVE_ENTRIES: NegativeEntry[]`（与 dsl-spec §2 表**逐 id 对应**，测试硬编码 id 清单并注明同步义务=spec §2）；`renderExpect(id): string`（期望话术从条目渲染，T9 负卷用）；`diag(code, …)` 构造器
- [ ] **Step 1:** 失败测试：`expect(NEGATIVE_ENTRIES.map(e=>e.id)).toEqual(['dynamic-component','func-macro','dynamic-include','iframe','model-sugar','class-obj','vfor-proto','ts-unerasurable','handler-form'])`（9 条含 v0.3 新增 6 行）；`renderExpect('model-sugar')` 含"替代"+"state"
- [ ] **Step 2:** 实现条目表（id/family/hint 逐条抄 dsl-spec §2 的"原因/替代写法"两列）
- [ ] **Step 3:** 变异自证：测试内临时改一条 hint → `renderExpect` 输出变化（证明话术是表渲染非硬编码双源）
- [ ] **Step 4:** Commit `feat(compiler): negative entries as data, error copy rendered from table (+mutation self-proof)`

### Task 5: 表加载三闸（tables.ts）

**Files:** Create `compiler/src/tables.ts`、`tables.test.ts`、`compiler/rules/wechat.ts`（初版 tagMap 3 行 + golden 目录占位真实卷）

**Interfaces:**
- Produces: `loadTables(rulesDir, goldenRoot): TableSet`——依次跑 **schema 校验(ajv) → 逐行 golden 目录存在性 → v-/ol: 词表交集** ，任一失败 `throw TableGateError`；TableSet={ tagMap[], … 七区 }
- [ ] **Step 1:** 失败测试×3：加一行 golden 指向不存在目录 → 抛"缺卷"；ol:/v- 同名行 → 抛"交集"；非法行（primitive 不在枚举）→ 抛"schema"
- [ ] **Step 2:** 实现三闸 + 首表 tagMap 三行（view/text/button→同名 passthrough，golden g001-g003——卷内容 = **rewrite 层 outAst 归一化文本**（进 `<text>x</text>`，出改写后 AST 序列化），与 T8/T9 同形，后续任务只加行不重写）
- [ ] **Step 3:** 门禁咬合记录：三闸各自植入违规探针红一次（写进 tables.test.ts 用例名，永久回归）
- [ ] **Step 4:** Commit `feat(compiler): table loader with 3 load-time gates, each probe-proven red-once`

### Task 6: ingest（配对/覆写选择/申报收集）

**Files:** Create `compiler/src/ingest.ts`、`ingest.test.ts`

**Interfaces:**
- Produces: `ingest(root): { pages: PageUnit[], app: AppUnit }`；`PageUnit={ name, html, ts, css, json, requires: string[] }`（`index.<platform>.* > index.*` 选择；requires=扫 html 根元素 `ol:requires`）
- [ ] **Step 1:** 失败测试：fixture 目录 → 1 页 4 件配对；覆写 `index.wechat.ts` 存在时选它；requires=['storage']
- [ ] **Step 2:** 实现（覆写=配对选择，红线 1 的前半；深消解在 T8 的 IR 区声明）
- [ ] **Step 3:** Commit

### Task 7: ir（模板 AST + 选项锁 + 金丝雀）

**Files:** Create `compiler/src/ir.ts`、`ir.test.ts`

**Interfaces:**
- Produces: `buildTemplateAst(html): { ast, diagnostics }`——`@vue/compiler-dom` parse+transform（`{ whitespace:'condense', comments:false }` 锁死，注释写明"AST 形状的前提条件"）；onError → 1xx Diag；导出 `AstCanary` 测试用节点摘要
- [ ] **Step 1:** 失败测试：fixture html 解析出 5 节点骨架 + v-if/v-for/v-on 指令节点在位；`<view <!--x-->` 注释被关（comments:false）；语法错 → 1xx 诊断非 throw
- [ ] **Step 2:** 实现
- [ ] **Step 3:** 金丝雀卷：把节点摘要序列化成 `tests/canary/ast-shape.json`，测试比对（@vue/compiler 升级 → 此卷变红 = §7 触发器的机器化）
- [ ] **Step 4:** Commit

### Task 8: rewrite 核心（visitor + 6 原语 + 白名单校验）

**Files:** Create `compiler/src/rewrite.ts`、`rewrite.test.ts`；Modify `rules/wechat.ts`（directiveMap/eventMap/lifecycleMap/exprWhitelist/styleRules/capabilityRules 行 + 逐行金卷）

**Interfaces:**
- Produces: `rewrite(ast, tables): { outAst, paths: string[], diagnostics }`；原语实现 `PRIMITIVES: Record<PrimName, fn>`；`validateExpr(node, whitelist): Diag[]`（枚举 vue 表达式 AST 节点类型 vs `allow` 集——`?.`/`??`/函数调用不在 allow → 2xx，hint 取自 diag 表）；`:key`→`wx:key` 走 keyTransform
- [ ] **Step 1:** 按原语逐个立卷（worked example 附录进测试注释）：`rename v-if→wx:if`；`wrapExpr` 属性粒度（`{{ ready }}` 包 vs `wx:for` 裸列表）；`splitDirective (item,idx) in list → wx:for+wx:for-item+wx:for-index`（`:of`/三元上界 → 2xx）；`keyTransform :key→wx:key`；`valueMap @tap.stop→catchtap`；`passthrough view`；表外标签 → 拒（tagMap 白名单哲学）
- [ ] **Step 2:** 实现各原语 + `paths` 收集（模板引用路径清单——spec §4 切片 1 定义）
- [ ] **Step 3:** 每加一行表 → 同时落 `tests/golden/gNNN/`（进=fixture 片段，出=outAst 序列化归一化文本）
- [ ] **Step 4:** Commit（可拆两笔：原语+指令区 / 校验区）

### Task 9: rewrite 收尾（classPrefix + 事件 + 全表逐行金卷升级）

**Files:** Modify `rewrite.ts`（classPrefix 定点：模板 class 值改写与 wxss 前缀**同源词表**）；Modify `rules/wechat.ts`（@tap 事件行、lifecycle 直通、capabilityRules storage 行）；Create `rewrite.negative.test.ts`

**Interfaces:**
- Produces: `classPrefix(value, tables): string`（`box`→`omnilet-box`，表内词免加）；负卷期望文本 = `renderExpect(id)`（T4 同源）
- [ ] **Step 1:** 负卷 4+（1xx/2xx/3xx 三段）：`model:`/`:class="{a:true}"`/`v-for 三元上界`/`enum TS`/`@tap="a+b"` → 各 code 家族命中 + 期望话术 diff；**4xx 负卷随 manifest 校验器在 T10 落地；矩阵 1xx-4xx 全段断言集中在 T12**
- [ ] **Step 2:** 实现 + classPrefix/事件/lifecycle/capability 行金卷
- [ ] **Step 3:** dsl-spec §2 表 ↔ NEGATIVE_ENTRIES 一致性测试（id 清单同源断言）
- [ ] **Step 4:** Commit

### Task 10: codegen 全家族 + compileProject + CLI + 结构档

**Files:** Create `codegen/{wxml,wxss,js,appjson,manifest,dts}.ts`、`compileProject.ts`、`cli.ts`、`codegen.test.ts`、`structure.test.ts`；Modify `rules/wechat.ts`（g001-g003 占位卷→全链卷）

**Interfaces:**
- Produces: `compileProject({root,outDir,target:'wechat',mode:'dev'|'prod'}): Promise<{ok, diagnostics, artifacts}>`；`emitWxml`（属性序=表驱动固定+归一化 assertNormalized）、`emitWxss`（postcss：前缀+rpx 透传+选择器白名单拒 2xx）、`emitJs`（babel preset-typescript **仅剥型**；enum/namespace 命中→diag 表行而非 babel 崩）、`mergeAppJson`（作者透传+生成注入，冲突=error）、`emitManifest`（`omnilet.manifest.json` sidecar，requires 汇总+D17 词表校验 4xx）、`emitDts`（门面 .d.ts 模板串）
- [ ] **Step 1:** 失败测试：counter 全链 → 产物六文件快照（golden 目录）+ `structure.test.ts`：文件树清单断言 + app.json ajv 校 + `miniprogram-compiler` wxml parse 不报错 + `grep 零 #ifdef` 断言 + `tsc --noEmit` 吃 emitDts 的 .d.ts
- [ ] **Step 2:** 实现（Babel 只准住 `js.ts`——import 扫描断言：其他 src 文件不得 import @babel/*；写进 codegen.test）
- [ ] **Step 3:** CLI 薄壳 `omnilet build --dir --out`（转发+exit code），参数表 README 标"非冻结（§8 触发器）"
- [ ] **Step 4:** 全链 golden 重录（含 .js 的 Component() 包裹形态——按 T1 判定），commit `feat(compiler): end-to-end wechat build, structural tier green`

### Task 11: runtime 垫片 + vendor bundle + 行为档

**Files:** Create `runtime/wechat/{facade,adapter,vendor-entry}.ts`、`vendor.ts`、`behavior.test.ts`（jsdom）

**Interfaces:**
- Produces: `facade.ts` = `reactive/ref/computed/watch`（@vue/reactivity 转口 + 三原语 observe/write/flush 接线，**文件顶注引用 dsl-spec §10**）；`adapter.ts` = Component 配置生成 + 路径清单驱动 setData（只发脏路径）；`buildVendor(): {vendorJs, map}`（esbuild bundle IIFE，minify 仅 prod）；产物注入 `require('./vendor.js')` 或全局挂载行（按 T1 结论）
- [ ] **Step 1:** 失败行为卷：`compileProject(fixture)` → `simulate.load(page路径, jsdom)` → 初始 `0` → 触发 inc → 断言 `1`、`echoed 键`——**跑的是编译产物本体不是手摆物**（test-matrix T2 行兑现）
- [ ] **Step 2:** 实现 facade+adapter+vendor；wxml 事件绑定对 Component 的方法引用路径按 T1 结论对齐
- [ ] **Step 3:** 包体记录：vendor 体积数字写进 `compiler/README.md`（对照 uni-app 177KB 基线，spec §7 内部证据——无回归红线但留观测值）
- [ ] **Step 4:** Commit `feat(runtime): wechat facade shim vendored; behavior tier on compiled artifact green (jsdom)`

### Task 12: 门禁总装 + 文档收尾

**Files:** Modify `compiler/tests/gates.test.ts`（新建）、本计划勾选、`docs/mvp-checklist.md`、`.agents/memorys/status.md`

- [ ] **Step 1:** 四探针总装（每条都是"故意破坏必红"回归用例，永久化）：缺卷探针 / 话术变异探针 / 词表交集探针 / **DCE-before-Babel 探针**（dead `v-if` 分支塞 async → 产物无 regenerator 且模块边界断言在 T10 已有）
- [ ] **Step 2:** `pixi run pnpm -r test` 全量绿；README 编译侧使用说明（人眼档步骤："Windows/Mac 开发者工具打开 compiler/tests/out/ 验 1，A1 一级勾选挂此"）
- [ ] **Step 3:** 文档账：mvp-checklist A1 行注"二级首块完成/一级 pending 人眼档"；status.md phase-4 行翻 done-slice1；spec 头"待终审"→"已定稿"
- [ ] **Step 4:** Commit + 汇报通过线（含诚实注：行为档=simulate 保真声明 ≠ 真机；人眼档 pending）

---

## 验收映射（spec §6 → 任务）

| 档 | 任务 |
|---|---|
| 单元/golden/类型 T1 | T2-T9、T10 |
| 结构档 T2 | T10 |
| 行为档 T2 | T11 |
| 人眼档 T4 pending | T12 文档化，人工动作 |

## Plan Self-Review 记录

- 覆盖：spec §1-§9 逐节可指任务（§2 红线→T6/T8/T10/T12；§3 机制→T2/T5/T8；§4→T11；§5→T4/T9；§7 依赖→T0；§8 触发器→README/T12）✓
- 占位符扫描：T3 fixture 定稿内容全文给出；负卷 id 清单给出；余为骨架+精确断言 ✓（emitDts 模板串内容在 T10 Step2 允许按门面词表自拟——词表本身是 T2/§10 冻结源）
- 类型一致：`Diag/PageUnit/TableSet/PrimName` 定义于 T2/T5/T7/T8/T10，后续签名引用一致 ✓
