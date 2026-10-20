# OmniLet DSL Specification（骨架 v0.1）

> **状态**：骨架（G3，scaffold 落地；内容随 A1-A4 切片生长）。
> **生态立场**（D9-2 裁决）：**MVP 自带核心组件集（覆盖 80% 页面场景）；npm UI 组件互操作 = Phase 2；纯 JS 逻辑 npm 包自第一天生效。**
> **负面清单格式**（Lynx CSS 子集先例）：明确写出"不支持什么"比罗列"支持什么"更有工程价值——每个受限形态给出替代写法。

## 1. 模板语法（Vue-like，D10-1 裁决）

模板写在 `<template>` 块内，结构与微信 WXML 心智同构：

```html
<template>
  <view class="container">
    <text>{{ message }}</text>
    <view wx:if="condition">...</view>      <!-- 具体指令名待定稿：v-if vs wx:if 原样 -->
    <list-item wx:for="{{ items }}" />
  </view>
</template>

<script lang="ts">
// 逻辑层 = 纯 TS（D5：TS 主体、DSL 是糖）；响应式 = @vue/reactivity
</script>

<style>
/* 样式子集见 §3 负面清单；单位语义（rpx）见 §4 */
</style>
```

**待定稿项**（compiler 切片首日确定，不空转）：
- [ ] 指令命名：沿用 wx:if 原样（微信亲和最大化）或 v-if（Vue 亲和）——倾向原样 `wx:`，理由与 D10-1 同构
- [ ] 事件绑定形态：`bindtap` vs `@tap`
- [ ] 数据绑定单向性声明（setData 语义的对齐面）

## 2. 负面清单（不支持，明确列出）

| 不支持的形态 | 原因 | 替代写法 |
|------|------|---------|
| 运行时拼接组件名（`<{{ tagName }}>`） | 静态编译（D10-2）无法穷举 | 条件分支 `<view wx:if>` 全枚举 |
| 函数式子组件宏（模板内调函数返回模板） | 破坏静态可翻译性 | 组件 props + slot |
| 跨文件动态 include | 同上 | 显式 import 组件 |
| `<iframe>` 标签 | 双渲染路径语义不可对齐（标准模式=iframe / HMI 模式=OSR 实例，行为差异泄漏） | `<web-view src>`（D13-1；编译器对 iframe 自动翻译并告警） |

（首版即冻结扩展流程：新增负面条目 = dsl-spec 修订 + golden 测试同步）

## 3. 样式子集

- WXSS 选择器子集：类选择器/标签选择器/伪类受限集（明细随 compiler 切片枚举进样式规则表——D9 S-3 已路由）
- 样式隔离：`omnilet-` 前缀约定（D5 add3-1；编译器自动加前缀，业务手写免前缀）

## 4. 单位与度量

- rpx 语义：对齐微信（750 设计稿宽等比）——换算规则进样式规则表（postcss-pxtransform 同款职责，Taro 先例）
- Web 目标换算目标 = vw/rem（具体由编译目标定）

## 5. 文件级平台覆写（D9 路由）

约定：`页面名.<platform>.ts` 覆写 `页面名.ts` 的同名导出（如 `index.wechat.ts`）。**产物零 #ifdef**（不变量②）——覆写发生在编译期文件解析层。

## 6. 类型即生成物（D9 采纳）

组件/API 定义表 = 唯一事实源；`.d.ts` 是表的代码生成目标之一（table → WXML/JS/d.ts）。API typings 发布形态（独立 @omnilet/api-typings 包 vs 编译器输出）随 console/发布切片裁决（GAP-6）。

## 7. 兼容矩阵（占位）

@omnilet/runtime 垫片 ↔ 容器 SDK 版本的兼容矩阵（GAP-5）——golden 测试即矩阵行，随 T2 一致性 harness 落地。

## 7.5 路由与页面栈（D15-3）

`omnilet.navigateTo/...` = 向**宿主栈管家**递条子：页面栈、返回手势、系统返回键、旧页内存回收全在原生侧执行；业务逻辑层收导航快照同步认知（不自管栈、不双记账）。

## 8. web-view 组件（嵌套网页；D13 五卡裁决摘要）

- **入口唯一**：嵌套外部网页只用 `<web-view src>`（iframe 已入 §2 负清单）。
- **默认安全笼**（可关不可开）：脚本/同源数据=开；弹窗=默认拒（桥请求宿主审批，开的子窗仍是笼内窗）；顶层跳转=锁业务域名。
- **资格**：src 业务域名需**归属验证**（验证文件/DNS，对齐微信模型；console 后台管理，Phase 随后台设计细化）。
- **JSSDK 七件套**（H5 侧唯一话语权）：navigateTo / navigateBack / switchTab / reLaunch / redirectTo / postMessage / getEnv；容器注入通道 bootstrap，SDK 脚本走静态资源；postMessage 攒四时机（后退/销毁/分享/复制链接）批量送。
- **数据边界**：轻应用自身数据=隔离（不变量⑤）；第三方站点 cookie=按 Web 标准跨轻应用共享（Android 平台现实 + 业务正确性，D13-5）。
- **平台×模式矩阵（D14 定稿）**：标准模式全平台（=iframe 映射）。HMI 模式 web-view：Linux=✅ WPE OSR（§5.4）· Windows=✅ WebView2 Composition · **macOS=触发制（CefBackend/CEF windowless，D14）** · **iOS=范围外（平台矩阵不含 iOS HMI，非缺陷非不支持——D14/苹果政策事实）** · Android=路径存在（draw-canvas），承诺随移动 HMI 切片设计。


## 9. 能力总线命名（D17：编号即许可）

- 登记格式：`omnilet.<capability>.<method>`（不合规名字注册即拒）。
- **一个词三处用**：capability 段 = manifest 权限声明词 = 授权判定词 = 审计日志词，零映射表。
- 业务观感对齐 `chrome.<api>.<method>` 词形；wx.* 兼容面为独立产品策略议题（未裁）。
- **首落地词**：`storage`（`omnilet.storage.get/set`，T7 桥注册；派发/接收路已实测活，JS-可见腿待 CEF-07 注入裁决——见 SDD CEF-07）。
