# omnilet-container SDD（行为条款）

> 条款头 `## CEF-NN:` = 追溯锚点；测试注释 `// spec: CEF-NN`。
> 来源标注：crash-witnessed = 2026-10-19 spike 现场（cef_backend T1/T2），非二手知识。

## CEF-01: boot-order（进程启动合同）

- **前置**：任何 cef C-API 调用之前
- **操作**：必须依次：`load libcef.so`（loader 解析）→ `api_hash(sys::CEF_API_VERSION_LAST, 0)`（上下文握手）→ `Args::new()` → `App` 对象构造（wrap_app 产物先于 execute_process 存在）→ `execute_process(Some(main_args), Some(&mut app), null)`
- **预期**：browser 进程 execute_process 返回 -1；子进程返回 ≥0 后原样退出（不再触碰 CEF）
- **边界**（全部 crash-witnessed）：
  - api_hash 前调 `cef_command_line_create` → 内部 wrap null → immediate_crash（SIGTRAP）
  - execute_process 传 `None` app → `CefApp_CToCpp invalid version -1` crash（cef-rs examples/osr 的 Some(&mut app) 写法是规范形）
- **验证**：`omnilet-cef/examples/cef_lifecycle.rs`（contract-API 全生命周期，2026-10-19 painted=true）
- **补充（2026-10-19 crash-witnessed）**：**进程内 cargo test 不可用**——libtest 的 `--ignored/--test-threads` 等参数会被 Chromium 命令行解析器 CHECK 崩溃（`Unrecognized option: 'type'` + SIGTRAP）。CEF 生命周期验证**只能走独立进程 example**；test-matrix T1 对 omnilet-cef 的覆盖 = 编译/纯函数层，行为验证在 example lane（CI 自动化 = 未来 CEF-CI 切片，runner 需 pixi 依赖 + `cargo run --example`）

## CEF-02: headless-launch（无 X 启动合同）

- **前置**：无 $DISPLAY 环境（服务器/CI/裸工控）
- **操作**：`on_before_command_line_processing` 注入两开关：`headless=new` **且** `ozone-platform=headless`（单加 headless 不够——Ozone 平台层仍选 x11，crash-witnessed）
- **预期**：initialize 返回 1；OSR 帧经 `on_paint` 送达
- **边界**：GPU/EGL 会打一串 `Could not open the default X display` ERROR 日志后**回落软件 GL 成功**——错误日志非失败信号，判定只看 painted/像素（T2 实测：非黑采样 1924 帧成立）
- **验证**：spike rc=0 断言 `painted && nonblack>10`

## CEF-03: loader-path（库搜索合同）

- **前置**：dev 环境 `cargo run --example`（二进制在 examples/ 子目录）
- **操作**：`LD_LIBRARY_PATH=target/debug`（libcef.so 落位于此）；CEF 资源路径显式 `resources_dir_path`/`locales_dir_path` 指 target/debug
- **预期**：loader 解析 libcef.so 成功
- **边界**：**产品化条款未定**——发布形态需 rpath `$ORIGIN`（polyorch 构建面注入）或安装树布局；届时新增条款修订本条，spike 环境 hack 不得渗入产品 bin
- **验证**：ldd 无 not found

## CEF-04: runtime-deps（交付依赖清单）

- **操作**：目标系统运行时 = libcef.so 的 ldd 闭包（本实测 30+：libnss3/libgbm/libdrm/libasound/atk/cups/gtk3 系/gnutls 系…，全 Ubuntu-20.04-最小桌面满足）
- **预期**：桌面/工控精简发行版安装本清单即可跑（无 conda/apt 版本冲突时）
- **边界**：完整清单由 CI/打包面生成（distribution slice 固化成机器可查的 deb 依赖字段）；conda-forge 提供 webkit2gtk-4.1 的路径**已死**（glibc 2.34 墙，D16 定案走 CEF 后此路不再需要）
- **验证**：`ldd target/debug/libcef.so | grep 'not found'` 空

## CEF-05: security-stance（沙箱立场声明）

- **操作**：`Settings.no_sandbox = true`（cef-rs 默认姿态，feature=sandbox 才开 Chromium 进程沙箱）
- **预期**：OmniLet 的安全承诺**始终且仅仅**在 omnilet 层（D8 链条：签名 fail-closed / 权限三层 / 白名单过滤器 / 渲染进程崩溃域隔离）；CEF 进程沙箱是它的内部加固选项，**不是也不被当作**产品的安全边界
- **边界**：将来若启用 CEF sandbox feature（分发安全审计要求），独立决策不在此改
- **验证**：Settings 字段构造 + 本条款评审记录

## CEF-06: offline serving lane（目录级离线包供带）

- **操作**：`load_offline_dir(dir)` → 全局 `ResourceManager` 注册 `add_directory_provider("omnilet://app", dir, 0, "omnilet-app")`（同 id 重入 = 替换）→ `navigate("omnilet://app/index.html")`；scheme 在 boot 时注册（STANDARD|LOCAL|SECURE|CORS 位组合，CEF-01 时序）
- **预期**：omnilet:// 请求命中 serving 计数（`offline_served()>0` 为链路活性证明，lifecycle example 实测 =1）；`omnilet-protocol::resolve` 的遍历防护语义即 serving 语义（unit 测试双端同源）
- **边界（cef-rs 154 字符串考古结论，勿再踩）**：`Request::url()` 返回 `CefStringUserfreeUtf16`——**无 as_str/Display**；唯一取串路 `CefStringUtf16::from(&u).as_slice() → String::from_utf16_lossy`（helper `cef_url_str`）。utf8 系才有 as_str
- **验证**：`examples/cef_lifecycle.rs` LIFECYCLE-RESULT（painted + served 双断言，2026-10-19 实测 `painted=true offline_served=1`）

## CEF-07: browser→render 任务通道行为发现（T7 现场，2026-10-19）

- **实测（headless=new + OSR 软渲染 + external pump + no_sandbox，cef-rs 154.5 / cef 154.0.34 / Linux）**：
  - `CefFrame::SendProcessMessage`：**活**（双向，channel 送达，canary 实证）
  - `V8Context::eval`（render 本地）：**活**（retval 可读，typeof 实测回传）
  - `CefFrame::ExecuteJavaScript`（browser 发起）：**不发**（同 IPC 底座上无效果；was_hidden/set_focus 唤醒无效；脚本 url 有/无均无效）
  - cef-rs message_router wrapper `on_context_created`：调用无 panic，但 `window.cefQuery` 未出现（与 execute_js 同域受害，wrapper 路线未走通）
- **决定**：omnilet 桥协议**自建于已验证通道**（process message 双向 + render 本地 V8Context::eval 回调派发），不依赖 frame-execute，暂不依赖 message_router wrapper；V8 函数注入 leg 待 cef-rs V8 factory 辅助可用性核实（无 helper 则退 fetch 型桥：omnilet://__bridge XHR，RRH 同步应答）
- **验证面**：lifecycle example bridge 段保持"expected-blocked"形态（hits=0 不算失败），协议 lane 落地后翻绿为正式门禁
- **附**：PAGE-PIXEL 证明形态保留（offline 页中心像素精确匹配供带内容 = 端到端内容验证，T6 强化）
