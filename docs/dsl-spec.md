# OmniLet DSL Specification（v0.3）

> **状态**：骨架（G3，scaffold 落地；内容随 A1-A4 切片生长）。
> **生态立场**（D9-2 裁决）：**MVP 自带核心组件集（覆盖 80% 页面场景）；npm UI 组件互操作 = Phase 2；纯 JS 逻辑 npm 包自第一天生效。**
> **负面清单格式**（Lynx CSS 子集先例）：明确写出"不支持什么"比罗列"支持什么"更有工程价值——每个受限形态给出替代写法。

## 1. 源码形态与词表（D21 + 同日改裁 2026-10-21）

**文件形态：每页/每组件拆标准文件，不造专属扩展名**（原案 `.omnilet` 单文件 + `.vue` 兼容已被用户复核推翻：自造扩展名的隐性税 = 专职 IDE 插件团队，判例 .ux 痛点/.cml 陪葬；正面判例 Taro 用 .tsx 吃满全世界工具 + 微信原生本就是拆文件）。

```
pages/index/
  index.html    模板（裸片段，无 <template> 包壳）
  index.ts      逻辑（纯 TS；D5：TS 主体、DSL 是糖）
  index.css     样式（子集见 §3，rpx 见 §4）
  index.json    本页配置（导航标题等）
app.json        页册 + manifest 能力申报（D17 词）
```

**词表**（2a 混挂裁决：借得到光的全借，借不到的自造）：
- 指令 = Vue 族 `v-if` / `v-for`（D10-1 落点；模板解析器直接复用 @vue/compiler，白拿）；插值 `{{ }}`。
- 表达式 = 白名单操作枚举（glass-easel 同型哲学）：数据读取/运算/字面量可，**函数调用不可**——派生逻辑走 script 层 computed。`?.`/`??` 暂排除（微信表达式支持度 *UNCERTAIN*，实测后回收）。
- 事件 = `@tap="inc"` 主词 + `bindtap` 别名（规则表一行成本换微信迁移零改）。
- `ol:` 扩展命名空间 = 只收"别家没有对应词"的概念（能力申报 `ol:requires="storage"`、未来端差标记——D21 Card 2 留位）。**反丑纪律**：ol: 与 v- 词表永不相交；ol: 不入侵基础指令域；交集非空 = CI 红。

**数据流**（2c 成文）：单向——逻辑层 state 变更 → 编译期路径清单驱动每 tick 一次 setData；模板无双向糖（`model:` 在负清单），无 selectComponent 类节点访问。

**响应式门面**（D21 Card 1 插座）：词表恒定 `reactive/ref/computed/watch`（自 'omnilet' 导入）；引擎实现按 flavor 编译矩阵插档（标准=@vue/reactivity，lite=最小信号集，后续切片）；**每档 API 删减表必须成文、越界编译期报错，不静默阉割**。

**生命周期**（3' 裁决）：沿用微信原名 `onLoad/onShow/onHide/onUnload` + App 级 `onLaunch/onShow/onHide`——双线程语义对位，Vue 词（onMounted）不适配。
## 2. 负面清单（不支持，明确列出）

| 不支持的形态 | 原因 | 替代写法 |
|------|------|---------|
| 运行时拼接组件名（`<{{ tagName }}>`） | 静态编译（D10-2）无法穷举 | 条件分支 `<view v-if>` 全枚举 |
| 函数式子组件宏（模板内调函数返回模板） | 破坏静态可翻译性 | 组件 props + slot |
| 跨文件动态 include | 同上 | 显式 import 组件 |
| `<iframe>` 标签 | 双渲染路径语义不可对齐（标准模式=iframe / HMI 模式=OSR 实例，行为差异泄漏） | `<web-view src>`（D13-1；自动翻译+告警为 Web 切片起的目标行为，编译器切片 1 = 报错保守版） |
| `model:` 双向糖 | 单向数据流（2c 裁决；双线程无同步回写通道） | 逻辑层 state 单向赋值 + computed；输入回显走事件 handler |
| `:class`/`:style` 对象·数组语法 | Vue 全保真 = 运行时归约需求（uni-app 双代背包 177KB runtime fork 的长尾清单实证） | 三元拼字符串或静态 class + script 层切换 class 名 |
| v-for 解构三元组 / `:of` 迭代协议 | 微信 wx:for 无对位；静态穷举域外 | `(item, index)` 两元；数据先在 script 层整形 |
| TS 不可擦除语法（enum/namespace/参数属性） | 类型剥除内核（erasableSyntaxOnly 纪律）不编译它们，降级会产运行时代码破坏"逻辑层纯 TS 即真相" | const 对象字面量 / 顶层函数 |
| handler 非标识符（内联表达式/成员访问链） | 事件表静态提取的前提 | 具名方法，复杂逻辑进方法体 |

（首版即冻结扩展流程：新增负面条目 = dsl-spec 修订 + golden 测试同步）

## 3. 样式子集

- WXSS 选择器子集：类选择器/标签选择器/伪类受限集（明细随 compiler 切片枚举进样式规则表——D9 S-3 已路由）
- 样式隔离：`omnilet-` 前缀约定（D5 add3-1；编译器自动加前缀，业务手写免前缀）

## 4. 单位与度量

- rpx 语义：对齐微信（750 设计稿宽等比）——换算规则进样式规则表（postcss-pxtransform 同款职责，Taro 先例）
- Web 目标换算目标 = **px 定基准（1rpx = 0.5px @375px 视口，写死）**（D22 Card 3, 2026-10-26；vw/rem 留重开触发器：出现真多屏适配 fixture 需求时开新裁决）

## 5. 文件级平台覆写（D9 路由）

约定：`文件名.<platform>.<后缀>` 覆写同名文件（如 `index.wechat.ts` 覆 `index.ts`；html/css/json 同理）。**产物零 #ifdef**（不变量②）——覆写发生在编译期文件解析层，且在 Babel 降级**之前**的 IR 阶段执行（D21 工程红线：dead-code 消除先于 lowering，mpx regenerator 坑为戒）。

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
## 10. 响应式插座（三原语，D21 Card 1 接口成文）

插座定义 = 三原语；§1 门面词表恒建于其上，引擎实现按 flavor 插档互换：

| 原语 | 职责 |
|---|---|
| observe（观察登记） | 模板/render 读数据路径时，登记"谁在读这条路径" |
| write（写标脏） | state 被写入时标脏、查询读者名单 |
| flush（回合通知） | 回合结束把脏路径一次性交调度器（编译期路径清单驱动 setData / DisplayList 提交） |

- 标准档 = @vue/reactivity 实现三原语（effect/调度器映射）；lite 档 = 最小信号集（后续切片）；容器侧 Rust 三原语 trait（omnilet-jsengine）随 lite/运行时切片落地——compile-slice-1 §1 不做清单登记。
- 每档 API 删减表在实现该档时成文、越界编译期报错（mpx defineProperty 删减成文是正例教材，证据锚 mpx.md）。
