# Lynx — 字节跳动双线程自渲染引擎（OmniLet 同赛道最强参照）

> Profile | Snapshot: 2026-10-16 | repo HEAD `abe6aad` (lynx-family/lynx, develop) | License: **Apache-2.0**（clay/ 子树携带 Flutter engine 衍生代码，附 LICENSE.flutter——引入其渲染代码时 NOTICE 义务穿透）

## Profile

- **血统**: 字节跳动内部框架（抖音 TikTok/Lark 等在用），2025-04 开源；lynx-family 组织 = core engine + ReactLynx（Preact 内核）+ Rspeedy（Rspack 构建链）+ PrimJS（QuickJS 分支）。
- **治理/资金**: 公司主导开源，核心提交者为字节员工；release 节奏 2026 年起双月一版（3.4→3.5→3.6→3.7），官方 2026 roadmap 明确桌面化与生产加固。
- **平台**: iOS / Android / HarmonyOS（3.4 起）/ Web 同构；3.7 官方支持桌面 macOS/Windows。
- **一句话**: 与 OmniLet 容器技术路线同构度最高的开源引擎——双线程运行时 + QuickJS 系引擎 + 二进制 Display List 自渲染，直接验证了 D3 的多条裁决。

## Architecture Essentials

- **双线程模型**：主线程跑首屏渲染、布局与 main-thread script（执行 PrimJS 字节码）；后台线程跑 ReactLynx 调度、生命周期与绝大多数副作用（PrimJS/JSCore，SWC 转译到 ES2015）。与微信系"渲染/逻辑双线程"同构，但**主线程可执行受限 JS**（`'main thread'` 函数 + `main-thread:` 前缀事件），绕过了双线程通信瓶颈。
- **元素树而非 DOM**：统一 element 抽象，可映射到原生视图或自绘 renderer；`view`/`text` 等自定义标签映射原生控件；无 `window`/`document`，通过 `lynx` 全局对象 + SelectorQuery 访问节点——与 OmniLet"逻辑层无 DOM/BOM"的裁决一致。
- **渲染管线**：`gfx/display_list` 定义 `DisplayListOpType` + `DisplayListReader`——**序列化二进制 Display List 指令流**，自绘模式（Clay）消费之；与 D3"编译期生成 Display List 二进制指令流"是同一形状。
- **Clay 自绘引擎**：基于 Flutter engine 深改的渲染运行时，2D 库换为自研 **Skity**；吸收 Chromium 的帧调度状态机、GPU 线程动画与图片懒解码、跨 API/跨进程图形资源共享；支持嵌入 **Qt 与 Electron**。桌面像素一致性靠 Clay，不靠 WebView。
- **IFR（Instant First-Frame Rendering）**：模板 + `initData` 主线程同步直出首帧，不等待 JS bundle——首屏性能的核心卖点。
- **布局/样式**：CSS 子集（linear/flex/grid/relative，`rpx` 单位，`-x-` 前缀扩展）；明确不支持 `min-content`、`grid-area`——CSS 子集边界的工程先例。
- **宿主集成**：`platform/embedder` 提供 LynxGroup/fetcher/http_service 等 C++ 嵌入层；另有 Native Modules / Custom Elements 两条宿主扩展通道。
- **构建工具链**：Rspeedy（Rspack）产出 Lynx bundle（含 JS 字节码 + 样式的二进制），`engineVersion` 做 bundle↔引擎兼容门控。

## Strengths

- 双线程 + 主线程脚本逃生舱：既保留线程隔离安全，又能做手势跟手动画——对 OmniLet HMI 模式的交互设计是最直接参考。
- 二进制 Display List + 字节码 bundle：冷启动路径上没有 JS 解析，与 D3 的指令流裁决互相印证。
- 活跃、双月发版、官方桌面路线；文档（llms.txt 机器友好）与 DevTools 完整。
- PrimJS = QuickJS 分支带字节码优化，证明 rquickjs 系可承载一线量产规模。

## Weaknesses

- C++ 代码体量巨大（GN 构建，core+clay+gfx 三树），非 Rust——只能读架构不能直接复用实现。
- Clay 绑定 Flutter engine：为像素一致性引入了一个二级引擎，与 OmniLet"wgpu 直出自绘"路线不同；其 LICENSE.flutter 衍生代码是引入时的许可注意点。
- ReactLynx 是官方唯一一等公民 DSL；Vue/其它 DSL 非官方路线（多端编译故事弱于 Taro/uni-app 阵营）。
- 生态新：2025-04 才开源，长尾三方库/车载场景案例少。

## Adopts for OmniLet

1. **主线程脚本（main-thread script）机制** → HMI 模式的跟手交互方案：受限脚本在渲染线程执行，事件带 `main-thread:` 前缀直达元素——写进容器 SDK 的交互层设计。
2. **Display List 二进制格式 + Reader 分离** → 我们的 DSL→DisplayList 指令流需要 `OpType` 枚举 + 序列化 reader 的对称设计，Lynx 的 `gfx/public/display_list*.h` 是现成的字段清单参照。
3. **IFR 首帧直出**：模板/数据先行、逻辑后置的启动分相，直接映射到轻应用启动数据流（architecture.md §③）。
4. **engineVersion 兼容门控**：bundle 与容器引擎版本握手，热更新安全的前置条件。
5. **CSS 子集负面清单**（不支持什么，写明白）：比"支持多少"更有工程价值，HMI 模式样式子集照此格式定义。

## Avoids

1. Clay 式"借 Flutter engine 自绘"——双引擎栈维护税；我们用 wgpu/skia-safe 直出（D3）。
2. GN 多仓巨型构建——Cargo workspace 单链路（Phase 2 已定）。
3. 单一 DSL 绑定——OmniLet 是编译期多端（§④ 多端编译模型），DSL 层必须允许多前端。

## Sources

- https://lynxjs.org/llms.txt（官方全量文档索引，2026-10-16 抓取）
- https://github.com/lynx-family/lynx HEAD `abe6aad` @ 2026-10-16（含 clay/README.md、gfx/display_list/、platform/embedder/）
- Lynx 3.7 release blog（桌面支持/SVG）: https://lynxjs.org/blog/lynx-3-7.md
- Skity 2D 库: https://github.com/lynx-family/skity
