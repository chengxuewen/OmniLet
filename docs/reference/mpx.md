# 竞品档案：mpx（滴滴）

> 快照日期：2026-10-21。证据：浅克隆 `didi/mpx` @ **87341c50e4a4**（HEAD 2026-10-19）+ 仓库内 `docs-vitepress` 实读 + `packages/core/src` 文件树实测。凡标 *UNCERTAIN* 者使用前必须复核。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | 滴滴（didi org） |
| 定位 | Vue 语法族的增强型小程序框架 + 跨端输出（mp/Web/RN：iOS/Android/Harmony）；v2.11 主线 = RN 输出 |
| 活跃度 | HEAD 2026-10-19（高活跃）；13 包 pnpm monorepo + `legacy/`（mpvue 时代遗留） |
| License | MIT *UNCERTAIN*（本轮未核 LICENSE 正文） |
| 核心语言 | packages/core/src 全 `.js`（非 TS 主体） |
| 工程实践 | **仓库自带 `.agents/skills/`（mpx2rn）与 `solutions/mpx-capability-matrix.md`**——框架方给 AI agent 写技能文档、能力矩阵作对外契约 |

## 架构与原理（只留 OmniLet 相关轴）

1. **响应式引擎 = MobX，不是 Vue reactivity**（`understand/runtime.md` 原文"引入了 MobX……接管了小程序 setData 的数据响应开发框架"）。**Vue 式语法与 Vue 响应式是两个独立轴**——mpx 是活的反例证明。
2. **setData 双优化**：静态模板编译成 render 函数 → 依赖收集 → 仅依赖变更触发、异步队列**每 tick 最多一次 setData**；编译期记录模板用到的数据路径 → 运行时沿路径 diff，只传变更路径。"模板声明数据依赖清单"= 表驱动编译器的直接蓝本。
3. **四维条件编译**（`cross-platform/conditional.md`）：文件后缀（`.ali.mpx`）/ 区块（`src-mode`）/ 代码（`__mpx_mode__`）/ **属性维度（`@mode` 与 `|` 语法，专治组件 API 端差，如 button open-type 微信 getUserInfo vs 支付宝 getAuthorize）**。10 个 mode：wx/ali/swan/qq/tt/jd/web/ios/android/harmony。
4. **`srcMode` 与 `mode` 分离**：输出目标 ≠ 源码方言——允许同一文件混写多种宿主方言，转换管线不自缠绕。"单源 vs 每端方言"之争的第三种答案。
5. **可选链靠编译期降级到 WXS 函数调用**——表达力被宿主语言封顶的实例。
6. **无 CSS scoped**：全局 WXSS + `style src` 构建期去重（官方警告 `@import`+lang 会重复打包膨胀）；RN 输出进一步收窄到**仅类选择器**。
7. **TS 故事 = 无 .d.ts 自动生成**：手写 `types.d.ts` + `createStoreWithThis` 等**反推辅助 API 变体**（官方承认"ts 本身的能力限制"迫使运行时加变体）；需 TS>=4.1.3 + 专属 VSCode 插件。
8. **静态编译的暗坑**：async/await 被 babel 编成 regenerator switch 后**破坏死代码消除**，条件编译的 false 分支仍被打包——官方文档化绕行（if 块包 await / 改 Promise）。静态路线的坑不在方向在 AST 层之下的降级物。
9. **api-proxy 统一 API 面**：庞大的跨端 API 代理包（base/device/network/canvas 全分类）——UI 之外 API 一致也靠一层代理收敛。

## 优势

- setData 优化完整工程化且有数据流图文档；四维条件编译的属性维度独一份；分包资源去重 5 规则成熟（npm 进分包）；活跃且生产背书（滴滴系）

## 局限

- MobX 引擎 = 与 Vue 生态（hooks/computed 语义）有裂口（pinia 要独立包）；无 scoped 靠纪律；mixin 变体文件爆炸（约 20 个 mixin × 平台后缀）；全仓 grep **代码中无 glass-easel 适配层**（*UNCERTAIN* 兼容性状态——但其只依赖 `setData` 契约与宿主组件框架换代解耦，架构上免疫）

## 对 OmniLet 的借鉴

1. **语法族与响应式实现解耦声明**（→ dsl-spec/JS 引擎）：D10 选 Vue 语法不绑死 `@vue/reactivity`；把两轴写成正交决策，lite flavor（rquickjs）下 MobX 式最小核心是合法候选。
2. **模板声明数据依赖清单进编译期**（→ 编译引擎）：render-fn 依赖收集 + 每 tick 一次 + 路径 diff 三件套直接对齐 OmniLet StructuredChannel 的批量/合并策略（D15-2 同源）。
3. **属性维度 `@mode` 纳入 DSL 观察清单**（→ dsl-spec）：OmniLet 多端组件 API 端差必然出现，mpx 属性语法是现成最省解；首切片不做，spec 留位。
4. **srcMode/mode 双轴概念**（→ 编译引擎）：若允许原生方言手写混入，转换管线必须先分这两轴再谈规则表。
5. **regenerator 破静态消除的坑**（→ 编译引擎）：dead-code 要在 babel 降级**之前**的 IR 层做（OmniLet"产物零 #ifdef"不变量2的同一纪律，竞品坑实证）。
6. **能力矩阵 + agent skills 机器可读**（→ 工程实践）：对照 `.agents/` 体系直接执行。

## 不借鉴

- mixin 平台后缀文件范式（编译期表驱动替代）；不背 WXS 兜底；不做 `WithThis` 变体 API（生成真类型）。

## 来源

- mpx @ 87341c50e4a4：`docs-vitepress/guide/understand/runtime.md`（MobX+双优化原文）、`guide/cross-platform/conditional.md`（四维+srcMode 原文）、`guide/basic/data-binding.md`（?.→WXS 降级）、`guide/basic/css.md`（无 scoped 警告）、`guide/advance/ts.md`（WithThis 承认原文）、`packages/api-proxy/` 文件树、`.agents/skills/` + `solutions/mpx-capability-matrix.md`
- OmniLet 对照：docs/dsl-spec.md §5（文件覆写=其文件维度同型）；docs/architecture.md 不变量2
