# 竞品档案：kbone（微信官方）

> 快照日期：2026-10-21。证据：浅克隆 `wechat-miniprogram/kbone` @ **631432e**（末次提交 2025-10-20 = 恰好一年前，**停滞信号**）+ `mp/main/{miniprogram-render,miniprogram-element}` 包实测。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | 微信官方（wechat-miniprogram org） |
| 定位 | **Web→小程序运行时适配器**（DOM/BOM shim）：在小程序里模拟浏览器环境，Vue/React/Preact/Omi 代码**不改直接跑** |
| 活跃度 | 末次提交 2025-10-20（快照日一年前）*UNCERTAIN* 维护状态 |
| License | MIT |
| 包结构 | `miniprogram-render`（DOM/BOM shim 核心）+ `miniprogram-element`（宿主侧渲染组件）+ 一堆 webpack/vue loader + kbone-cli/kbone-tool/kbone-ui |

## 架构与原理（只留 OmniLet 相关轴）

1. **生态载体 = 运行时 shim，不是编译器**：不转换代码，改运行环境。框架无关性是它的立身之本（官方模板给 Vue/React/Preact/Omi 四套），代价是**必须伪造整个浏览器面**：`miniprogram-render` 实测含 node/element 类 + 每元素类型适配类（input/select/textarea/video/a/canvas/image/**not-support**——自带"不支持"占位类）+ BOM shim（location/history/performance/worker/screen/storage/cookie/xml-http-request/navigator）。
2. **自我声明的性能边界**（README 原文）："kbone 是使用一定的性能损耗来换取更为全面的 Web 端特性支持"；并给出量化红线——**页面节点数超过约 1000 且要稳定渲染时，官方建议改用静态模板转译方案**。DOM-shim 派与静态编译派的分界线由官方自己画出。
3. **保真度换包体**：v-html、vue-router 等全保留（"不会对框架底层进行删改"）——Web 语义完整度最高、抹平面最大的一派。

## 优势

- Web 生态完整兼容（路由/指令/三方 DOM 库直跑）；微信官方出品背书；框架无关

## 局限

- 节点数天花板官方自认（1000+）；BOM 伪造面巨大且永远补不完（not-support.js 是诚实的墓碑）；每元素一层小程序组件 =  setData 压力结构性存在；近一年无提交

## 对 OmniLet 的借鉴

1. **1000 节点红线是 D10-2 静态路线的官方判例**（→ 编译引擎/tech-whitepaper 论据）：Web 语义保真度与渲染性能不可兼得，kbone 用整层 BOM 伪造换保真、把性能上限写进 README——OmniLet 选静态编译 = 选它的反面，本档案就是"另一侧长什么样"的证据。
2. **Web 目标（A2）才用得上它的思路**：kbone 的 DOM-shim 是"小程序里跑 Web"，OmniLet 的 Web 目标是"标准浏览器跑小程序语义"——方向相反，不可搬用，防止后续切片混淆（→ 编译引擎 Web 规则表设计时引此辨析）。
3. **负面清单的竞品注脚**：dsl-spec §2 挡掉的"过度动态形态"，kbone 全收了——收的代价就是它的 README 性能声明。负面清单每条都有这份档案做成本对照。

## 不借鉴

- 整条运行时 shim 路线（D10-2 已裁决静态翻译）；不承诺 Web 级 DOM 保真（负面清单守门）。

## 来源

- kbone @ 631432e：`mp/main/miniprogram-render/src/`（DOM/BOM shim 文件树 + not-support.js）、README 性能取舍与 1000 节点原文
- OmniLet 对照：docs/dsl-spec.md §2 负面清单；D10-2 裁决
