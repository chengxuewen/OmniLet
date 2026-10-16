# Hippy — 腾讯跨端框架（原生渲染优先 + 可插拔渲染层的分层教科书）

> Profile | Snapshot: 2026-10-16 | repo HEAD `b0a8f67` @ **2026-09-09**（Tencent/Hippy master，活跃） | License: **Apache-2.0**

## Profile

- **血统**: 腾讯内部框架开源（QQ 音乐、腾讯视频等在用），2019 开源；3.0（Hippy3）大重构为 Driver/DOM/Renderer 三层解耦。
- **治理/资金**: 公司主导；README 声明背靠 Tencent TDS 前端团队（framework.tds.qq.com）；持续发版（repo 内 CHANGELOG 活跃）。
- **平台**: iOS / Android / **HarmonyOS / 鸿蒙 ohos**（modules/ohos）/ Web 同构；Voltron renderer 补 Flutter 场景。
- **一句话**: 与其说竞品，不如说是 OmniLet 容器"渲染层可插拔"设计的最完整开源先例——同一个 DOM 层接三种 renderer（Native/Voltron/Web）。

## Architecture Essentials

- **3.0 三层解耦**（docs/README.md 原文）：
  - **Driver 层**：对接任意 DSL 的渲染指令封装（官方 hippy-react / hippy-vue / hippy-vue-next），官方明确支持"扩展其它任意 DSL"。
  - **DOM 层**：跨 renderer 复用的 DOM 管理 + 排版布局核心（C++，含 **Taitank** Flexbox 布局引擎，`dom/include/dom/taitank_layout_node.h`）。
  - **Renderer 层**（可插拔三选）：**Native**（Android/iOS/ohos 原生视图树）/ **Voltron**（Flutter 渲染）/ **Web**（WebView 同构回退）。
- **JS 引擎**：多引擎适配——iOS JavaScriptCore / Android V8 或 X5 内核 JS / 可选自研 **HippyJs**（docs/feature/feature3.0/js-engine.md"JS引擎切换"）；footstone 模块提供引擎无关的公共底座。
- **线程模型**：JS 引擎独立线程 + 原生 UI 线程，指令经 binding 直达（"Excellent performance with JS engine binding communication"）；无双线程逻辑/渲染分离——比 Lynx/OmniLet 少一层隔离，单线程模型下靠 binding 直调换性能。
- **性能自证**：docs 侧 ListView 滑动流畅度 + 内存曲线对比图（对比竞品）、Web 标准 Performance API 全链路埋点（hippyNativeInitStart→hippyFirstFrameEnd 十个锚点）——性能度量协议本身值得抄。
- **基础设施**：VFS（modules/vfs，离线资源/热更新底座）、image-decoder-adapter、custom-font、render-node-snapshot（截图/快照）。

## Strengths

- Driver/DOM/Renderer 三层解耦：新 DSL 和新 renderer 都是插件位——正是 OmniLet"多端编译 §④ + 双模式渲染"需要的分形结构。
- 原生渲染优先：每端用系统原生控件，性能与平台一致性好、包体积小（无需捆绑引擎）。
- 工程配套完整：VFS、性能埋点协议、截图快照、devtools——容器平台的"周边件"清单可直接对表。
- 存活 7 年+、仍活跃、多端真实量产（腾讯系大流量）。

## Weaknesses

- 主体仍是 C++/平台原生代码（Gradle/CocoaPods/CMake 混合构建），Rust 世界无法直接复用。
- 非双线程：逻辑与渲染指令同线程驱动，JS 长任务阻塞渲染指令流——Hippy 选择了性能直调而非隔离，HMI 高争用场景风险高。
- Native renderer 路线 = 每端一套 renderer 实现（android/ios/ohos 三份），多端一致性弱于自绘；这与 OmniLet"自绘保像素一致 + wry 保轻量"的双模式取舍正好互补。
- Web 同构是回退位而非一等公民。

## Adopts for OmniLet

1. **渲染层可插拔的正式接口**：定义 Renderer trait（对应 Hippy 的 Native/Voltron/Web 三实现位）——OmniLet 的 wry 标准模式与 wgpu HMI 模式应当是同一个 Renderer 接口的两个实现，而不是两套代码路径。这是本轮研究对 OmniLet 架构最直接的输入。
2. **Taitank 布局引擎参照**：Rust 世界对应物就是 taffy（D3 已选）；Taitank 证明了独立于渲染的布局内核可被三个 renderer 共享——布局必须下沉到 DOM/元素层，不进 renderer。
3. **Performance API 埋点协议**：十个启动锚点（nativeInit→jsEngineInit→bundleEval→runApplication→firstFrame）照抄进容器 SDK 的性能埋点，热更新与首屏优化都需要这条链。
4. **VFS 模块**：离线包资源虚拟化独立成模块（modules/vfs）——与我们"离线包管理与网络请求拦截"（tech-whitepaper §4.2）对位，接口形状可参考。
5. **render-node-snapshot**：渲染树快照能力用于截图/录屏/调试——HMI 工业场景刚需，纳入容器 SDK 能力清单。

## Avoids

1. 每端一套原生 renderer 的三份维护（android/ios/ohos 各一）——我们用自绘/WebView 双模式收敛实现数。
2. 逻辑与渲染同线程直调——保持双线程隔离（tech-whitepaper §3），用 Lynx 式主线程脚本解决跟手而非取消隔离。
3. 把 Web 同构当唯一回退（Hippy Web renderer 深度有限）——我们的降级链是系统原生→外部浏览器（tech-whitepaper §7）。

## Sources

- https://github.com/Tencent/Hippy HEAD `b0a8f67` @ 2026-09-09（README、docs/README.md 3.0 架构、dom/、renderer/{native,voltron,tdf}、modules/{footstone,vfs}、docs/feature/feature3.0/*）
- Hippy 官网: https://doc.openhippy.com/
- Taitank 布局引擎: https://github.com/Tencent/taitank
