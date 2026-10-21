# 小程序 DSL 与编译架构设计空间（横评综合）

> 快照日期：2026-10-21。本档是**横评综合**（轴 × occupants × 实测后果），不是第 12 份画像：细节证据在单档案里（wechat-miniprogram / taro / uniapp / mpx / glass-easel / kbone / remax / chameleon / quickapp / lynx / hippy / finclip）。证据形态 = 浅克隆源码实读（SHA 见各档案）优先，既有画像摘要次之，凡 *UNCERTAIN* 使用前复核。
> 目的：给"OmniLet 编译引擎首切片"提供逐轴的 precedent-backed 位置，并把**真正需要新裁决的点**单独列出。

## 一句话版本

小程序跨端这件事，市场上只剩两种活法——**把代码提前改写掉（静态编译）**和**把环境伪造出来（运行时 shim）**；尸检样本（Chameleon、Remax、kbone 停滞）都指向同一句：**语法可以借、引擎必须自己攥、动态性要设天花板**。下面九条轴逐条摆证据。

## 轴 1 生态载体（元轴：你的差异化代码住在哪）

| 选 | 住法 | 代表（实测证据） |
|---|---|---|
| A 编译器 | 差异住**转换管线**，产物是目标端原生代码 | uni-app v2（`mpvue-template-compiler`）、Taro 3 的编译+运行时混合里的编译半区 |
| B 运行时 shim | 差异住**伪造的浏览器/框架环境** | kbone（整层 DOM/BOM 伪造 + `not-support.js`）、Remax（真 React + reconciler 映射） |
| C 组件框架层 | 差异住**宿主基础库**，框架只是其上的 DSL 皮 | glass-easel（三后端协议，官方基础设施位） |
| D 自造语言 | 差异住**全新语法** | Chameleon CML（archived，死亡样本） |

**后果实测**：B 派天花板由 kbone 自己写进 README（约 1000 节点，官方建议超出者转静态转译方案），且 Remax 死前已在用 babel 插件做静态模板提取（`extractTemplate.ts`）往 A 回收；D 派死于无生态接入；C 派是平台方专利（微信官方才养得起）。

**OmniLet 位置**：A（已裁：D10-2 静态翻译、产物全编译期终解）。本档新增量 = **判例集**，下次有人翻案"运行时更灵活"时直接甩轴 1 后果行。

## 轴 2 指令语法族

| 选 | 代表 | 后果 |
|---|---|---|
| A Vue 族（v-if/v-for + {{}}） | uni-app、mpx | 人群最大；翻译量可控（一对一映射可枚举——D10-1 原话） |
| B WXML 原样（wx:if/wx:for） | glass-easel、原生 | 微信人群零学习成本；Vue 人群换心智 |
| C JSX | Taro、Remax | 表达力最高，但模板→WXML 变成运行时/半运行时问题（Taro 递归模板包袱、Remax 之死） |
| D 自造语法 | Chameleon CML、QuickApp 方言 | CML 已死；QuickApp 活着但靠厂商联盟行政推动，非市场选择 |

**关键独立发现（必须记牢）**：mpx 用 **MobX** 而非 Vue reactivity 实现了 Vue 式语法——**轴 2 和轴 3 是正交的**。"选了 Vue 语法"不等于"必须 @vue/reactivity"，反之亦然。

**OmniLet 位置**：A（D10-1 已裁）。React 人群由"逻辑层纯 TS"承接（D10-1 原文立场），模板层不做 JSX。

## 轴 3 响应式引擎

| 选 | 代表 | 后果 |
|---|---|---|
| A @vue/reactivity | uni-app（v2/v3） | Vue 生态兼容最好；但引擎体积/语义完整度是隐性税（v3 小程序端被迫挂运行时层——见轴 5） |
| B MobX | mpx | 内核小、可预测；与 Vue computed/watch/hooks 语义有裂口（mpx 靠独立 pinia 包补） |
| C 信号式自研 | （无主流先例，Solid/信号生态在通用前端） | 与"每 tick 一次 setData"模式天然契合（依赖清单编译期可知） |
| D 不自建，宿主 setData 直用 | 原生 WeChat | 最薄但无表达力，开发体验断崖 |

**OmniLet 位置**：⚠️ **未裁决点 1**。D10 说"@vue/reactivity"当时未与轴 2 解绑；mpx 判例 + lite flavor（rquickjs、<50ms 指标）对引擎体积敏感 → **首切片是否把 reactivity 做成可替换层（标准=vue reactivity，lite=最小信号集）**要定。推荐：定调"可替换层，标准档先上 @vue/reactivity"，把选择写死成两个实现挂一个接口，成本一页纸。

## 轴 4 表达式语言与模板能力天花板

| 选 | 代表 | 后果 |
|---|---|---|
| A 白名单 AST 枚举（模板不做通用求值） | glass-easel（`parse/expr.rs` 的 Expression 枚举实证） | 官方级背书：静态可分析、跨后端可复用；复杂逻辑外溢到脚本层 |
| B 宿主脚本子集兜底（WXS 层） | 原生 WXML、mpx（?. 降级 WXS 实证） | 多养一门小语言；OmniLet 无宿主约束，背它=自缚 |
| C 通用 JS 表达式进模板 | Taro/Remax（JSX 族） | 天花板即 kbone 那句"性能损耗换特性" |

**OmniLet 位置**：A + 负面清单（dsl-spec §2 已有形态级清单）。**新增量**：把"模板表达式 = 白名单操作枚举"写进 spec（现在是隐含假设，glass-easel 给了官方同型先例背书）。⚠️ **待补进 dsl-spec §2 修订**（首切片落地时一并）。

## 轴 5 数据绑定方向与 setData 策略

| 选 | 代表 | 后果（原文证据） |
|---|---|---|
| A 同步 setData + 用户显式批处理 | glass-easel（"同一个调用栈中立即完成"） | 可推理可调试；批量责任在用户 |
| B 每 tick 一次自动队列 + 路径 diff | mpx（render-fn 依赖收集 + 路径清单两条，原文全在 runtime.md） | 用户体验最好；框架必须拿到"模板读了哪些路径"的编译期清单 |
| C 运行时 vdom diff 出 setData | Taro3 / uni-app v3（`uni-mp-vue/src/dom/UniElement + setData` 实测——**DCloud 在 Vue3 线放弃了自家 v2 纯静态**） | setData 量结构性偏大；长列表弱（社区公认）——**这正是 D10-2 点名否决的 Taro 路线的当前形态** |

**关键判例（本档最重的一块证据）**：uni-app 的 v2 线 = 静态转 WXML（`mpvue-template-compiler` 实测），v3 线 = 编译器 fork + **运行时 DOM 模拟层 setData**（`src/dom/` 文件树实测）。D10-2 引用的"uni-app 路线"严格说只对 v2 成立。**OmniLet 选静态路线 = 选 uni-app 的老路线**，而 DCloud 自己已迁到混合。这不推翻裁决（我们负面清单砍掉的正是逼他们挂运行时层的"Vue 全语义保真"需求），但设计文档必须**诚实标注这个血缘**——被问"uni-app 都放弃静态了你为什么没"时有据可答：我们不是守旧，是**砍需求买路线**，且 glass-easel（官方，活着）站在同侧。

**OmniLet 位置**：B（自动队列 + 路径 diff，与 mpx 同型、与双线程不变量4同构），批处理 API 形状参考 glass-easel（`groupUpdates` 类显式口留逃生）。

## 轴 6 组件模型（slots/props/事件）

| 证据 | 要点 |
|---|---|
| glass-easel | slot 三级且**性能梯度**（multipleSlots 官方警告"禁用部分优化"——原文在）；组件隔离 = Shadow Tree + props/事件两通道 |
| mpx | Vue 式 props/events/mixin/provide-inject；mixin 平台后缀变体 = 文件爆炸（约 20 mixin × 后缀实测） |
| 微信原生 | 属性 + 事件 + selectComponent 查询口子（隔离可击穿，历史包袱） |

**OmniLet 位置**：props/事件两通道（与 glass-easel 同型，不变量3"一套语义"的组件表达）；**插槽首切片只做单默认槽**（梯度证据背书"多槽是性能决策不是开关"，dynamic slots 明确 roadmap 位）；mixin/provide-inject 不进容器语义（Vue 特性留在逻辑层，不进规则表——防 mpx 文件爆炸复刻）。

## 轴 7 样式隔离

| 选 | 代表 | 后果 |
|---|---|---|
| A 默认全局 + opt-in 前缀作用域 + 混用出口 | glass-easel（`styleScope`/`extraStyleScope` 三件组实证） | 微信生态心智（全局 WXSS）；泄漏风险在用户 |
| B 默认隔离（构建期 hash 类名） | Vue scoped / uni-app 组件样式 | 隔离好但跨组件样式复用要 `:deep` 式补丁 |
| C 无机制纯约定 | mpx（官方警告 @import 膨胀实证） | 最薄；靠纪律 |

**OmniLet 已有裁决**：D5 add3-1 = `omnilet-` 前缀约定（编译器自动加、业务手写免）。本档增量 = **必须同时预留 glass-easel 式"隔离+全局混用"出口**（设计系统/组件库复用卡死点），进样式规则表 schema，不是运行时功能。

## 轴 8 多端适配策略（条件编译住在哪一维）

| 维 | 代表 | 状态 |
|---|---|---|
| 文件后缀（页面名.wechat.ts） | **OmniLet 已裁 D9 路由**（dsl-spec §5） | 与 mpx 文件维同型 ✓ |
| 注释预处理（#ifdef） | uni-app | **不变量2明令禁止**（产物零 #ifdef）——注意：D10 否决的是"运行时可切换引擎"，#ifdef 被禁在 architecture 不变量层 |
| 属性维（`@mode`/`\|`） | mpx 独有 | ⚠️ **待裁决点 2**（下节） |
| 运行时模式变量（`__mpx_mode__`） | mpx | OmniLet 等价物 = 编译期注入常量（不是运行时判定——语义差要写清） |
| srcMode ≠ mode（方言/目标两轴） | mpx 独创 | 首切片不需要（无"混写多端方言"场景），**留 DSL 扩展注脚** |

**静态路线暗坑（必进 pitfall/规则表设计）**：mpx 实证 **babel 把 async/await 降级成 regenerator switch 后，死代码消除失效、false 分支照样进包**。OmniLet 的 dead-code（含文件级覆写解析）必须发生在**降级前的 IR 层**——不变量2"产物零 #ifdef"的工程保证不只是位置问题，是**顺序问题**（IR 在 lowering 前）。这条进编译引擎设计文档的"坑与防线"节。

## 轴 9 类型工程

| 证据 | 要点 |
|---|---|
| mpx | 无 .d.ts 自动生成 → 手写 types.d.ts + `WithThis` 变体 API（官方承认 TS 表达力不足被迫运行时加 API 变体） |
| glass-easel | 配 `glass-easel-miniprogram-typescript` 包 + webpack `.glass-easel-component` 虚拟模块重定向（TS 是一等工具链不是补丁） |
| dsl-spec §6 | 已裁"类型即生成物"（表 → WXML/JS/.d.ts）——**OmniLet 站位高于两家**：表驱动 + 生成 .d.ts 正是 mpx `WithThis` 式补丁的解药 |

**OmniLet 位置**：§6 裁决不变（表 = 唯一事实源，typings 是生成物）。首切片验收 = 生成的 .d.ts 能被 tsc 消费（一条 golden 测试即可，成本极低、占位正确）。

## OmniLet 设计结论汇总（逐轴站位表）

| 轴 | 站位 | 背书判例 | 新决策？ |
|---|---|---|---|
| 1 载体 | 编译器（静态） | D10-2 + glass-easel 同侧 + Remax/kbone 尸检 | 否 |
| 2 语法 | Vue 族 | D10-1 | 否 |
| 3 响应式引擎 | ⚠️ 可替换层（标准=vue reactivity，lite=?） | mpx MobX 正交实证 | **是——裁决点 1** |
| 4 表达式 | 白名单枚举 + 负面清单 | glass-easel expr.rs | spec 补文（非裁决） |
| 5 setData | 每 tick 队列 + 路径 diff | mpx 同型 + 双线程4 | 否 |
| 6 组件 | props/事件两通道，插槽单槽起步 | glass-easel 梯度警告 | 否 |
| 7 样式 | omnilet- 前缀 + 混用出口预留 | glass-easel 三件组 | 否（schema 位） |
| 8 条件适配 | 文件维已裁；属性维未裁 | mpx @mode / srcMode-mode 双轴 | **是——裁决点 2（可缓裁）** |
| 9 类型 | 表 → .d.ts 生成 | D9 §6 + mpx 反例 | 否 |

## 给首切片的直接输入

1. 首张规则表的列 = 轴 5 的"模板数据依赖清单"格式先行（render-fn 声明路径是 mpx 已验证形状，非自研赌博）
2. IR 层 dead-code 消除先于任何 Babel 降级（轴 8 暗坑防线）
3. 负面清单执行器 = 编译期 reject + 替代提示（Chameleon/kbone 两头的教训：收全部=性能尸检，造全语=生态尸检；负面清单就是中间那条路的具体护栏）
4. `.d.ts` golden 测试一条进 T1（占"类型即生成物"的位）
5. 裁决点 1（响应式引擎可替换层）要在设计呈现前定；裁决点 2（属性维条件编译）可留 spec 开放节，切片不阻塞

## 来源（本档直接引用）

- mpx @ 87341c50e4a4（MobX/双优化/四维条件编译/regenerator 坑/WithThis）——详见 mpx.md
- glass-easel @ 574460cf10b9（expr.rs AST/三后端/同步 setData/slot 梯度/样式三件组）——详见 glass-easel.md
- kbone @ 631432e（DOM/BOM shim 树/1000 节点红线原文）——详见 kbone.md
- remax @ a7b27ff（turbo-render 静态提取反证）——详见 remax.md
- uni-app v2/v3 @ 本地克隆 uni-v2/uni-v3（`mpvue-template-compiler`、`uni-mp-vue/src/dom/`——主线程实测）
- Taro / 原生微信 / Chameleon / QuickApp / Lynx：引既有画像（taro.md / wechat-miniprogram.md / chameleon.md / quickapp.md / lynx.md）
