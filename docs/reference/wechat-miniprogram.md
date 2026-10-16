# 微信小程序 — 基准目标平台：双线程模型 + Skyline 渲染器演进 + 最大生态

> 快照日期：2026-10-16 ｜ 来源：GitHub org `wechat-miniprogram` / `Tencent/kbone`（api.github.com 当日实测）、developers.weixin.qq.com（Skyline 架构文档当日抓取核验）｜ 容器本体/DevTools 闭源，凡标 *UNCERTAIN* 者使用前必须复核

## ① 项目画像

**2017-01 上线的超级应用容器原型，双线程小程序模型的发明者**：App 内嵌小程序运行时 + 平台审核发布 + 最大开发者生态（2019 年峰值后趋于稳定，MAU 体量仍为全网第一）。腾讯内部产品，治理完全封闭：无公开 roadmap、发布独占于微信公众平台、运行时版本由微信客户端灰度控制。开源的只有框架层与工具链（GitHub org `wechat-miniprogram`，39 仓库，当日实测：glass-easel 333★ pushed 2026-09-28、miniprogram-demo 7247★、api-typings 804★、miniprogram-simulate 537★、weui-miniprogram 2433★ pushed 2026-04、minigame-canvas-engine 313★ pushed 2026-10-13；Tencent/kbone 4917★ pushed 2025-10）——容器引擎与 DevTools 全部闭源。glass-easel（"Multiple-backend component-based JavaScript framework"）是微信新一代基础库的组件框架层，**业界唯一开源的生产级小程序组件框架**。

## ② 架构与原理（与 OmniLet 相关部分）

1. **双线程模型**（OmniLet tech-whitepaper §3 的同源）：AppService（逻辑，JSCore/V8，无 DOM/BOM）与 WebView（渲染）分离，`setData` 走序列化 IPC；WXS 可在渲染侧响应事件（Skyline 下移入逻辑层，见下）。生产验证 9 年。
2. **Skyline 渲染引擎**（官方文档当日核验）：在 WebView 之外新增自研渲染底座——**独立渲染线程承接 Layout/Composite/Paint**，原 WebView 承担的 JS 逻辑/节点创建迁入 AppService 独立上下文。官方收益清单：逻辑不再阻塞渲染、**无需每页新建 JS 引擎实例（省内存省启动时间）**、页面间共享框架资源、框架内部不再走 JSBridge。代价：WXS 查询页面信息退化为异步，配套 **Worklet**（比 WXS 更贴近渲染流程的动画脚本机制）补位。存量代码基本零改动兼容——**双渲染后端并存、按页开关**。
3. **离线包/分包**：整包 + 分包下载、版本校验、差分更新——OmniLet §4.2 离线包设计的对标物。
4. **工具链**：api-typings（TS 类型）、miniprogram-simulate（自定义组件单测）、miniprogram-demo（组件/API 示例）——OmniLet DSL 工具链的需求清单原型。
5. **Donut/多端能力**：微信自己的编译期多端方案（同一套代码编译进 iOS/Android/鸿蒙 App 内嵌运行）。*UNCERTAIN*：官方文档 URL 当日 404，仅在 Skyline 文档导航见"多端能力"栏目存在。
6. **kbone**（4917★）：wx 与 Web 同构——官方背书的"小程序 DSL 渲染到 Web"先例，即 OmniLet 容器标准模式（WebView 渲染 DSL）的同类物。

## ③ 功能与特性

- **渲染**：WebView 主力 + Skyline 演进线（双渲染后端并存、按页开关）；小程序游戏走 canvas 引擎（minigame-canvas-engine，pushed 2026-10-13 仍活跃）；3D 走 WebGL 适配（threejs-miniprogram 799★，pushed 2023-05 后停滞——3D 生态靠外部适配层，已现维护断层）。
- **发布**：审核门禁 + 灰度 + 体验版/正式版双通道；**不可嵌入自有 App**（容器能力不对宿主开放）。
- **沙箱**：平台级沙箱（容器内），开发者无法触碰沙箱配置；域名白名单 + 敏感 API 授权弹窗。
- **生态**：WeUI 组件库 + 海量第三方组件库；云开发（云函数/云数据库/云存储）作为平台托管后端——业务侧"无服务器"配套，OmniLet 未规划对标物（有意不做，见 ⑥）。

## ④ 优缺点

**优点**：双线程模型 9 年生产验证；双渲染后端（WebView→Skyline）平滑演进路径，存量代码零改动兼容；最大组件生态与最全工具链（类型/测试/示例三件套开源且活跃）；分包/差分发行业级成熟。

**缺点/短板**：完全平台锁定（不可嵌入、审核门禁、能力灰度由平台控制）；渲染天花板受 WebView 限制（Skyline 正是在补这个）；跨层同步读取被迫异步化（WXS 退化案例）；多端发布仅微信一端；3D/图表生态依赖外部适配层且已现维护断层。

## ⑤ 对 OmniLet 的可借鉴点（映射到模块）

1. **双线程模型直接引用**：OmniLet tech-whitepaper §3 架构即此流派，微信是发明者与 9 年生产验证方——architecture.md 不变量①（JS 业务与渲染引擎隔离）的同源依据，架构论辩时直接引用（→ 容器 SDK）。
2. **glass-easel 多后端抽象**："一套 DSL → 多渲染后端（WebView/Skyline/原生）"的唯一开源先例——对应 architecture.md 不变量③（一套语义源，后端只加不改）的开源实证；OmniLet 容器的渲染后端切换层（WRY 标准模式/自研 GPU HMI 模式）应研读其 backend 抽象（→ 渲染引擎）。
3. **Skyline 为 HMI 模式去风险**：微信自己用行动承认"纯 WebView 渲染不够"——独立渲染线程 + 省去每页一个 JS 引擎实例 + 页面间共享资源，与 OmniLet HMI 模式（tech-whitepaper §5，D3 裁决 skia-safe/vello + wgpu 自研管线）方向同构，直接为 D3 裁决去风险（→ 渲染引擎）。
4. **Worklet = 渲染线程脚本位先例**：渲染线程侧高性能动画脚本机制——OmniLet HMI 模式需要等价物（渲染层内嵌小脚本槽，与 QuickJS 逻辑层隔离）（→ JS 引擎/渲染引擎边界）。
5. **api-typings + miniprogram-simulate**：DSL 工具链的类型层与组件测试层清单（→ 编译引擎/测试）。
6. **分包/差分/校验**：离线包管理需求全集——architecture.md §③ 数据流（差分下载→签名校验 fail-closed→静默切换）的需求清单原型（→ 容器 SDK 离线包）。
7. **源级 DSL 兼容裁定**：OmniLet 源级 DSL 形状保持微信兼容（最大存量生态 + 迁移路径 + FinClip 已验证"兼容微信语法"的获客价值）；平台差异经编译期适配层注入（不变量②），业务代码零平台分支。

## ⑥ 不借鉴/规避点

1. **平台锁定结构**：不可嵌入自有 App、审核门禁、灰度控制——白皮书 §7 表 OmniLet 差异行的依据；OmniLet 自有容器必须开放嵌入与自主发布（→ 产品定位）。
2. **WXS 异步退化**：双线程跨层同步读取的代价案例——OmniLet IPC 契约必须一开始钉死"哪些读是同步的"（→ IPC 契约）。
3. **双渲染后端的语义漂移风险**：Skyline 兼容层 = 平台 DSL 漂移的实证——architecture.md 不变量③"任何渲染后端不得引入业务层可见的新语义"正是针对此的防线；条件编译面必须收敛且有回归测试（→ 编译引擎/渲染引擎）。
4. **云开发类平台托管后端**：与 OmniLet"容器不锁定后端"的定位冲突，不做对标（→ 产品定位）。
5. **闭源容器 + 开源工具链的组合**：工具链开源拉不动容器闭源的开发者信任——OmniLet 若走 Open Core（architecture.md 不变量⑥），围栏线要画在真正可用的层（开源核心可直接跑，而非 FinClip 式 demo 开源）（→ 产品定位/Open Core）。

## ⑦ 来源 + 快照日期

- api.github.com 当日实测（2026-10-16）：`wechat-miniprogram/*`（39 仓库）、`Tencent/kbone` star/pushed 逐仓核对
- Skyline 架构（双线程演进/Worklet/收益清单）：https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/introduction.html（当日抓取核验）
- Donut/多端能力：*UNCERTAIN*（官方 URL 当日 404，待复核）
- 上线时间线（2017-01）与生态体量：行业通识，未当日核验
