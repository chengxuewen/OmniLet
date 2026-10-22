# OmniLet Pitfalls

> Append-only. New entries take the next number (PIT-{n}), five-part form (Symptom / Root cause / Solution / Verification).
> This store starts empty: the predecessor's 30+ pitfalls (wgpu/naga/rendering-specific) are archived at `.refinfo/VisiaEngine/.agents/memorys/pitfalls.md`. Project-agnostic tooling lessons survive as rules in `.agents/rules/common/edit-safety.md` — check there (and grep the archive) before re-learning an old lesson.

## Format example

## PIT-{n}: Title (date)

- **Symptom**: [what was observed]
- **Root cause**: [why it happened]
- **Solution**: [the correct approach]
- **Verification**: [check command / how to prove it fixed]
- **Forbidden**: [the anti-pattern to never repeat]

<!-- Real entries append below. -->

## PIT-1: CEF Response mime_type 带 "; charset=..." 参数 → text/plain fallback（2026-10-20）
- **Symptom**: omnilet:// 页面 load_end=200、字节全送达（read n=82），但渲染为单行 649px 小黑字（HTML 源码当文本显示），背景/样式全无
- **Root cause**: `cef_response.mime_type` 字段只接受 bare type（`text/html`）；塞入 `text/html; charset=utf-8` 使 MIME 解析失败，Chromium fallback 到 text/plain
- **Solution**: mime 传纯 type；charset 走独立 `Response::set_charset("utf-8")`（bindings 24386 行有该方法）
- **Verification**: `cef_lifecycle` OFFLINE-CONTENT proof green=true；帧 bbox 从单行源码变全幅绿底
- **Forbidden**: 往 set_mime_type 传任何带参数（`;`）的字符串

## PIT-2: example 往真实 HTML 文件写 data:URL 风格 %23 → CSS 色值非法透明背景（2026-10-20，黑帧真根因）
- **Symptom**: 供带链修好（mime）后中心像素仍 (0,0,0)、全帧 alpha=0——页面"渲染为空"
- **Root cause**: `cef_lifecycle.rs` 用 `std::fs::write` 生成 demo 页，CSS 写成 `background:%2300aa44`——`%23` 是 data:URL 的百分号转义，文件内容不经 URL 解码，CSS 收到非法色值 → body 透明（OSR 下整帧无背景层即 alpha=0 黑）
- **Solution**: 文件内容用真 `#00aa44`；仅 URL 字符串（data:/navigate 参数）才转义
- **Verification**: green=true pixel=(0,170,68)，rc=0
- **Forbidden**: 把 URL 语境（转义/编码）照搬到文件/字符串内容语境；排查空帧先 dump 全帧（ppm/PIL）读出实际渲染物，再猜管线

## PIT-3: cef-rs message_router cefQuery 缺任一 callback 静默不发（2026-10-20）
- **Symptom**: window.cefQuery 存在（typeof=function）、调用不抛错、eval ok，但 browser 侧一条消息都收不到（bridge_hits=0）
- **Root cause**: RendererSideV8Handler::execute 对 onSuccess/onFailure 用 value_bykey 取值；键缺失时 V8 回读 undefined，命中 `is_function()==0 → return_exception` 分支——异常设给 handler 层后 **JS 侧只表现为 undefined 返回，门面不检查返回值就静默丢调用**
- **Solution**: 门面每次 cefQuery 都传齐两个 function（noop/onError-console 即可）；见 BOOTSTRAP_JS D20 版
- **Verification**: example 探针矩阵（带双 callback 的 raw 调用立即送达；缺 callback 的同型调用不发）；acceptance hits 计数
- **Forbidden**: 按上游注释猜"optional callbacks"——以行为矩阵实测为准

## PIT-4: CefV8Context::eval 输出槽传 null → false 且无异常（2026-10-20）
- **Symptom**: eval 大段 JS 返回 ok=0 但 exc=None，同 context 的短表达式却成功
- **Root cause**: cef-rs `eval(code, url, line, retval, exception)` 的 retval/exception 为 Option 槽位；传 None 产生 null 指针，C++ 实现把 null 输出参数当调用无效直接 return false——不编译、不执行、不设异常
- **Solution**: 两个输出槽永远给 Some(&mut Option<T>) 容器，不用的结果丢弃即可
- **Verification**: bootstrap eval 从 ok=0 转 ok=1 的唯一变更就是补 retval 容器
- **Forbidden**: 给 C API 的 out 参数传 null 来"忽略返回值"

## PIT-5: jsdom/浏览器环境测试掩盖真机崩溃（2026-10-21，compile-slice1 T11，终审揪出 2 处）
- **Symptom**: 行为档在 miniprogram-simulate（jsdom）全绿，但产物在微信真机会崩——两处 jsdom 掩盖：① adapter 僵尸行 `stop?.()`（jsdom 有 window.stop 吞掉，真机 ReferenceError 先于 onUnload）；② vendor 里裸 `process.env.NODE_ENV`（node 有 process，真机 load 即炸）
- **Root cause**: 测试宿主环境（jsdom/node）全局对象集 ⊃ 目标运行时（微信 JSC/V8 页面环境）；任何在 jsdom 绿的断言都只对"jsdom 有什么"负责，不对"真机有什么"负责
- **Solution**: 环境无关的关键路径（vendor load、生命周期钩子）加 **bare node:vm 腿**：无 window/document/process 的全局环境里 load + 走一遍 created→detached，缺全局断言 `typeof === 'undefined'` 先自证再测行为（见 `compiler/tests/device-detach.test.ts` 双腿 dev+prod）
- **Verification**: `pixi run pnpm --dir compiler test device-detach` 绿 +  bite-probe：对旧 bundle（含 zombie 行的 git 对象）重放必须红（`ReferenceError: stop is not defined`）
- **Forbidden**: 只有 jsdom/浏览器宿主腿就宣称产物"真机可跑"；人眼档前所有环境断言必须标注宿主环境名
