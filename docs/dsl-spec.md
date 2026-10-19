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
