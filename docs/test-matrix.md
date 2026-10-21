# OmniLet 测试矩阵（D6 交付物）

**版本**：v1.1 | **日期**：2026-10-16 | **性质**：发布门禁全景表（user-adjudicated 2026-10-16，含 T4 平台修正）
**哲学**（D1 蒸馏 testing-honesty）：报"通过"必须带 tier 名；门禁必须证明能咬人（正样本必红）；HashMap/迭代序不做可观察断言。

## 四层金字塔

### T1 单元层（每次提交）
| 域 | 工具 | 内容 |
|----|------|------|
| Rust 引擎/容器核心 | cargo test + clippy -D warnings | 容器核心/渲染/沙箱模块单测 |
| TS 编译器/垫片 | vitest | 编译器内核、@omnilet/runtime 垫片、规则表解析 |
| 规则表 | schema 校验 + 黄金样例 | 表驱动规则（D5-3）的 schema 与样例锁定；编译器 golden-file 在此层 |

### T2 集成层（每次 PR）
| 域 | 内容 | 出处 |
|----|------|------|
| 编译器管线 | 输入样例库 → 三目标（微信/Web/自有容器）产物快照对比 | D5-3 |
| 编译器产物（结构/行为档） | 产物文件树 + app.json ajv + wxml 语法 lint（miniprogram-compiler）+ 零 #ifdef grep；miniprogram-simulate Component 行为断言 | D9 S-4 落地 + compile-slice-1 spec §6（2026-10-21 审查合裁） |
| 容器 SDK | 沙箱 / 权限三层组合矩阵 / Worker 三级能力 / dataChannel 分区 | D5 add2/3/5 |
| **引擎一致性** | 同一业务 API 测试集 × {standard-V8, standard-JSC, lite-QuickJS}，diff 必须为空 | D5 add1 细节③ |
| CSS/组件映射 | omnilet- 前缀隔离、DOM 映射一致性 | D5 add3-1 |

### T3 端到端层（发版前）
| 域 | 内容 |
|----|------|
| 宿主集成 | Qt / Flutter 演示宿主真实嵌入冒烟 |
| 热更新全链路 | 后台发版 → 对象存储/CDN → SDK 差分下载 → manifest 验签(fail-closed) → 静默切换 |
| 管理后台 | Playwright E2E：应用/版本/灰度/审核主流程 |

### T4 真机/人工层（发版前人工）
| 平台 | 内容 | 备注 |
|------|------|------|
| **Windows** | 真机冒烟（WebView2 + V8 flavor） | 用户修正：全平台覆盖，不止移动端 |
| **Linux** | 真机冒烟（WebKitGTK/Flatpak + V8；嵌入式 target 用 lite flavor） | |
| **macOS/iOS** | 真机冒烟（WKWebView + JSC；零体积增量验证） | |
| **Android** | 真机冒烟（WebView + V8，厂商碎片化抽样） | |
| **Web 目标** | 主流浏览器矩阵（Chrome/Firefox/Safari/Edge）人工清单 | 编译到网页的产物验收 |
| **微信开发者工具** | 编译产物人眼验收一次（A1 一级勾选挂此；Linux 本机不可执行 → 人工签核记 pending） | compile-slice-1 spec §6 人眼档 |
| HMI 硬件在环 | 车机/工控 target | 二期起 |

## 发版红线（任一红 = 不可发版）
| # | 红线 | 出处 |
|---|------|------|
| R1 | 三 flavor 引擎一致性 diff 为空 | D5 add1-③ |
| R2 | 签名 fail-closed 全过（含篡改样本必拒） | 不变量⑤ + D5 add2-3 |
| R3 | 编译器 golden-file：产物 diff 超出白名单 = 禁止静默发布（有意变更须登记白名单） | D5-3 |

## CI 落地注记
- T1 随脚手架立；T2 随各模块；T3 随后台/宿主 demo；T4 清单入 status.md 每次发版执行
- 三 flavor 矩阵的 CI 成本注记：iOS JSC 只能跑在 macOS runner（成本真实，已裁决接受）
- status.md 的 "no test runner configured yet" 占位在脚手架时被本表替换
