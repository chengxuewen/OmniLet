# 竞品档案：glass-easel（微信官方）

> 快照日期：2026-10-21。证据：浅克隆 `wechat-miniprogram/glass-easel` @ **574460cf10b9**（HEAD = PR #309 `feat-property-override`，2026-10-20 合并）+ 仓库内 `guide/zh_CN` 48 篇官方文档 + `glass-easel-template-compiler/src/parse/expr.rs` 源码实读；辅证 `wechat-miniprogram/computed` @ `8de89bc10a71`、`alibaba/ice` 类型 grep。凡标 *UNCERTAIN* 者使用前必须复核。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | 微信官方（wechat-miniprogram org） |
| 定位 | **多后端组件框架运行时**——基础库组件层 exparser 的后继（自述 "the new component-based framework for WeChat MiniProgram"） |
| 活跃度 | HEAD 2026-10-20（当日推进）；8 包 monorepo 统一发布脚本 |
| License | MIT |
| 关键构成 | 运行时 TS + **模板编译器 Rust**（`glass-easel-template-compiler`，含 `cbinding.rs`）+ 样式编译器（作用域前缀注入）+ 宿主 adapter + webpack 插件 + shadow-sync |
| 生态渗透 | alibaba/ice 已把 `componentFramework: 'exparser' | 'glass-easel'` 做成配置项（ice `packages/miniapp-runtime/src/types.ts` L129/L507 实测）——第三方框架按"两代组件框架并存"设计 |

## 架构与原理（只留 OmniLet 相关轴）

1. **三后端协议**（最大差异化）：Composed（易用首选）/ Shadow（性能最优、协议复杂）/ DOM-like（浏览器适配）。框架本体与渲染环境解耦——与 OmniLet"编译期多端 + 运行时容器"的分离哲学同构。代价：async 接口在协议层统一退化为回调且不保证调用顺序。
2. **表达式 = 封闭白名单 AST**：`parse/expr.rs` 的 `Expression` 是显式枚举（ScopeRef/DataField/ToStringWithoutUndefined/LitUndefined/LitNull…），模板不做通用 JS 求值；复杂逻辑靠 `<wxs/>` 脚本模块兜底。**微信官方自己走的就是"模板能力有界 + 静态可枚举"路线**——OmniLet 负面清单（dsl-spec §2）的官方同型先例。
3. **同步 setData**：数据变更与界面更新同调用栈完成（官方原文）；连续 setData = 多次渲染，批处理是用户显式责任（`updateData`/`applyDataUpdates`/`groupUpdates` + 高级路径 API `replaceDataOnPath`/`spliceArrayDataOnPath`）。
4. **slot 三级性能梯度**：单 slot（默认、优化最足）→ `multipleSlots`（**官方警告：激活即禁用部分优化**）→ `dynamicSlots`（列表内重复 slot + 传数据，创建语义改变）。插槽自由度不是开关是性能阶梯。
5. **样式默认共享、opt-in 隔离**：与 Vue scoped 相反——默认全局泄漏，隔离靠构建期前缀注入 + 注册 `styleScope`；另有 `extraStyleScope`（隔离+全局混用出口）、`inheritStyleScope`。
6. **模板引擎可插拔**：`TemplateEngine → Template → TemplateInstance(initValues/updateValues)` 三层接口；官方示例用自定义引擎实现了 root-portal 和 JSX-render 接入，并诚实提示生产需自实现 VNode diff。

## 优势

- 多后端协议抽象的**唯一开源生产先例**；Rust 模板编译器证明"表达式白名单 AST"工程可行
- 同步语义可推理、可调试；高级路径 setData API 把性能主动权交给框架作者
- 官方且活跃，48 篇结构化文档即设计说明书

## 局限

- 三后端 = 三倍实现面；仅中文文档；slot 多槽掉优化；默认样式泄漏心智与 Vue 生态相反
- 双轨分裂期（exparser/glass-easel 并存），下游框架被迫做兼容分支

## 对 OmniLet 的借鉴

1. **白名单表达式 AST 直接进编译引擎设计**（→ 编译引擎）：表驱动编译器生成枚举 AST 而非通用求值器——安全、静态可分析、跨目标复用；模板内任意 JS 是负面清单要挡的东西，glass-easel 证明官方也这么裁。
2. **同步 setData + 显式批处理 API 形状**（→ omnilet-channel / IPC 契约）：OmniLet 双线程模型同理；批处理 API（分组更新/路径替换）值得进 channel 合同面。
3. **TemplateEngine 三层接口形状**（→ omnilet-render contract）：与 render trait 十法冻结互补——"模板语义"与"渲染后端"的最小解耦形状可借鉴。
4. **slot 性能梯度要文档化**（→ dsl-spec/web-view 议题）：若 OmniLet 支持多 slot，"默认单槽最优"要写进规格，避免用户无感付出。
5. **样式默认共享可行但必须留混用出口**（→ 样式规则表）：`extraStyleScope` 式设计系统复用出口要预留。

## 不借鉴

- 不做三后端同步落地（先易用档，性能档留接口）；不背 WXS 兜底（OmniLet script 层 rquickjs 无宿主语言约束）；默认样式策略跟自家容器走隔离（非微信平台包袱）。

## 来源

- glass-easel @ 574460cf10b9：`src/backend/*_protocol.ts`（三协议）、`glass-easel-template-compiler/src/parse/expr.rs`（AST 枚举）、`guide/zh_CN/basic/thinking.md`（同步 setData/Shadow Tree 原文）、`data_management/advanced_update.md`、`interaction/slot.md`（multipleSlots 警告原文）、`styling/style_isolation.md`（默认共享原文）、`advanced/template_engine.md`
- computed @ 8de89bc10a71（behavior 形式补 computed/watch；v4.0.0 改名基本接口 = 迁移破坏样本）
- OmniLet 对照：docs/tech-whitepaper.md §3；docs/architecture.md 不变量3
