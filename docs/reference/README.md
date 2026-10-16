# OmniLet reference-project library（参照系画像库）

**数据快照日期：2026-10-16**（GitHub stars/活跃度均为当日实测；定性描述来自调研线当日核验，凡标 *UNCERTAIN* 者使用前必须复核）。
用途：容器 SDK / 多端编译引擎 / 沙箱 / 自绘渲染的设计证据基线（对齐 D3 已裁引擎栈 + D4 待决编译侧栈）。**每个文件只保留"对 OmniLet 有用"的部分——不是百科全书。**

## Index

### 宿主平台（编译目标方，OmniLet 必须为其生成正确产物）— lane: superapp-hosts

| document | subject | one sentence | relevance |
|------|------|--------|:-----:|
| [wechat-miniprogram.md](wechat-miniprogram.md) | 微信小程序 | 基准目标平台：双线程模型 + Skyline 渲染器演进 + 最大生态 | ★★★ |
| [alipay-miniprogram.md](alipay-miniprogram.md) | 支付宝小程序 | 第二目标：开放能力差异（支付/登录）+ 渲染栈 | ★★☆ |
| [baidu-miniprogram.md](baidu-miniprogram.md) | 百度智能小程序 | 开放联盟型宿主：搜索流量分发模型参考 | ★☆☆ |

### 直接对标（商业与标准基准）— lane: benchmark

| document | subject | one sentence | relevance |
|------|------|--------|:-----:|
| [finclip.md](finclip.md) | FinClip（凡泰极客） | **头号对标**：whitepaper 明文基准，自有容器 SDK 的商业模型+架构参照 | ★★★ |
| [quickapp.md](quickapp.md) | 快应用联盟 | 标准化协议设计参照：厂商适配层 + .rpk 包格式 | ★★☆ |

### 跨端编译框架（多端编译引擎竞品集，D4 编译栈证据）— lane: frameworks

| document | subject | one sentence | relevance |
|------|------|--------|:-----:|
| [uniapp.md](uniapp.md) | DCloud uni-app / uni-app x | 最大跨端框架：条件编译范式 + uts 编译到 Kotlin/Swift（最接近自有容器目标） | ★★★ |
| [taro.md](taro.md) | 京东 Taro 3.x/4.x | React 语系跨端：编译时+运行时抹平混合架构 | ★★★ |
| [chameleon.md](chameleon.md) | 滴滴 Chameleon | **已归档（实测 2023-01 停更）**：纯自研 DSL 无生态的死亡教训样本 | ★☆☆ |

### 自渲染引擎（自有容器自绘模式的架构同构体）— lane: engines

| document | subject | one sentence | relevance |
|------|------|--------|:-----:|
| [lynx.md](lynx.md) | 字节跳动 Lynx | **最强同构参照**：双线程+主线程脚本+二进制DisplayList（核为C++，勿仿其Flutter底座Clay） | ★★★ |
| [kraken.md](kraken.md) | 阿里 Kraken | **弃养教训样本**：上游2022-07停更，官方指路WebF fork；反证无DOM裁决 | ★★☆ |
| [hippy.md](hippy.md) | 腾讯 Hippy | **渲染层可插拔先例**：Driver/DOM/Renderer三层，一个DOM核接Native/Flutter/Web三renderer | ★★☆ |

## Writing discipline（沿袭前任项目纪律）

新文件模板：① 项目画像 ② 架构与原理（只写与 OmniLet 相关的部分）③ 功能与特性 ④ 优缺点 ⑤ 对 OmniLet 的可借鉴点（必须映射到 OmniLet 模块：容器 SDK / 编译引擎 / 沙箱 / JS 引擎 / 渲染引擎）⑥ 不借鉴/规避点 ⑦ 来源 + 快照日期。

数字必须当日实测；许可证对 Open Core 边界的影响**加粗**标注。

## 与设计文档的关系

- 引擎栈已裁（D3：Rust 双模式）→ 自渲染引擎组 + FinClip 是当前最高价值参照
- 编译侧栈未决（D4）→ 跨端编译框架组的**编译原理章节**是 D4 的直接证据
- 架构不变量见 docs/architecture.md；对标关系见 docs/whitepaper.md §7
