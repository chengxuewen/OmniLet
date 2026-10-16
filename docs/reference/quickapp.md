# QuickApp（快应用）竞品档案

> 快照日期：2026-10-16 ｜ 来源：quickapp.cn 官网、doc.quickapp.cn 官方规范文档（框架/manifest/接口）｜ 信源以公开页面为准；引擎版本能力标注以 doc 站当日版本为准

## ① 项目画像

快应用（QuickApp）是由**手机厂商联盟**制定的标准化"免安装应用"形态：使用前端技术栈开发、**原生渲染**、深度集成在厂商手机 OS 中，用户无需下载安装即可从系统级入口（全局搜索、负一屏、浏览器、桌面等）直达服务。

官方背景介绍：

> 2018 年 3 月份，由小米，OPPO，vivo，华为等 10 家国内主流厂商成立了快应用联盟，从技术规范层面做了统一，并保证了开发者开发的快应用可以直接在所有的联盟内厂商的手机设备上运行。

- **本质**：与微信小程序同期的另一种轻应用标准，区别是**厂商 OS 级集成**（引擎内置在手机系统里）而非超级 App 内嵌 —— 因此入口在系统层（全局搜索、语音助手、应用商店、浏览器、系统桌面、安全中心、信息助手、PUSH、广告、短信模板等）。
- **价值主张**：网页免安装但体验差；原生 App 体验好但要下载安装。快应用 = 免安装 + 原生体验，"同时具备 H5 与原生应用的双重优点"。
- **与 OmniLet 的关系**：快应用是 OmniLet 多端编译的**目标平台之一**（whitepaper §4.1：输出 `.rpk` 包），不是容器侧竞品 —— OmniLet 借快应用联盟触达厂商 OS 流量；其 DSL/规范是统一 DSL 设计的参照系之一。

## ② 架构与原理（与 OmniLet 相关部分）

**技术栈**：前端栈 + 原生渲染。MVVM 设计模式，"与 Vue 的开发方式相近"，数据驱动，无需操作 DOM。

**工程结构**：一个 `manifest.json` + 多个页面/组件 `.ux` 文件；ux 文件内联 UI 模板、样式、数据定义与事件回调。

**manifest.json 核心字段**（OmniLet 编译目标为快应用时需生成）：

- `package` / `name` / `icon` / `versionName` / `versionCode` / `minPlatformVersion`（兼容性检查）
- `features`：**接口权限显式声明制** —— 绝大部分系统接口（如 `system.network`）必须在此声明否则不能调用；`config.background.features` 可申请后台运行接口（audio/geolocation/record/request 等）
- `router`：页面路由表（entry、pages[].component/path/filter/launchMode、errorPage）；filter 可声明页面处理某种 URL 请求（类似 deeplink 路由）
- `display`：titleBar、状态栏沉浸、横竖屏、异形屏绘制、themeMode、menuBar 分享配置、pageCache 等大量 UI 配置
- `subpackages`（1040+）：分包加载，"base" 为基础包保留名
- `trustedSslDomains`（1060+）：web 组件可信 https 站点

**接口体系**：同步接口直接返回；异步接口用回调或 Promise（1010+）。接口以 `system.*` service/feature 形式按需挂载，覆盖网络、存储、音频、录音、地理定位等系统功能与第三方服务对接（支付等）。

**运行模型**：框架深度集成进各厂商 OS，管理页面路由与生命周期；渲染走各厂商引擎的原生控件/自绘管线（非 WebView）。

## ③ 功能与特性

- **开发工具**：快应用 IDE（或命令行工具 hap 工具链）+ Chrome DevTools 调试；预览、真机调试、上传后经**厂商签名**分发。
- **上架流程**：快应用官网注册 → 完善资料 → **绑定至少一家厂商开发者账号** → 提交审核 → 各厂商渠道分发。一次开发、联盟内厂商设备通跑，但审核/签名/流量入口仍按厂商割裂。
- **引擎版本碎片化**：能力带 `1040+` / `1050+` / `1060+` / `1070+` / `1080+` / `1100+` 等版本标注，各厂商手机 OS 内置的引擎版本参差，`minPlatformVersion` 兼容性检查是上架刚需 —— 这是编译侧多端适配中最"脏"的目标之一。

## ④ 优缺点

**优点**：厂商 OS 级引擎集成带来的系统级入口与免安装直达；规范统一，一次开发联盟内设备通跑；前端栈 + 原生渲染的流畅体验（立项原点验证了非 WebView 渲染的可行性）；权限声明制清晰。

**缺点/风险**：分发红利递减 —— 入口多但用户心智弱、单厂商流量分散，生态热度不及小程序；引擎版本碎片化严重，兼容成本高；华为转向 HarmonyOS 后投入口径变化，联盟覆盖以国产 Android 为主；多家第三方多端框架对该目标的维护优先级已降低。

## ⑤ 对 OmniLet 的可借鉴点（映射到模块）

1. **编译目标适配层的现实样板**：快应用的 `.ux` + manifest 结构与微信小程序差异大（模板/样式内联方式、features 权限声明、router/filter 模型），是验证 OmniLet"平台差异只出现在编译期适配层"不变量的最佳试金石之一 —— 若快应用目标不能做到零业务侧 `#ifdef`，说明 IR 设计有洞（→ 编译引擎）。
2. **权限显式声明制值得吸收**：manifest `features` 按需声明接口权限、`background.features` 单独申请后台能力 —— OmniLet 自有容器的权限模型可参考：统一 API 默认最小授权 + 清单声明提权（→ 容器 SDK / 沙箱）。
3. **引擎版本碎片化 = 编译器要带"能力检测垫片"**：能力标注到 4 位平台版本号（1040+…），编译到快应用需支持按 `minPlatformVersion` 降级/裁剪特性，应一次性设计进编译管线（→ 编译引擎）。
4. **原生渲染验证了 OmniLet HMI 模式的方向**：快应用"前端栈 + 原生渲染"的立项原点与 OmniLet 自研 GPU 渲染（Display List + Dirty Rect）同向；证明了"非 WebView 渲染的前端栈应用"可行且用户可感知流畅（→ 渲染引擎）。

## ⑥ 不借鉴/规避点

- **不作为统一 DSL 基准语法**：快应用作为编译目标置于第二梯队（whitepaper §8 已安排在 6-12 个月阶段）；`.rpk` 打包规范（manifest/ux 结构、分包、features 声明）对应"快应用编译目标适配层"，但 DSL 基准仍是微信语法系。
- **不押注其分发流量**：作为分发渠道的预期要保守，保留 `.rpk` 输出能力的价值在"全平台覆盖"完备性，而非流量获取。

## ⑦ 来源 + 快照日期

- 官网：https://www.quickapp.cn/
- 文档中心：https://doc.quickapp.cn/
- 框架简介：https://doc.quickapp.cn/framework/
- manifest 规范：https://doc.quickapp.cn/framework/manifest.html
- 接口体系：https://doc.quickapp.cn/features/
- 概述（背景/入口/流程）：https://doc.quickapp.cn/
