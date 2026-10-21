# 编译侧首切片设计 — 微信端到端薄切片（compile-slice-1）

> 日期：2026-10-21 | 状态：待用户审阅定稿
> 裁决依赖：D5（表驱动/内核换代/monorepo）、D9（文件覆写/类型即生成物）、D10-1/2（Vue 族词表/静态翻译）、D17（能力词命名）、D21 + 同日修订（引擎插座/混合词表/端差留位/库 API 入口/**拆标准文件形态**）
> 研究证据：docs/reference/dsl-design-space.md（九轴横评）+ mpx/glass-easel/kbone/remax 四档（SHA 源码级）

## 1. 目标与范围

**目标**：一个极薄样例工程（单页 counter：`view/text/button` + `v-if`/`v-for` + 一次 setData 交互；页面带一行 `ol:requires="storage"` 申报——不调用，仅验证 capability 分区汇入 manifest 行为）经编译产出**微信小程序包**，三层验收全绿（见 §6），勾 mvp-checklist A1 首块。

**明确不做**（后续切片各归各位）：
- Web / 自有容器目标（只加 `rules/web.ts` + codegen-web，管线复用）
- 自定义组件、路由/页面栈、worker、`ol:` 端差标记（D21 Card 2 触发器留位）
- CLI 体验完善（参数表非冻结）、报错 i18n、npm UI 组件互操作（D9-2 Phase 2）

**源码形态**（D21 修订版）：每页拆标准文件，无专属扩展名：

```
pages/index/{index.html, index.ts, index.css, index.json}  +  app.json
```

## 2. 编译管线（四站）

```
[1] 输入装配    目录扫描 → 同名配对；平台覆写消解（index.wechat.ts > index.ts）
[2] 建 IR       html 片段 → 模板 AST（复用 @vue/compiler 解析器，借词表送解析器）
                ts → TS AST；负面清单执行器就位
[3] 规则表改写  AST 过查表 visitor（表=纯数据，见 §3）
[4] 代码生成+装包 AST→wxml；TS→JS（仅类型剥除，Babel 换代缝在此）；
                css→wxss（omnilet- 前缀）；app.json 装配；注入数据路径清单
```

**工程红线（D21）**：死代码消除/覆写消解发生在 IR 层、**先于任何 Babel 降级**（mpx 的 regenerator 坑 = 顺序错了则 false 分支照样进包；不变量"产物零 #ifdef"是顺序保证）。

## 3. 规则表（首表七分区 + 定点原语）

原则：**表存映射事实，引擎持定点原语**（rename / wrapExpr / splitDirective / passthrough / drop / valueMap，首切片冻结 6 个）——browser-compat-tables + Babel preset-env 同型，不发明规则语言。

| 分区 | 内容 | 备注 |
|---|---|---|
| tagMap | view/text/button（+后续每组件一行） | **不在表里 = 不存在**（白名单哲学，表外即拒） |
| directiveMap | v-if/v-else/v-for | v-for 行含参数模式拆解（→wx:for/item/index） |
| eventMap | @tap→bindtap + bindtap 别名直通 | |
| exprWhitelist | 数据路径/运算/比较/三元/字面量 | 函数调用/赋值/await → error + 替代提示 |
| styleRules | rpx 直通 / omnilet- 前缀 / 选择器白名单 | D9 S-3 路由落点 |
| lifecycleMap | onLoad/onShow/onHide/onUnload/onLaunch | 微信原名直通（D21 3'） |
| capabilityRules | ol:requires → manifest 能力申报 | D17 词表校验 |

**golden 绑定**：每行带 `golden` 字段，正向卷（进 1 源文件，出产物字节比对）；**加行不加卷 = CI 红**。`rule-schema` 包持表的 JSON Schema；**schema 改动 = 全量 golden 重跑**（D5 裁决 4 的钩子在此兑现）。词表纪律：`v-` 与 `ol:` 分区交集非空 = 表加载即抛（编译器不启动，我们的表格烂了不让用户买单）。

## 4. 响应式插座（编译器视角）

编译器对引擎无感知：只生成门面词（`reactive/ref/computed/watch` from 'omnilet'）调用 + 编译期数据路径清单；运行期垫片按 flavor 插档（标准 = @vue/reactivity；lite = 最小信号集，后续切片）。**每档 API 删减表成文、越界编译期报错**（mpx defineProperty 删减是正例教材，静默阉割是反面）。

## 5. 错误处理（四原则）

1. **spec 负面三列表 = 报错话术源**（文档与编译器同源，改文档即改话术）
2. **编译期全量诊断**：整工程跑完再报；每条 = 位置 + 错误码（1xx 形态 / 2xx 白名单 / 3xx 表结构 / 4xx manifest）+ 替代写法；error 挡产物、warning 放行记录（仅 iframe→web-view 一行自动兜底）
3. **三种锅三种报法**：作者错→正常诊断；表配错→加载即抛；引擎崩→报"这是我们的 bug"+复现路径（入 pitfalls）
4. **话术有 golden**：负面卷 = 错样例 + 期望诊断文本，文案退化测试即红

报错语言：中文默认档，错误码留 i18n 钩子（MVP 不做英文面）。

## 6. 测试与验收

| 层 | 内容 | test-matrix 对应 |
|---|---|---|
| 单元 | 五积木各单测（vitest 直调，不起进程） | T1 |
| golden | 每规则行正向卷 + 负面话术卷 | T2 |
| 类型 | 生成 .d.ts 被 `tsc` 消费不报错（类型即生成物占位，D9 §6） | T1 |
| 结构档 | 产物形状校验（文件树/app.json/wxml lint） | T3 |
| 行为档 | miniprogram-simulate：counter 点击→断言更新 | T3 |
| 人眼档 | 微信开发者工具手工一次；README 声明"GUI 未在本机验证"（Linux 无官方工具） | T3 诚实注 |

**通过线**：三层考卷全绿 + 负面卷 ≥4（拼组件名/表达式调函数/model: 双向糖/表外标签）+ CI（vitest、schema 校验、golden 门）全绿 + 文档同步（dsl-spec 已 v0.2、status、SDD 按需）。

## 7. 积木与职责

| 单元 | 管 | 不管 |
|---|---|---|
| compiler/ingest/ | 配对、覆写消解 | 语法 |
| compiler/ir/ | AST 类型 + 查表 visitor 宿主 | 平台知识 |
| compiler/rules/wechat.ts | 首表（纯数据七分区） | 逻辑 |
| compiler/codegen/ | wxml/wxss/js/json 生成 + TS 类型剥除 | 源语法 |
| compiler/src/index.ts `compileProject()` | 四站编排（主入口，D21 Card 3）+ bin 薄壳 | 业务 |
| packages/rule-schema/ | 表格式合同（JSON Schema） | 内容 |

依赖单向：compileProject → ingest → ir(查 rules) → codegen；Web/容器切片将来只加表加 codegen，不动前站。

## 8. 重开条件登记（防口头翻案）

| 事项 | 重开触发器 |
|---|---|
| v-/ol: 混挂（2a） | 未来大版本重构有明确需求（用户附加条款，2026-10-21） |
| 属性维端差语法（D21 Card 2） | 文件复制漂移成本 > 语法引入成本（观察记档，触发即开卡） |
| CLI 参数表冻结 | 管线形状稳定后（切片 2+） |
| lite 信号集实现 | lite flavor 切片开工时（插座接口先行） |
