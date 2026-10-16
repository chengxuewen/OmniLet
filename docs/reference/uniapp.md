# 竞品档案：uni-app（DCloud）

> 数据核对日期：2026-10-16（GitHub API 实测 + 官网）。OmniLet 白皮书 §7 对比表中 "Taro / uni-app" 档的 uni-app 侧依据。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | DCloud（数字天堂） |
| 定位 | 基于 Vue.js 的跨端框架：一套代码编译到 App / Web / 各家小程序 |
| 仓库 | github.com/dcloudio/uni-app |
| Stars | 41,615（实测 2026-10-16） |
| 活跃度 | pushed_at 2026-10-16（当日仍在推送，高活跃）；npm 实测：latest 2.0.2-5020620260917001（2026-09-17 版号），alpha 线 2026-10-16 当日仍在发版（持续发版节奏）；正式 release 无 GitHub Releases 页（发布走 HBuilderX/npm 渠道） |
| License | Apache-2.0 |
| 生态规模 | 官方宣称 900 万开发者、数百万应用（DCloud 自述，未见第三方核实）；插件市场数千款插件 |
| 商业模式 | 框架免费 + uniCloud 云服务 / uni-ad 广告等增值闭环 |

## 平台矩阵（官网实测）

- **App**：Android / iOS（uni-app 走 WebView+原生增强；**uni-app x** 走 uts 语言编译为 Kotlin/Swift 原生）
- **Web**：响应式 H5
- **小程序**：微信 / 支付宝 / 百度 / 抖音 / 飞书 / QQ / 快手 / 钉钉 / 淘宝 / 京东 / 小红书
- **其他**：快应用、鸿蒙 Next（uni-app 与 uni-app x 两条线）、鸿蒙元服务

## 架构与编译原理

- **开发语言**：Vue 2 / Vue 3 SFC 语法（非自有 DSL——这是它与 chameleon 的本质区别：复用既有生态语法）。
- **编译管线**：Vue3 项目走 Vite + 官方 vue 编译器；产物为各小程序平台的 WXML/WXSS/JS，或 H5 bundle，或 App 资源。
- **平台差异处理**：条件编译（`#ifdef MP-WEIXIN` 等注释标记）+ 每平台运行时 API 垫片（uni.xxx API 各端实现）。
- **App 端运行时**：经典 uni-app = WebView 渲染 + nvue（weex）原生渲染可选；**uni-app x** = uts 编译为原生代码，无 JS 引擎，渲染为原生 UI。
- **无自有容器**：小程序端完全依赖目标平台运行；App 端依赖 HBuilderX 打包壳。

## 优势（Pros）

1. **生态第一**：小程序跨端框架事实标准，插件市场/问答社区/HBuilderX 工具链完整。
2. **平台覆盖最广**：11 家小程序 + 鸿蒙，白皮书 §7 平台矩阵的成员它基本都有。
3. **语法零学习成本**（对 Vue 开发者）：不发明新 DSL，复用 Vue 生态全部心智。
4. **uniCloud 绑定**：一体化云开发形成商业闭环，独立开发者留存强。
5. **uni-app x 路线**：uts→原生编译证明"编译期消除 JS 引擎"可行，与 OmniLet Display List 思路同向。

## 局限（Cons）

1. **无自有容器**：不能嵌入第三方 App 作为运行时；热更新受平台审核约束（白皮书 §7 "热更新依赖平台"、"可嵌入需自行集成" 的依据）。
2. **渲染性能天花板**：小程序端受目标平台限制；经典 App 端 WebView 渲染；无高性能自绘/3D 引擎（白皮书 §7 "高性能 3D 依赖目标平台" 的依据）。
3. **条件编译注释侵入业务代码**：`#ifdef` 散落源码，与 OmniLet 不变量②（IR 层消解、业务零 #ifdef 泄漏）直接冲突——OmniLet 的差异化设计点。
4. **工具链锁定**：HBuilderX 强绑定，CI 中脱离 HBuilderX 编译长期是社区痛点。
5. Vue 语法绑定：React 团队无法使用（Taro 的切入空间）。

## 对 OmniLet 的借鉴 / 影响（D4 相关）

1. **编译器实现参照**：uni-app vue3 = Vite + vue 官方编译器 + 平台转换插件——印证"复用成熟编译器 + 平台后端插件"路线可行；OmniLet D4 的"Babel/SWC/自研 AST"裁决可参考其平台后端插件化结构。
2. **条件编译教训**：uni-app 的 #ifdef 注释方案证明"源码级条件编译"易用但污染业务代码；OmniLet 架构.md §④ 已决定在 IR 层消解，档案确认该决策的必要性。
3. **生态位差异**：uni-app 是"编译到多端"而**没有**"自有容器 + 可视化设计器 + 管理后台"闭环；OmniLet 的差异化正是三者的合并，两者不是正面竞争关系，而是潜在迁移上游（uni-app 用户缺嵌入式容器时迁向 OmniLet）。
4. **平台矩阵参照**：OmniLet MVP 范围（微信 + 自有容器）之外的长尾平台（快手/钉钉/小红书等）优先级可低——uni-app 已覆盖，OmniLet 后续以适配层插件逐个补齐即可（架构.md 适配层设计支持此扩展）。

## 来源

- 官网：https://uniapp.dcloud.net.cn/（平台列表、uni-app x、生态宣称；2026-10-16 抓取）
- GitHub API：dcloudio/uni-app（stars/pushed_at/license；2026-10-16 实测）
- OmniLet 内部对照：docs/whitepaper.md §7、docs/architecture.md §④/⑦（D4 待裁决项）
