# uni-app 编译器内部机制（源码级地图）

> 本文是 [uniapp.md](uniapp.md) 的配套深读：uniapp.md 是竞品画像（外部可观测），本文是**源码内部地图**（包/文件/行号级证据）。
> 用途：OmniLet 编译侧（D5 轨道：table-driven compiler + 可换 kernel）的规则表 schema 与"静态翻译边界"设计证据。

**数据快照日期：2026-10-21**（实测 `git clone` + 逐文件阅读，非二次转述）

## 前置：仓库布局陷阱（*UNCERTAIN* 前先核对分支）

`dcloudio/uni-app` 的 `main` 分支**已经不是跨端框架源码**，它是 uni-app X 的 demo 仓（`package.json` name = `uni-app-x`，`src/` 是 `.uvue`/UTS 应用代码，只有 2 个 package.json）。Vue2/Vue3 编译器代码在独立分支：

| 分支 | HEAD SHA | 内容 |
|---|---|---|
| `uni-app-vue3-dev` | `c29c15de9430d45f8bb64155a7f821eea11ead5a` | Vue3 + Vite + uni-app X 编译栈 —— **本文主证据** |
| `uni-app-vue2-dev` | `e3251e663e37c0f0ce0ea78c775b5727d15bb20c` | Vue2 + webpack 编译栈 |
| `main` | `cc29a4a70b17ec9139430adbaa261637dac9edc0` | uni-app X demo（`src/`，无 `packages/`） |

**Permalink 基址**：`https://github.com/dcloudio/uni-app/blob/<上表SHA>/packages/<path>#L<start>-L<end>`

## 0. 结论先行（纠正常见误述）

1. uni-app 的 **Vue2 与 Vue3 小程序路径都是"静态模板翻译到 WXML + 数据 diff 运行时"**。两条路径都**不是** Taro 式运行时 vdom。
2. 因此"Vue2 静态 / Vue3 运行时"这个说法在源码层面**不成立**。真实差别是 IR 深度（Vue2 多一次 Babel 二次编译）与平台规则的表达形态（Vue2 用 `vue-template-compiler` 的 `modules` 钩子注入，Vue3 用 `MiniProgramCompilerOptions` 参数表 + `nodeTransforms`）。
3. **真正的"放弃纯静态翻译"边界，是一批无法静态表达的能力**：scoped slot / 虚拟节点合并 / 惰性挂载 / DOM 查询 / 表达式过滤器 / 组件 v-show / 组件挂载时序。见 §3 表格。
4. 代价：**每个小程序包内置一份 5,410 行 / 177 KB 的 Vue 3.4.21 runtime-core fork**（`uni-mp-vue/lib/vue.runtime.esm.js`）。
5. 规则表**不是纯声明式**：是"标量/布尔/表 + 函数钩子"的混合体。详见 §2。

---

## 1. 模板编译链：谁解析 SFC、什么 IR、WXML 从哪来

### 1.1 Vue3 链路（uni-app-vue3-dev）

编译器是 `@vue/compiler-core` 的**部分 fork**：只复用 parser 和 AST 节点类型，transform 驱动与 JS codegen 全部重写，并新增第二个 WXML codegen。

**依赖自证**（`packages/uni-mp-compiler/package.json`）：
`dependencies` = `@babel/generator`、`@babel/parser`、`@babel/types`、`@vue/compiler-core`、`@vue/compiler-dom`、`@vue/shared`、`@dcloudio/uni-cli-shared`、`@dcloudio/uni-shared`、`estree-walker`；`devDependencies` 才有 `@vue/compiler-sfc`。**不依赖 `@vue/compiler-sfc`** → 它不是 SFC 编译器，只是 template compiler。

**完整链路**：

```
.vue / .nvue / .uvue
 │
 ├─ @vitejs/plugin-vue
 │    vueOptions.compiler       ←── 见下
 │    vueOptions.template.compilerOptions.miniProgram ←── 见下
 │
 └─ @dcloudio/uni-mp-compiler
      parse(template, opts)  / compile(template, opts)
        └─ baseParse(template, {parseMode:'html'})     ← 唯一复用的 Vue 部件
      baseCompile()
        ├─ getBaseTransformPreset()   ← 转换顺序硬编码，非表
        ├─ transform()                ← 重写的转换驱动
        ├─ generate()                 ← 输出1.：JS render 函数代码
        └─ genTemplate()              ← 输出2.：WXML 字符串
             └─ options.miniProgram.emitFile({type:'asset', source})
                  │
                  └─ uni-mp-vite 捕获进内存缓存 → generateBundle 阶段 emitFile(*.wxml)
```

**关键行号证据**：

| 事实 | 位置 |
|---|---|
| `parse()` / `compile()` 入口，内部调 `baseParse(template, extend({}, parserOptions, options))` | `uni-mp-compiler/src/index.ts#L29-L43` |
| `baseCompile()` 主体 | `uni-mp-compiler/src/compile.ts#L68-L167` |
| transform 顺序**硬编码在函数里**，注释写明 "order is important" | `uni-mp-compiler/src/compile.ts#L35-L66` |
| `emitFile({type:'asset', fileName, source: context.code})` 抛 WXML | `uni-mp-compiler/src/template/codegen.ts#L131` |
| `uni-mp-vite` 侧的 `emitFile` 接收端（写进 `templateFilesCache`） | `uni-mp-vite/src/plugin/template.ts#L69-L88` |
| `generateBundle` 阶段把缓存刷成 `*.wxml` asset | `uni-mp-vite/src/plugin/index.ts#L256-L263` |

**编译器是谁注进 SFC 解析器的**（这是整条链的锚点）：

- `uni-mp-vite/src/plugin/uni/index.ts#L17`：`import * as compiler from '@dcloudio/uni-mp-compiler'`
- `uni-mp-vite/src/plugin/uni/index.ts#L40`：`compiler: compiler as TemplateCompiler` —— 强转后交给 `@vitejs/plugin-vue`
- `uni-mp-vite/src/plugin/uni/index.ts#L41-L53`：`compilerOptions: { miniProgram: extend({}, miniProgram, { component: ... }), ...compilerOptions, nodeTransforms: [...] }`
- `vite-plugin-uni/src/vue/options.ts#L115-L164`：从 `uniPluginOptions` 解构 `compiler` / `miniProgram` / `nodeTransforms` 并合并进 `vueOptions`
- `vite-plugin-uni/src/vue/options.ts#L102-L105`：`const compilerOptions = templateOptions.compilerOptions || (templateOptions.compilerOptions = {})`

**`miniProgram.emitFile` 的注入点**：`uni-mp-vite/src/plugin/index.ts#L145-L164`，把 `event`/`class`/`filter`/`directive`/`lazyElement`/`component`/`slot`/`checkPropName` 与 `emitFile` 一起塞进 `miniProgram` 对象。

**转换顺序**（`uni-mp-compiler/src/compile.ts#L43-L61`）：
`transformRoot` → `transformVBindAttrs` → `transformAttr` → `transformTag` → `transformHtml` → `transformText` → `transformIf` → `transformFor` → `transformSlot` → `transformIdentifier`（可跳过）→ `transformElement` → `transformComponent` → `transformExpression`（仅 `prefixIdentifiers` 时）；directive transforms 只有 `on` 和 `bind`。

**IR 结论**：**全程只有一个 IR** = Vue 3 的 `TemplateNode` AST（`RootNode` / `ElementNode` / `DirectiveNode` / `SimpleExpressionNode`）。**没有平台层 IR**。平台差异全部靠"transform 改 AST + codegen 读 options"在同一棵 AST 上表达。

**编译器源码规模**（`uni-mp-compiler/src/`，共 11,152 行）：

| 文件 | 行数 | 职责 |
|---|---|---|
| `transform.ts` | 789 | 重写的转换驱动（Vue 原版是 compiler-core 内置） |
| `template/codegen.ts` | 693 | **WXML 代码生成**（本文重点） |
| `transforms/transformIdentifier.ts` | 922 | 标识符重写（表达式里能用什么名字） |
| `codegen.ts` | 453 | JS render 函数代码生成 |
| `transforms/vFor.ts` | 488 | `v-for` → `wx:for` |
| `transforms/vSlot.ts` | 422 | 作用域插槽 |
| `transforms/transformComponent.ts` | 396 | 组件节点 |
| `transforms/transformExpression.ts` | 384 | 表达式前缀化 |
| `transforms/vModel.ts` | 367 | |
| `transforms/utils.ts` | 368 | |
| `transforms/transformClass.ts` | 313 | |

| `transforms/vOn.ts` | 297 | `v-on` → `bind`/`catch`/`capture-*` |
| `transforms/transformStyle.ts` | 284 | |
| `transforms/transformElement.ts` | 281 | |
| `transforms/transformUniElement.ts` | 283 | DOM 查询用元素 id |
| `transforms/transformSlot.ts` | 248 | |
| `transforms/vIf.ts` | 215 | `v-if` → `wx:if` |
| `transforms/transformRef.ts` | 168 | |
| `transforms/transformVBindAttrs.ts` | 146 | |
| `transforms/transformHidden.ts` | 113 | `v-show` → `hidden` |
| `transforms/transformRoot.ts` | 119 | |
| `ast.ts` | 148 | |
| `identifier.ts` | 102 | |
| `decodeHtml.ts` | 133 | |
| `options.ts` | 120 | |
| `parserOptions.ts` | 77 | |
| `runtimeHelpers.ts` | 44 | |

> 测试目录 `__tests__/` 有 34 个 spec 文件（`vFor.spec.ts` 656 行、`uniElement.spec.ts` 463 行），是读"某个语法最终生成什么 WXML"的最快入口。

### 1.2 Vue2 链路（uni-app-vue2-dev）

Vue2 是**三段式**，多一次"把生成的 render 函数再解析回 AST"：

```
.vue SFC
 └─ webpack vue-loader (compiler = @dcloudio/uni-template-compiler)
     ├─ uni-template-compiler/lib/index.js#L40-L106
     │    require('@dcloudio/vue-cli-plugin-uni/packages/vue-template-compiler')   ← Vue2 compiler 又被 fork
     │    compileTemplate(source, options, compile)  →  res.render（JS render 函数字符串）
     ├─ lib/index.js#L138
     │    parser.parse(`function render(){${res.render}}`)   ← 2. Babel 二次编译成 AST
     ├─ traverseScript + generateScript  → 输出1.：JS
     └─ traverseTemplate + generateTemplate → 输出2.：WXML 字符串
          (lib/template/generate.js#L124-L201)
```

**关键行号证据**：

| 事实 | 位置 |
|---|---|
| 依赖的是 fork 过的 `vue-template-compiler`（不是官方包） | `uni-template-compiler/lib/index.js#L5-L11` |
| 强制 `optimize: false`（关掉 staticRenderFns 静态节点提升） | `uni-template-compiler/lib/index.js#L104-L106` |
| 二次编译：`parser.parse(`function render(){${res.render}}`)` | `uni-template-compiler/lib/index.js#L138` |
| 双输出：`res.render = generateScript(...)` / `template = generateTemplate(...)` | `uni-template-compiler/lib/index.js#L141-L144` |
| `emitFile` 注释里明写"方案1/方案2"权衡 | `uni-template-compiler/lib/index.js#L179-L196` |
| WXML 由 `options.emitFile(options.resourcePath, template)` 抛出 | `uni-template-compiler/lib/index.js#L255` |
| scoped slot 走 `res.generic` / `res.componentGenerics` + 回调 | `uni-template-compiler/lib/index.js#L158-L164`、`#L269-L288` |

**Vue2 的"模块"机制** = `vue-template-compiler` 原生的 compiler module 钩子（`preTransformNode` / `postTransformNode`），uni-app 用文件堆叠注入平台规则：`module.js`、`module.uniad.js`、`module-alipay.js`、`module-toutiao.js`、`asset-url.js`、`bool-attr.js`、`app/service.js`、`app/view.js`。这是**代码钩子式**，不是声明式表。

**Vue2 编译器规模**：`uni-template-compiler/lib/` 共 6,793 行（`template/traverse.js` 633、`script/traverse/data/event.js` 581、`util.js` 398、`index.js` 299、`native-tags.js` 188）。

---

## 2. 平台规则在哪：有表，但是"表 + 函数钩子"两层

### 2.1 规则表的类型定义（schema 源头）

`packages/uni-cli-shared/src/mp/template.ts#L23-L103` 的 `MiniProgramCompilerOptions` 接口 —— **这就是 uni-app 平台规则表的 schema**：

```ts
export interface MiniProgramCompilerOptions {
  checkPropName?: (name, prop, node) => boolean          // 函数：华为快应用禁 key 等
  lazyElement?: { [tag]: {name:'on'|'bind', arg:string[]}[] | true } | LazyElementFn  // 表 或 函数
  event?: { key?: boolean; format?(name, {isCatch,isCapture,isComponent}): string }   // bool + 函数
  class: { array: boolean }                              // 纯标量
  slot: { $slots?: boolean; fallbackContent?: boolean; dynamicSlotNames?: boolean }   // 纯标量
  filter?: { lang: string; setStyle?: boolean; generate?: GenFilterFn }               // 字符串 + 函数
  component?: {
    ':host'?: boolean
    dir?: string          // 'wxcomponents'
    vShow?: string        // 组件自定义 hidden 属性名
    getPropertySync?: boolean
    normalizeName?: (name: string) => string            // 函数：wx- → weixin-
    mergeVirtualHostAttributes?: boolean
  }
  directive: string       // 'wx:'
  emitFile?: (emittedFile: EmittedAsset) => string
}
```

配套 `MiniProgramFilterOptions`（`#L104-L110`）与 `GenFilterFn`（`#L112-L115`）。

**规则表混合度统计**（18 个字段）：纯标量/字符串 9 个（`directive`、`class.array`、`slot.*`×3、`component.dir`、`component.vShow`、`component[':host']`、`component.getPropertySync`、`component.mergeVirtualHostAttributes`、`filter.lang`、`filter.setStyle`）；**函数 7 个**（`checkPropName`、`event.format`、`filter.generate`、`component.normalizeName`、`emitFile`、`lazyElement` 本身可为函数、`GenFilterFn`）；**纯表 1 个**（`lazyElement` 的对象形态）。

> 结论：约 **40% 的字段必须是代码**，纯 JSON 规则表装不下。

### 2.2 微信端的具体取值

`packages/uni-mp-weixin/src/compiler/options.ts`（235 行）：

| 规则 | 值 | 行号 |
|---|---|---|
| `class.array` | `true` | `#L101-L103` |
| `slot.fallbackContent` / `slot.dynamicSlotNames` | `false` / `true` | `#L104-L107` |
| `event.key` | `true` | `#L108-L110` |
| `directive` | `'wx:'` | `#L111` |
| `lazyElement` | canvas / editor / scroll-view / picker-view / input / textarea / movable-view / store-home | `#L112-L138` |
| `component[':host']` | `true` | `#L140` |
| `component.dir` | `'wxcomponents'` | `#L95`、`#L141` |
| `component.vShow` | `COMPONENT_CUSTOM_HIDDEN` | `#L142` |
| `component.getPropertySync` | `isX`（uni-app X 下才开） | `#L144` |
| `component.normalizeName` | `name.startsWith('wx-') ? name.replace('wx-','weixin-') : name` | `#L145-L146` |
| `filter.lang` / `filter.extname` | `'wxs'` / `'.wxs'` | `#L148-L151`、`#L217-L218` |
| `filter.generate` | 生成 `<wxs src="…" module="…"/>` 或内联 `<wxs module="…">…</wxs>` | `#L219-L226` |
| `template.extname` / `style.extname` | `'.wxml'` / `'.wxss'` | `#L228`、`#L231-L233` |
| `template.customElements` | 60+ 原生组件名单（`ad-custom`…`voip-room`）+ `getNativeTags()` 动态补 | `#L28-L71` |
| `compilerOptions.nodeTransforms` | `transformRef` / `transformComponentLink` / `transformAd` / `transformTeleport` | `#L73-L78` |
| 按 env 追加 transform | `UNI_APP_X_VAPOR==='true'` → `transformWaterflow`；`UNI_APP_X==='true'` → `transformMPBuiltInTag`/`transformDirection`/`transformLoading` | `#L80-L89` |
| Vite `define` | `__VUE_CREATED_DEFERRED__: false` | `uni-mp-weixin/src/compiler/index.ts#L10-L12` |


### 2.3 纯声明式的那部分：HTML → 小程序标签映射表

`packages/uni-cli-shared/src/mp/tags.ts#L1-L120` 的 `HTML_TO_MINI_PROGRAM_TAGS` 是**真正的声明式表**，在 `uni-mp-compiler/src/transforms/transformTag.ts` 里套用。摘录：

```ts
export const HTML_TO_MINI_PROGRAM_TAGS: Record<string, string> = {
  a: 'navigator', link: 'navigator', area: 'navigator',
  img: 'image',
  select: 'picker', datalist: 'picker',
  span: 'label',
  // 其余（p/h1-h6/div/ul/ol/li/table…）全部 'view'
  meter: 'progress',  // todo
  base: 'text',       // todo
}
```

另有 `SELF_CLOSING_TAGS: ['input']`（百度需自闭合）。

### 2.4 规则表被消费的位置（表 → 产物的落点）

| 规则字段 | 消费位置 | 效果 |
|---|---|---|
| `directive` | `template/codegen.ts#L224-L232` `genVIf`/`genVElseIf`/`genVElse` | 拼 `wx:if` / `wx:elif` / `wx:else` |
| `directive` | `template/codegen.ts#L234-L252` `genVFor` | 拼 `wx:for` / `wx:for-item` / `wx:for-index` / `wx:key` |
| `event.format` | `template/codegen.ts#L617-L638` `genOn` | 拼 `bind:xxx` / `catch:xxx` / `capture-*`；`isStatic` 决定要不要 `{{}}` |
| `lazyElement` | `template/codegen.ts#L418-L451` `isLazyElement` + `#L457-L479` `genLazyElement` | 命中元素包 `<block wx:if="{{r0}}">…</block>` |
| `slot.fallbackContent` | `template/codegen.ts#L254-L330` `genSlot` | 是否生成 fallback 分支 |
| `class.array` | `transforms/transformClass.ts`（313 行） | class 能否绑定数组 |
| `component.normalizeName` | `template/codegen.ts#L514-L523` | 组件标签改名 |
| `component.vShow` | `template/codegen.ts#L640-L673` `genDirectiveNode` 的 `show` 分支 | `v-show` → 组件自定义 prop |
| `component.getPropertySync` | `template/codegen.ts#L392-L416` `genComponent` | 决定要不要走 `uP` 同步取值 |
| `filter.generate` | `template/codegen.ts#L117-L130` + `uni-mp-vite/src/plugin/index.ts#L213-L263` | Vue filter 抽成 `.wxs` 文件 |
| `checkPropName` | `template/codegen.ts#L580-L616` `genElementProps` | 白名单过滤属性 |
| `HTML_TO_MINI_PROGRAM_TAGS` | `transforms/transformTag.ts` | 标签替换 |

### 2.5 小结：规则表是"双层结构"

**数据层**（可搬进 JSON 表）：`directive`、`extname`、`style.extname`、`class.array`、`slot.*`、`event.key`、`component.dir`、`component.vShow`、`component[':host']`、`component.getPropertySync`、`component.mergeVirtualHostAttributes`、`filter.lang`、`lazyElement` 的对象形态、`customElements` 名单、`HTML_TO_MINI_PROGRAM_TAGS`。

**代码层**（只能是具名函数）：`event.format`、`component.normalizeName`、`filter.generate`、`checkPropName`、`lazyElement` 的函数形态、`emitFile`、以及整个 `nodeTransforms` 数组。

> 平台端注册入口的组装：`uni-mp-vite/src/plugin/uni/index.ts#L27-L53` 把 `miniProgram`（数据层）与 `compilerOptions`（代码层，含 `nodeTransforms`）拼成一个对象交给 `@vitejs/plugin-vue`。

---

## 3. Vue3 路径的运行时：`@dcloudio/uni-mp-vue` + setData diff

### 3.1 它背了多重的运行时

| 项 | 值 | 证据 |
|---|---|---|
| `uni-mp-vue/lib/vue.runtime.esm.js` | **5,410 行 / 177 KB** | 文件头 `#L1-L8`：`@dcloudio/uni-mp-vue v3.4.21` + `(c) 2018-present Yuxi (Evan) You and Vue contributors` |
| 它是什么 | **整份 Vue 3.4.21 runtime-core 的 fork** | 头部 `#L6` 只从 `@vue/shared` 和 `@dcloudio/uni-shared` 引入工具函数，其余全内联 |
| `uni-mp-weixin/dist/uni.mp.esm.js` | **33 KB** | 平台胶水层 |
| `uni-mp-core/src/` | **4,252 行** | `component.ts` 300 / `componentProps.ts` 262 / `util.ts` 251 / `componentInstance.ts` 242 / `page.ts` 168 / `app.ts` 186 / `fixSetData.ts` |
| `defineAsyncComponent` | 直接 `console.error("defineAsyncComponent is unsupported")` | `vue.runtime.esm.js#L4588-L4590` |

对照：Vue2 分支的 `uni-mp-vue` dist = 176 KB，`uni-template-compiler` dist = 198 KB。

**Vue3 运行时**删掉的东西（在 5,410 行里 grep 计数为 **0**）：`nodeOps`、`createRenderer`、`patchProp`。**Vue 的 DOM renderer 被整个移除**，只剩 reactivity + scheduler + mp 桥接。

### 3.2 setData diff 的核心三步

```
1. diff(current, pre)                          vue.runtime.esm.js#L4592-L4596
   → syncKeys() 算出 delta 对象

2. 更新入口（page / component）                vue.runtime.esm.js#L4819-L4837
   data.r0 = 1                                  ← 首次渲染完成标记
   diffData = diff(data, oldData || getMPInstanceData(mpInstance, keys))
   if (Object.keys(diffData).length) {
     ctx.__next_tick_pending = true
     mpInstance.setData(diffData, () => {
       ctx.__next_tick_pending = false
       flushCallbacks(instance)
     })
   }

3. scoped slot 独立通道                        vue.runtime.esm.js#L5163-L5194
   scopedSlotsData.forEach(({path, index, data}) => {
     diffPath = isString(index) ? `${path}.${index}` : `${path}[${index}]`
     diffData[diffPath] = data                // 新增
     // 或 diffData[diffPath + '.' + name] = …  // 变更
   })
   mpInstance.setData(diffData)
```

`getMPInstanceData(instance, keys)`（`#L4802` 起）从平台实例的 `data` 里按键取旧值做基线。`deepCopy`（`#L4798-L4800`）用 `WeakMap` 循环引用保护。

**机制定性**：这**不是** Taro 式"运行时 vdom 逐节点打补丁"。WXML 由平台原生渲染器渲染；Vue 只负责把响应式状态压成"能塞进 `setData` 的 JSON delta"。**VNode 树不参与渲染**，只在编译期决定哪些字段要进 data。

### 3.3 "放弃纯静态翻译"的边界清单（本文最核心的产出）

以下每一条都是**无法用 WXML 静态表达、被迫下沉到运行时**的能力。这就是 DCloud 实际放弃纯静态翻译的地方：

| 能力 | 静态产物（编译期） | 运行时依赖（运行时） | 证据 |
|---|---|---|---|
| **virtualHost 合并**（组件把 props 上的 class/style 合并到根节点） | WXML 加 `virtualHostStyle="{{virtualHostStyle}}"`、`virtualHostClass`、`virtualHostHidden` | runtime 计算合并值 | `template/codegen.ts#L562-L578` `checkVirtualHostProps` |
| **lazyElement 惰性挂载** | 包 `<block wx:if="{{r0}}">` | `r0` = 首次 render 完成标记 | `template/codegen.ts#L461-L462`、runtime `#L4821` |
| **scoped slot** | 数据按 data-path 序列化进 setData | `r1: 1` 触发二次 setData + `setValueByDataPath` | runtime `#L4913-L4919`、`#L5163-L5194` |
| **uniElement（DOM 查询 API）** | `u-e` 元素 id 属性（`ATTR_ELEMENT_ID`） | runtime 生成 id；`SET_UNI_ELEMENT_ID` / `GEN_UNI_ELEMENT_ID` helper | `uni-mp-compiler/src/runtimeHelpers.ts`；`template/codegen.ts` `ATTR_ELEMENT_ID` 忽略生成 |
| **filter（表达式过滤器）** | 抽成独立 `.wxs` 文件 + `<wxs src>` 标签 | **视图层**执行，JS 层无法调用 | `template/codegen.ts#L117-L130`、`uni-mp-weixin/src/compiler/options.ts#L219-L226` |
| **v-show on component** | 转成 `hidden` 或组件自定义 prop | 组件需实现该 prop | `template/codegen.ts#L640-L673`、`transformHidden.ts`（113 行） |
| **组件挂载时序** | `<view wx:if="{{r0}}">` | `r0` | runtime `#L4821` |
| **事件** | `bind:` / `catch:` / `capture-*` 前缀 | runtime 事件转发 + `INTERNAL_EVENT_LINK` 链接事件 | `template/codegen.ts#L617-L638` |
| **ref 时序** | `u-e` + data-ref | `r1: 1` 二次 setData 后再 setTemplateRef | runtime `#L4907-L4919` |
| **静态节点提升** | `compilerOptions.hoistStatic = false` | —— | `vite-plugin-uni/src/vue/options.ts#L275-L276` 注释：`// App,MP 平台不支持使用静态节点` |

### 3.4 Vue2 侧的对应限制

- `options.optimize = false` 强制关掉 staticRenderFns（`uni-template-compiler/lib/index.js#L104-L106`）
- scoped slot 只能靠 `res.generic` / `res.componentGenerics` + `updateGenericComponents` 回调外挂（`#L158-L164`、`#L269-L288`）
- 平台规则用 `vue-template-compiler` 的 `modules` 钩子注入，而非参数表

**所以准确表述是**：Vue3 相对 Vue2 的进步是 (a) IR 从三段收敛为一段 AST；(b) 平台规则从"代码钩子堆叠"变成"参数表 + 具名 transform"；(c) 借 Vue3 指令 transform 体系把 scoped slot / v-slot 表达得更完整。**但它没有放弃运行时，两条路径运行时同样重**（各约 176–177 KB 的 Vue runtime fork）。


---

## 4. 条件编译：三层实现

### 4.1 A 层（主力）：注释式预处理器 `@dcloudio/uni-preprocess`

`packages/uni-preprocess/src/preprocess.ts`（236 行）。**纯编译期文本预处理，零运行时开销**。

**实现**：`magic-string` + `xregexp.matchRecursive` 做区间删除，保留 source map（`#L13-L89`）。

**语法**（`#L99-L107` 的正则）：

```
JS/TS/CSS:   // #ifdef MP-WEIXIN   …   // #endif          (/* #ifdef */ 亦可)
HTML 模板:   <!-- #ifdef MP-WEIXIN -->  …  <!-- #endif -->
```

**条件求值**（`#L216-L236`）——注意是**直接 eval**：

```ts
function getTestTemplate(test: string) {
  test = test || 'true'
  test = test.replace(/-/g, '_')            // MP-WEIXIN → MP_WEIXIN
  return new Function('context',
    'with (context||{}){ return ( ' + test + ' ); }')
}
```

所以条件表达式可以是任意 JS 布尔表达式：`MP-WEIXIN`、`MP-WEIXIN || MP-QQ`、`uniVersion >= 3.5`。

**两种指令**：`#ifdef`（真则保留）/ `#ifndef`（真则删除），见 `#L52-L73`。

**错误处理**（`uni-cli-shared/src/preprocess/index.ts#L155-L189`）：`#ifdef`/`#endif` 不配对时捕获 `Unbalanced delimiter`，**降级为原样输出 + `console.error`，不中断构建**（`return code`）。另有 `ERRORS` 提示模板（`#L122-L144`）分别给 html/js/css 三种语法示例。

**按 SFC 块分派的入口**（`uni-cli-shared/src/preprocess/index.ts#L35-L120`）：`preJs` / `preHtml` / `preCss` / `preJson`，分别对应 `<script>` / `<template>` / `<style>` / json 文件；还有 `preNVue*` 和 `preUVue*`（uni-app X）两套上下文。

**条件上下文**（`uni-cli-shared/src/preprocess/context.ts`）：

`DEFAULT_KEYS`（`#L11-L44`）是**声明式布尔键表**，全部默认 `false`，按 platform 置 `true`：

```
UNI_APP_X, APP, APP_UVUE, APP_NVUE, APP_PLUS, APP_PLUS_NVUE, APP_VUE,
APP_ANDROID, APP_IOS, APP_HARMONY, APP_HARMONY_JSVM,
H5, WEB, MP, MP_360, MP_ALIPAY, MP_BAIDU, MP_HARMONY, MP_QQ, MP_LARK,
MP_TOUTIAO, MP_WEIXIN, MP_KUAISHOU, MP_JD, MP_XHS,
QUICKAPP_NATIVE, QUICKAPP_WEBVIEW, QUICKAPP_WEBVIEW_HUAWEI, QUICKAPP_WEBVIEW_UNION,
VUE2, VUE3, VUE3_VAPOR
```

外加 `uniVersion = parseFloat(process.env.UNI_COMPILER_VERSION)`（`#L77`）。

平台归一化逻辑（`#L62-L144` `initScopedPreContext`）：`platform.startsWith('mp-')` → `MP=true`；`h5` → `WEB=true`；`app`/`app-plus`/`app-harmony` → `APP=true` 等。支持用户自定义 key 注入（`#L125-L138`，`userPreContext` 可传对象或 JSON 字符串）。键名归一化：`normalizeKey = name.replace(/-/g,'_').toUpperCase()`（`#L168-L170`）。

### 4.2 B 层（易混淆）：模板内的平台指令 ≠ 条件编译

`wx:if` / `wx:for` / `wx:elif` 是**平台规则翻译**，不是条件编译。由 `template/codegen.ts#L224-L252` 的 `genVIf` / `genVElseIf` / `genVElse` / `genVFor` 根据 `options.miniProgram.directive`（微信为 `'wx:'`）在 **codegen 阶段**拼出来。它与 `#ifdef` 完全无关，一个跑在编译前的文本层，一个跑在 AST codegen 层。

### 4.3 C 层：文件后缀 —— Vue SFC **没有**平台后缀机制

`uni-cli-shared/src/constants.ts#L2-L9` 的扩展名表是**固定**的、与平台无关：

```ts
export const EXTNAME_VUE = ['.vue', '.nvue', '.uvue']
export const X_EXTNAME_VUE = ['.uvue', '.vue']
export const EXTNAME_VUE_RE = /\.(vue|nvue|uvue)$/
export const PAGE_EXTNAME = ['.vue', '.nvue', '.tsx', '.jsx', '.js']
export const X_PAGE_EXTNAME = ['.uvue', '.vue', '.tsx', '.jsx', '.js']
```

`resolve.ts#L19-L20` 按 `UNI_APP_X` 二选一，**没有** `.mp-weixin.vue` 这类平台后缀解析。全仓 grep `.mp-weixin.` 只命中 `uni-stat/src/plugin/index.ts`（打点插件的统计文件名，与源码选择无关）。

**平台维度分文件只存在于两处**：

1. **配置文件的平台键**：`pages.json` / `manifest.json` 的 `manifestJson['mp-weixin']` 等（见 `uni-cli-shared/src/utils.ts#L264-L276`，用 platform 取 appid 拼 ident）
2. **uni-app X 的 UTS 平台目录**：`uts/ios/`、`uts/android/` 这类目录后缀（编译到 Kotlin/Swift 的语言层，与 Vue 编译链无关）

> 所以对 OmniLet 而言：**条件编译只需要做注释预处理 + 配置平台键两件事**，不需要文件后缀解析。这是可以省掉的一整层。


---

## 5. 样式：作用域 / externalClasses / rpx / wxss

管线是 **PostCSS 插件链**，与模板 codegen 完全解耦。

### 5.1 作用域 `uni-sfc-scoped`

`uni-cli-shared/src/postcss/plugins/stylePluginScoped.ts`（241 行）：

- **自适应**：先检测 PostCSS 链里是否已有 `vue-sfc-scoped`，没有才自己启用（`#L8-L11`、`#L23-L31`）
- **旧语法兼容**：`::v-deep` / `>>>` / `/deep/` → 现代 `:deep()`（`#L89-L110`）
- **自定义 `::part()`**：`::part(name)` → `:deep(.<partClass>)`（`#L47-L83` `_rewritePartSelector`），与 compiler 的 `MERGE_PART_CLASS` runtime helper 配套
- **跳过 `@keyframes` 内部规则**（`#L23-L31`）
- 注册点：`vite-plugin-uni/src/vue/options.ts#L98-L100`（`styleOptions.postcssPlugins.push(uniPostcssExternalPlugin())`）

### 5.2 externalClasses 提权 `uni-external`

`uni-cli-shared/src/postcss/plugins/stylePluginExternal.ts`（220 行）：

- **仅 `mp-*` 平台生效**，非 mp 直接 return（`#L33-L35`）
- **只处理页面文件**，组件样式不动（`#L49-L52`）
- dev 模式一律 `hasDynamic = true`（`#L60-L62`）
- 核心规则（文件头注释 `#L11-L23`）：`.a` → `.a[class]`，**用 `[class]` 属性选择器提升优先级**，而非插入 `page` 包裹节点
- 支付宝隔离 2.0 走另一套：按来源加前缀 `-a-`（App）/ `-p-`（页面）/ `-c-`（组件）（`#L86-L110`）

### 5.3 rpx：编译期 PostCSS 转换 + 运行时兜底

| 层 | 位置 | 内容 |
|---|---|---|
| 注册入口 | `uni-app-vite/src/vue/plugin/index.ts#L40-L45` | `initPostcssPlugin({ uniApp: parseRpx2UnitOnce(inputDir, process.env.UNI_PLATFORM) })` |
| 转换规则 | `uni-cli-shared/src/postcss/plugins/uniapp.ts` | `rpx` ×5 |
| 特性开关 | `uni-cli-shared/src/vite/features.ts` | `rpx` ×5 |
| manifest 配置读取 | `uni-cli-shared/src/json/manifest.ts` | `rpx` ×4 |
| 运行时兜底 | `uni-api/src/service/base/upx2px.ts` | `uni.upx2px()` 走 `windowWidth` 换算（`rpx` ×4 / `windowWidth` ×6） |
| H5 独立一套 | `uni-h5/dist-x-vapor/uni-h5.es.js` | `rpx` ×21 / `windowWidth` ×27 |
| 全局配置 | `pages.json` → `globalStyle.rpxCalcMaxDeviceWidth` / `rpxCalcBaseDeviceWidth` | 写入 `__uniConfig`（`uni-app-vite/src/vue/plugin/index.ts#L134-L138`） |
| rem 方案（X 端） | `uni-core/src/view/init/rem.ts`、`uni-core/src/helpers/util.ts` | 另一条换算路径 |

### 5.4 wxss 产物

- 扩展名：`template.extname = '.wxml'`、`style.extname = '.wxss'`（`uni-mp-weixin/src/compiler/options.ts#L228`、`#L231-L233`）
- `.wxml` 走 template codegen 的 `emitFile` 内存缓存 → `generateBundle` 落盘（`uni-mp-vite/src/plugin/template.ts#L60-L88`、`src/plugin/index.ts#L256-L263`）
- `.wxss` 走 PostCSS 常规 chunk 输出
- **`build.assetsInlineLimit = ASSETS_INLINE_LIMIT`（40 KB）**（`uni-mp-weixin/src/compiler/index.ts#L13-L17`；常量在 `uni-cli-shared/src/constants.ts#L38`）—— 注释明写 **"css 中不支持引用本地资源"**，所以 CSS 里的本地图片强制 base64 内联
- `uni.scss` 走 PostCSS 的 scss 管线；`uni-nvue-styler` 包单独处理 nvue 样式

---

## 6. 包与产物规模总览

**Vue3 栈包清单**（`uni-app-vue3-dev/packages/`，mp 相关）：

| 包 | 职责 |
|---|---|
| `uni-mp-compiler` | mp 模板编译器（Vue compiler-core 部分 fork，11,152 行 src） |
| `uni-mp-vue` | 内置的 Vue runtime fork（`lib/vue.runtime.esm.js` 5,410 行 / 177 KB） |
| `uni-mp-core` | mp 运行时公共层（4,252 行：component/page/subpackage/fixSetData/api） |
| `uni-mp-vite` | Vite 插件宿主（7,636 行：`uni:mp` 插件、template emitFile、filter 收集） |
| `uni-mp-weixin` | 微信端（`compiler/options.ts` 规则表 + `dist/uni.mp.esm.js` 33 KB） |
| `uni-preprocess` | 条件编译预处理器（236 行） |
| `uni-cli-shared` | 跨端共享（256 个 src 文件：规则表类型、标签表、PostCSS 插件、resolve） |
| `vite-plugin-uni` | CLI 入口（5,826 行：把 compilerOptions 塞进 `@vitejs/plugin-vue`） |
| `uni-app-vite` | app 端（43 个 src 文件） |
| `uni-h5-vite` / `uni-h5-vue` | H5 |

**Vue2 栈独有包**：`uni-template-compiler`（6,793 行 lib）、`vue-cli-plugin-uni`、`vue-cli-plugin-hbuilderx`、`vue-cli-plugin-uni-optimize`、`webpack-uni-mp-loader`、`webpack-uni-pages-loader`、`uni-cli-i18n`、`uni-migration`、`uni-h5-ui`、`uni-quickapp-native`。**无** `uni-mp-compiler`、`uni-preprocess`、`vite-plugin-uni`、`uni-mp-core`。

**js-bundle 实测体积**：

| 包 | Vue2 | Vue3 |
|---|---|---|
| `uni-mp-vue` | 176 KB | 338 KB（含 dist + lib 177 KB） |
| `uni-mp-weixin` | 176 KB | 96 KB（dist 33 KB） |
| `uni-template-compiler` | 198 KB | ——（已被 `uni-mp-compiler` 取代，无 dist） |
| `uni-mp-compiler` / `uni-mp-core` / `uni-preprocess` | —— | 无 dist（TS-only 提交） |

---

## 7. 对 OmniLet 编译侧的三条可直接搬走的证据

> 以下为**推断**（非源码直接陈述），供 D5 轨道的规则表 schema 讨论用。

1. **"表驱动"必须设计成三层，纯 JSON 不够用。** uni-app 的规则表 18 个字段里约 7 个必须是代码（`event.format`、`component.normalizeName`、`filter.generate`、`checkPropName`、`lazyElement`、`emitFile`、`nodeTransforms`）。建议 OmniLet 的规则表 schema 预留 `hooks: [string]` 字段指向 kernel 内的**具名 transform**，而不是在 JSON 里塞逻辑 —— 否则要么表达能力不够，要么就得自己造一门 DSL。

2. **不要加平台层 IR。** uni-app 全程只有一棵 Vue `TemplateNode` AST，平台差异靠"transform 顺序 + codegen 读 options"表达。代价可见：它不得不用**两个 codegen**（JS + WXML）外加一个 **789 行的自研 `transform.ts`**。多一层平台 IR 等于维护第二个编译器。

3. **"静态翻译边界"要在定 DSL 语法之前先划清楚。** 能静态表达的（`v-if`/`v-for`/`v-on`/`class`/`style`/标签映射/属性白名单）走规则表；必须下沉的（scoped slot / 虚拟节点合并 / 惰性挂载 / DOM 查询 / 表达式过滤器 / 组件 v-show / ref 时序 / 组件挂载时序）要在规则表里显式标 `runtime: true` —— 因为 §3.3 表格里每一条都要在运行时留一个对应的 diff 通道，漏一条就是运行时缺口。这条边界**与 Vue2/Vue3 无关**，是 DSL 语法的先决约束。

4. **条件编译可以只做两层。** 注释预处理 + 配置平台键。**不需要文件后缀解析**（uni-app 自己就没有，§4.3）。省掉一整层。

5. **运行时重量是硬成本。** 即使静态翻译做得再干净，只要 DSL 允许 scoped slot / 虚拟节点 / DOM 查询，就必须背一份完整 Vue runtime fork（177 KB）。这是 D10 冻结"静态翻译到 WXML"时已经付的账，规则表设计里应把每条 runtime 能力的成本显式记账。

---

## 8. 未核验项 / 注意事项

- **分支易变**：`uni-app-vue3-dev` 是开发分支，`uni-mp-compiler/package.json` version = `3.0.0-alpha-4080120250820001`（alpha 版）。**本文行号随分支提交漂移**，引用前请用 SHA `c29c15de9430d45f8bb64155a7f821eea11ead5a` 固定 permalink。
- **uni-app X 混线**：`uni-app-vue3-dev` 分支同时承载 uni-app X 编译链（`UNI_APP_X`、`UNI_APP_X_DOM2`、`UNI_APP_X_VAPOR`、UTS→Kotlin/Swift、`uts2js`）。上文多处出现 `UNI_APP_X === 'true'` 分支判断，**那些是 X 专属路径，不属于经典 uni-app Vue3 mp 编译链**。
- **`uni-mp-core` / `uni-mp-compiler` / `uni-preprocess` 无 dist**：它们是 TS 源码提交，实际产物由 HBuilderX 构建管线打包，仓库里看不到最终 bundle。
- **`vue-template-compiler` 的 fork** 在 `@dcloudio/vue-cli-plugin-uni/packages/vue-template-compiler` 子路径下，是 Vue2 链路的另一层 fork，本文未展开（若需 Vue2 细节请再取一次）。
- **官方文档的"Vue2 静态 / Vue3 运行时"表述**：本次未取得官方文档原文作为引证（只做源码取证）。§0/§3.4 的纠正是**基于源码的推断**，标为 *UNCERTAIN*，与官方文档表述冲突时以源码为准。
