# Kraken — 阿里巴巴 Flutter 底座 W3C 自渲染引擎（教训样本：停滞的上游）

> Profile | Snapshot: 2026-10-16 | repo HEAD `2f4f971` @ **2022-07-27**（openkraken/kraken master，已停止演进） | License: **Apache-2.0**

## Profile

- **血统**: 阿里巴巴淘系技术开源（2020-2022 活跃），"把 W3C 标准带到 Flutter"——用 C++ bridge 在 Flutter 之上实现 HTML/CSS 子集 + DOM API。
- **治理/资金**: 有正式 GOVERNANCE.md（Core Collaborators + TSC，双 approve 落地制）——治理文档完备但未阻止上游弃养。
- **平台**: iOS/Android（Flutter 底座），macOS/Linux 官方 CLI 可跑。
- **⚠️ 生存状态**: 官方 README 顶部声明——**Flutter 3.x+ 用户请迁移到社区 fork [WebF](https://github.com/openwebf/webf)**。上游最后提交 2022-07，bug 仅社区 fork 修复。这是三条 lane 里唯一的"弃养样本"，其教训价值不低于技术价值。

## Architecture Essentials

- **三层结构**：Dart 侧（widget/rendering/scheduler）+ **C++ bridge**（DOM/CSS/事件，编译为 `libkraken_bridge`）+ JS polyfill（bridge/polyfill，跑在 JS 引擎里实现 BOM 级 API）。
- **JS 引擎 = QuickJS**（bridge/page.h 直接 `#include <quickjs/quickjs.h>`）——同为 QuickJS 系，但通过自封装 jsc 层绑定，无 PrimJS 式字节码优化。
- **渲染路径**：JS 构建 DOM → bridge 计算 style → 转成 Flutter RenderObject/widget 树 → Flutter (Skia/Impeller) 光栅化。**自绘的是 Flutter，Kraken 只做 DOM 语义层**——与 OmniLet HMI 模式（自己产出绘制指令）层级不同。
- **W3C 兼容野心**：支持 `<div>`/`<img>` 等真 HTML 标签 + DOM API（getElementById/createElement…）——与 OmniLet"逻辑层无 DOM"裁决相反，兼容层成本是它的包袱。
- **嵌入模型**：以 Flutter Widget（`Kraken(widget)`）方式嵌入 Flutter app；非 Flutter 宿主需要自带 Flutter engine——宿主耦合方向与 OmniLet C ABI 嵌入相反。

## Strengths

- C++ bridge 把 DOM/CSS/事件与 Dart UI 解耦：JS 逻辑变更无需重编 Dart 层，动态化边界画得清楚。
- W3C 标准兼容让 Web 代码接近零改迁移，前端心智负担最小。
- 布局/手势/滚动在 Flutter 层复用成熟实现，起步快。

## Weaknesses

- **上游已死（2022-07）**；Flutter 3.x 适配靠 WebF fork 接力——依赖单一公司项目意愿的活教训。
- 真塞进一个 Flutter engine 才能渲染：包体积/内存承担 Flutter 全量成本，且宿主必须是 Flutter。
- DOM 兼容层深（polyfill + bridge + Dart 三处实现语义），维护面巨大——弃养的直接原因之一。
- 性能天花板受"QuickJS→bridge→Dart→Flutter"跨语言链路限制，事件/滚动路径长。

## Adopts for OmniLet

1. **bridge 动态化边界**：把"可热更的 JS 世界"与"原生渲染世界"的边界收敛到一个 C ABI bridge，桥面保持小而稳定——与我们 C ABI 宿主边界（D3）同构，Kraken 的 `dart_methods.cc` 方法表是桥面设计的反面教材（方法多而杂），我们应学其"分层"不学其"表大小"。
2. **W3C 兼容的度**：Kraken 证明了 DOM 级兼容不可持续；OmniLet 无 DOM 裁决（D3）被反证支持——记录此反例以防未来摇摆。
3. **GOVERNANCE 双 approve 制**：多维护者落库流程值得抄进未来容器内核的协作规则。

## Avoids

1. 在 Flutter/任何二级 UI 栈之上搭自绘——宿主范围被二级栈锁死（我们：wry 标准模式 + wgpu 自绘直出，D3）。
2. DOM API 级兼容目标——兼容面即负债，OmniLet 明确不做（逻辑层无 DOM）。
3. 对单一上游项目的无 fork 预案依赖——选型时必须验证项目活跃度与 fork 生态（Kraken→WebF 是先例）。

## Sources

- https://github.com/openkraken/kraken HEAD `2f4f971` @ 2022-07-27（README 迁移声明、bridge/page.h QuickJS include、GOVERNANCE.md）
- 官方推荐 fork: https://github.com/openwebf/webf
- https://openkraken.com/（2026-10-16 抓取返回空内容——站点亦已下线，佐证弃养）
