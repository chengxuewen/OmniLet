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
