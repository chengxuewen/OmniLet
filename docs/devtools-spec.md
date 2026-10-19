# OmniLet DevTools / 开发壳 规格（骨架 v0.1）

> **状态**：骨架（G3；B0 实现随容器 SDK 切片）。
> **裁决依据**：D9-1（B0 进 MVP）、D9-3（winit + wry + wgpu 窗口层）、D5 引擎矩阵（DevTools = rusty_v8 → CDP 调试协议）。

## 1. B0 桌面开发壳

**定义**：标准模式宿主（wry 桌面容器）兼任开发工具——三个开发态开关：

| 开关 | 行为 | 消费者 |
|------|------|--------|
| load-unpacked-dir | 直接加载未打包的项目目录（免打包迭代） | 开发者日常循环 |
| watch hot-reload | 源文件变更 → 重编译 → 自动重载（秒级迭代） | 开发者日常循环 |
| cdp-port | 暴露 Chrome DevTools Protocol 端口（rusty_v8 flavor 内建支持） | 断点/内存/火焰图 |

## 2. 开发循环（目标形态）

```text
omnilet dev [--target wechat|web|container]
  ├── wechat:    产物目录 + 监听 → 微信开发者工具打开（外部工具，本壳不越位）
  ├── web:       产物目录 + 监听 → 本地静态服务 + 浏览器（HMR 级体验）
  └── container: 本壳直接加载（load-unpacked + watch + CDP 全开）
```

## 3. automator 驱动契约（T2/T3 测试依赖）

对标微信 miniprogram-automator（launch → page → element → tap 全链路自动化）：

- 驱动通道 = CDP（与调试共用端口，测试模式附加命令域）
- 最小操作面：launch(config) / querySelector(selector) / tap(element) / getPageStack() / evaluate(js)
- 消费者：test-matrix T2 容器层行为测试 + T3 端到端

## 4. 非目标（本壳不做）

- 不做完整 IDE（编辑器交给开发者的编辑器）
- 不做微信目标仿真（微信产物的预览 = 微信开发者工具的职责，我们只产物+监听）
- 不做可视化面板（二期评估项，D5 add4 同类）
