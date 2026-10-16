# 竞品档案：Chameleon（滴滴）——已归档的教训案例

> 数据核对日期：2026-10-16（GitHub API 实测）。**该仓库已 archived（实测 archived: true），最后推送 2023-01-07。** 本档案价值在于教训而非威胁。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | 滴滴（didi / chameleon-team） |
| 定位 | 自研 DSL（CML）的跨端框架："一套代码运行多端，一端所见即多端所见" |
| 仓库 | github.com/didi/chameleon |
| Stars | 8,940（实测 2026-10-16） |
| 活跃度 | **最后推送 2023-01-07，已 archived**，open issues 277 遗留无人处理；npm 实测：chameleon-tool 最新正式版 1.0.8（2020-11-13），此后仅一个 2.0.0-alpha.1（2020-12-24） |
| License | Apache-2.0 |
| 状态 | **死亡项目**（社区事实确认：无人接手维护，作者在 README 未标注但 archive 动作已明示） |

## 平台矩阵（README 实测）

web、微信/支付宝/百度/QQ/字节小程序、快应用、Android/iOS（weex 原生渲染，chameleon-sdk-android/ios）。

## 架构与编译原理

- **开发语言**：**自研 DSL（CML）**——类 Vue 的组件格式（.cml 文件：template/script/style 三段式），非复用既有框架语法。
- **核心理念**：**多态协议（polymorphic protocol）**——组件/API 层定义跨端标准接口，各端提供实现；"多端高度一致"为目标，同时保留各端差异化的多态扩展口。
- **编译管线**：自研编译器将 CML 编译到各端产物；native 端走 weex（NativeScript 时期产物，Vue 2 生态）。
- **愿景与 Taro/uni-app 的区别**：不满足于"兼容层"，试图**重新定义一套标准**（CML 即多端），让开发者彻底不感知端差异。

## 为什么死了（教训核心）

1. **自研 DSL 的生态冷启动失败**：要求开发者学习私有语法，却无法继承 Vue/React 现有生态与心智；同期 uni-app（Vue 语法）和 Taro（React 语法）用"零学习成本"吸走了全部增量用户。
2. **多态协议的双刃剑**：协议覆盖面永远追不上端差异的膨胀（字节/快手/鸿蒙接连出现），协议维护成本 > 适配收益；新端支持停滞。
3. **背后公司战略转移**：滴滴 2021 后出行主业收缩，跨端框架非核心，团队投入消失后项目即死。
4. **weex 底座衰老**：native 端绑定 weex，而 weex 自身已被 React Native/Flutter 边缘化，底座死则上层死。

## 对 OmniLet 的借鉴 / 影响（D4 + 产品双面警示）

1. **最大警示——OmniLet DSL 的生态宿命**：OmniLet 统一 DSL 与 CML 结构相似（自定义语法 + 跨端标准）。Chameleon 证明**纯自研 DSL 没有现存生态时必死**；OmniLet 的规避路径是白皮书已定的"统一 DSL/TS"——**TS 子集**策略（开发者用标准 TS，DSL 只约束视图层），必须坚守"TS 是主体、DSL 是糖"的边界，不可滑向"CML 式全新语言"。
2. **多态协议 vs IR 消解**：Chameleon 的运行时多态协议（各端各自实现）与 OmniLet 架构.md §④ 的编译期 IR 消解（#ifdef 不留产物）是同一问题的两种解法；Chameleon 的死证明**运行时协议维护成本高于编译期消解**——D4 选 AST/IR 管线时，"差异在编译期终结"是经竞品死亡验证的方向。
3. **底座依赖风险**：Chameleon 绑 weex 而死。OmniLet 容器引擎选型（D3 已定 Rust 自研，无 weex 类依赖）恰好免疫此风险；但小程序产物侧仍依赖各平台运行时，平台策略变化（如微信 API 断代）是持续风险，适配层需保持每平台独立可维护。
4. **教训入 D4 测试矩阵**：D4 若选自研 AST 管线，需回答 Chameleon 之问——"自研编译器换来了什么生态换不来的能力？"（OmniLet 的答案：Display List 二进制指令流是通用编译器给不了的，见 tech-whitepaper §5.3；此答案成立则自研有理，不成立则复用 Babel/SWC。）
5. **可借遗产（Apache-2.0）**：其多态协议的接口分类学（组件/API/生命周期三类差异）对 OmniLet 平台适配层的接口清单有文档参考价值；代码本体（Vue2/weex 时代）无复用价值。

## 来源

- GitHub API：didi/chameleon（stars/pushed_at/archived=true/license；2026-10-16 实测）
- README（平台矩阵、多态协议描述；2026-10-16 抓取）
- cml.js.org（文档站，多页面 404，与项目死亡状态一致）
- OmniLet 内部对照：docs/whitepaper.md §7、docs/architecture.md §④、docs/tech-whitepaper.md §5.3
