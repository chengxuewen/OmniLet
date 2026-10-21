# 编译侧首切片设计 — 微信端到端薄切片（compile-slice-1）

> 版本：**v2**（2026-10-21，按 spec-review 团队四路审查合裁修订；v1=358ecd5）
> 裁决依赖：D5 / D9 / D10-1/2 / D17 / D21 + 同日修订
> 证据：docs/reference/dsl-design-space.md + mpx / glass-easel / kbone / remax 四档（SHA 锚定）；§9 审查来源记录
> 状态：待用户终审定稿

## 1. 目标与范围

**目标**：极薄样例工程（单页 counter：`view/text/button` + `v-if`/`v-for`（带 `:key`）+ 一次 setData 交互；根元素带一行 `ol:requires="storage"` 申报——不调用，验证汇入 manifest）编译产出**微信小程序包**；机器验收全绿（§6），勾 **A1 二级首块**（一级勾选"A1 完成"待人眼档在微信开发者工具实测后落，记 pending 不假装）。

**样例位置**：`compiler/tests/fixtures/counter/`（同树即 golden 正卷输入；人眼档验收对象）。

**产物页面形态（审查采纳，编译器决策非作者决策）**：页面以微信**组件式页面** `Component()`（`properties` 全可选，页面级成员为可缺省扩展）生成——理由 = 行为档 simulate 实测以 Component 为通行形状（审查实跑：load 签名实测全 Component）；作者写的页面代码不感知 Page/Component 之别。

**明确不做**：
- Web / 自有容器目标（将来只加 `rules/web.ts` + codegen-web）
- 自定义组件、路由/页面栈、worker、`ol:` 端差标记（D21 Card 2 触发器留位）
- 三原语 Rust trait（omnilet-jsengine 契约扩展）→ 随 lite/容器运行时切片落地；**本切片义务 = dsl-spec 三原语节成文**（已随 v0.3 落）
- CLI 体验完善、报错 i18n、npm UI 组件互操作（D9-2 Phase 2）
- watch/增量编译（§8 登记，B0 壳切片触发；切片 1 仅承诺 `compileProject` 重入幂等）

**源码形态**（D21 修订）：每页拆标准文件（`index.html / index.ts / index.css / index.json` + `app.json`），无专属扩展名。

## 2. 编译管线（四站）

```
[1] 输入装配    目录扫描同名配对；平台覆写消解（index.wechat.ts > index.ts）
                ★ 覆写"消解"= 配对选择发生在 ingest；IR 内覆写区消费选择结果（措辞与 §7 一致）
[2] 建 IR       html 片段 → 模板 AST = 复用 @vue/compiler-dom parse+transform（版本锁定，见 §7）
                ts → TS AST；负面清单执行器就位（onError 接 1xx 诊断通道；parse 选项锁定
                {whitespace:'condense', comments:false}——AST 形状的前提条件而非自由默认）
[3] 规则表改写  AST 过查表 visitor（§3）
[4] 代码生成+装包 AST→wxml（属性发射顺序固定）；TS→JS = 仅类型剥除（Babel 换代缝在此）；
                css→wxss（前缀+选择器校验）；**生成门面 @omnilet/runtime 的 .d.ts**（§6 类型档输入）；
                **vendor bundle**：门面垫片+@vue/reactivity 编译期打进产物（微信 npm 需开发者工具
                build-npm，Linux 无此工具——运行时依赖必须零 build-npm 依赖）；
                app.json 合并规则：作者文件透传、编译器生成字段（pages[]、组件注册）注入、冲突=报错；
                capability 汇总落 **包根 sidecar `omnilet.manifest.json`**（微信忽略未知文件，
                自有容器/审计消费——落点名字化，golden 可写）
```

**工程红线**（不变量"零 #ifdef"的顺序保证）：覆写消解/死代码消除发生在 IR 层、先于任何 Babel 降级。**切片 1 可执行形式**：模块边界测试（Babel 仅 `codegen/` 可 import）+ 负卷：dead `v-if` 分支内 async 函数 → 断言产物无 regenerator 辅助代码（切片 1 仅类型剥除不转译 async，此卷防的是未来降级回归）。

## 3. 规则表与定点原语（审查修订版）

**结构诚实定名**：7 区 = **4 映射区**（tagMap / directiveMap / eventMap / lifecycleMap——IR 进 IR 出）+ **3 校验区**（exprWhitelist / styleRules / capabilityRules——不做映射，做白名单判定）。

**原语清单**（每原语附录一个最小 worked example：输入 AST + 表行 + 输出，编译前钉死语义；定点行在表内自认 primitive 列）：

| 原语 | 修正 |
|---|---|
| rename / valueMap | valueMap 即 rename 的参数化——合并表述；`@tap.stop`→`catchtap` 走 valueMap（一行一词） |
| wrapExpr | **钉到属性粒度**（插值/指令属性包裹 vs 裸列表属性直传的混合模式声明化） |
| splitDirective | 限定 v-for 一类参数拆分；**`:of` 迭代协议与三元上界负卷拒绝**（不发明 `splitDirective.v-for2`） |
| keyTransform | **新增**：`:key`→`wx:key`（切片 1 真实需求，g007 带 key） |
| passthrough | 保留 |
| ~~drop~~ | **删除**（切片 1 零消费者，YAGNI） |
| 表外定点 | classPrefix 样式改写、lifecycle 词表直通各一行——表分区可自认定点，如实声明不假装六字覆盖全部 |

**白名单哲学**：tagMap 全枚举（`view/text/button` 恒等行也要写，"不在表里=不存在"）；lifecycleMap = 微信标准生命周期词直通、表外报错。**模板 class 值改写与 wxss 前缀同源**（classPrefix 定点负责模板侧，样式区负责 css 侧——两侧一致性测试一条）。

**golden 机制（从口号到可执行）**：
- 每行 `golden` id → **表加载期存在性检查**（id 解析不到 golden 目录 = 编译器拒绝启动；植入缺卷探针红一次证明门会咬）
- 正向卷 = **全四站 mini-integration**（进 1 源文件，出产物字节比对；切片 1 采全链，不留单站窄卷）
- 归一化规范（进 rule-schema 文档）：LF、2 空格缩进、属性序=发射序固定、无时间戳/绝对路径
- 负面卷期望文本 = **测试时从表渲染**（话术同源的可执行形式；附变异探针必红）
- **tier 归属改 T1**（test-matrix T1 行 13 明文"编译器 golden-file 在此层"；mvp-checklist F1 同锚）；故意 golden churn 走 **R3 白名单登记**（test-matrix R3 既有机制）
- 三目标产物快照对比 = T2 语义，自 Web/容器切片起才存在，本切片不冒充

## 4. 响应式门面与插座（契约归属定名）

- **门面合同 = dsl-spec §1 词表**（reactive/ref/computed/watch from 'omnilet'）；`@omnilet/runtime/<flavor>/facade/` 为各端实现目录——**微信 shim（本切片 runtime/ 积木）是门面第一个实现**，容器 rquickjs 门面是第二个（D15-4 运行时=容器资产，不另立第三机制）。
- 三原语（观察登记/写标脏/回合通知）定义已在 dsl-spec v0.3 §10 成文；Rust trait 落 lite 切片（§1 不做清单）。
- ~~"每档 API 删减表成文、越界编译期报错"~~ → 修正：**切片 1 只存在标准档，无删减表可产**——编译期报错的是负面清单（跨档静态形态），删减表是 lite 切片义务（§8 登记）。
- 数据路径清单定义（切片 1 可写范围）= **模板引用路径**（parse 即得）；computed 依赖闭包传递归约不做（后续切片）。

## 5. 错误处理（补口径）

四原则不变（话术抄文档/全量编译期诊断/三种锅三种报法/话术有卷）。新增口径：
- **错误码家族就位**：`model:` → 2xx（白名单越界，dsl-spec §2 v0.3 已补行）；handler 非标识符、`:of`/三元上界、TS 不可擦除语法（enum/namespace/参数属性）、修饰符非 `.stop` → 1xx/2xx 各归各位（§2 负面表补行随切片 golden 同步）
- **iframe 切片 1 采保守版**：报错 + 替代提示（自动翻译+告警是 dsl-spec §2 的目标行为，自 Web 切片实现——warning 自动兜底首例不悄悄进薄切片）
- warning 落点具名：stderr 行 + 构建返回 `diagnostics[]` 字段（断言锚）
- "引擎崩→pitfalls 记档" = **人工流程**标注，不计入机器覆盖
- 报错语言中文 + 错误码 i18n 钩子不变

## 6. 测试与验收（重排）

| 档 | 内容 | tier |
|---|---|---|
| 单元 | 编译管线五积木各单测（ingest/ir/rules/codegen/index；rule-schema 以 schema 校验门覆盖，不计入五） | T1 |
| golden | 正向逐行卷 + 负面话术卷（覆盖 **1xx/2xx/3xx/4xx 每段 ≥1** 取代"≥4"计数） | T1 |
| 结构档 | 产物形状：文件树 + app.json 校验（ajv）+ **wxml 语法 lint（`miniprogram-compiler` 官方包，simulate 既有依赖升显式）**+ **零 #ifdef grep 闸** | T2（test-matrix v1.1 补行，D9 S-4 债清偿） |
| 行为档 | miniprogram-simulate（jsdom 显式依赖）：counter **Component 形状**点击→断言；**保真声明**：验证"规则表翻译正确 + 垫片驱动 Component 更新"，≠ 页面级打包/真基础库行为 | T2（同上） |
| 类型档 | 生成的门面 .d.ts 被 `tsc --noEmit` 消费 | T1 |
| 人眼档 | 微信开发者工具手工一次 | **T4 人工签核，移出自动通过线**；A1 一级勾挂此人档 |

**自动通过线**：单元+golden+结构+行为+类型全绿，且门禁咬合探针（缺卷探针/话术变异探针/交集探针）各红过至少一次并记录。**首任务 = simulate 页面形状 30 分钟 spike**（load 页面文件签名实测；组件式产物已是兜底方案，spike 定行为档最终形状）。

## 7. 积木、依赖与环境

| 单元 | 管 |
|---|---|
| compiler/ingest | 配对、覆写选择 |
| compiler/ir | AST 宿主 + 查表 visitor（@vue/compiler-dom **版本锁定** + AST 形状金丝雀卷 + compiler-dom 升级 = 全量 golden 重跑触发；"薄 IR 自造"记为"Vue 依赖咬人时的备选"） |
| compiler/rules/wechat.ts | 首表（§3 分区） |
| compiler/codegen | wxml/wxss/js/json/.d.ts + 类型剥除 |
| compiler/src/index.ts | `compileProject()` 编排 + bin 薄壳 |
| **compiler/runtime/wechat/** | **门面垫片（bundle 进产物）：Component 适配 + 路径清单驱动 setData + @vue/reactivity 接线** |
| packages/rule-schema | 表 JSON Schema + **`capabilities.json` 唯一词表源**（编译器校验 ol:requires、容器 bridge 注册、manifest 审计三方共读——"一个词三处用"落地）+ golden 归一化规范文档 |

**依赖清单（新增安装，npm 侧经系统代理，镜像策略未定→计划含 `pnpm install` 连通探针前置任务）**：@vue/compiler-dom、@babel/core(+preset-typescript 或 sucrase 择一，spike 定)、postcss、esbuild（vendor 打包，`allowBuilds` 已有）、miniprogram-simulate + jsdom（dev）、miniprogram-compiler、vitest 配置增 jsdom 环境、tsconfig；pnpm-lock.yaml 入库（lockfile 纪律）。杂项债：仓库根现存 package-lock.json 与 pnpm-workspace 并存，切片计划首步澄清去留。

## 8. 重开条件登记

| 事项 | 触发器 |
|---|---|
| v-/ol: 混挂 | 大版本重构明确需求（用户附加条款 2026-10-21） |
| 属性维端差 | 文件复制漂移成本 > 语法成本 |
| CLI 参数冻结 | 管线定型后（切片 2+） |
| lite 信号集 + Rust 三原语 trait | lite flavor 切片开工 |
| 门面删减表 | lite 档实现时（§4 修正项） |
| 薄 IR 自研 | @vue/compiler 依赖咬人（金丝雀/升级成本失控时） |
| watch/增量编译 | B0 开发壳切片（切片 1 仅重入幂等承诺） |
| iframe 自动兜底 | Web 切片（§5 保守版 → 目标版） |

**类比措辞修正**：规则表形状承 D5-3（MDN-BCD 同型）；"定点原语集" = **本 spec 的设计承诺**（preset-env 为启发性类比，非证据引用）。

## 9. 审查修订记录（v1→v2 来源）

四路团队审查（spec-review，2026-10-21；三路纪律良好零改动，compiler-tech-audit 违"只读"令产出 docs/reference/uniapp-compiler-internals.md——经核实为高质量源码级证据（双分支 SHA permalink），予以保留入库并反哺纠正本库 uni-app 判例误述，见下）：compiler-tech-audit（HIGH 5/MED 7/LOW 6）、testability-audit（假绿 7 + 不可判 3 + 实测 6 项 + 依赖升级发现）、consistency-audit（F1-F10）、scope-risk-audit（HIGH 2 + 补研 5 + LOW 组）。v2 逐条采纳上述全部 HIGH + 计分类修正；跨路交叉命中（golden tier、model: 无源、ol: 落点、人眼档出通过线、三原语缺席）置信最高。**外部实测背书**：@vue/compiler parse/transform 双签名、simulate Component 形状、miniprogram-compiler 存在性（审查 lane 实跑）；*UNCERTAIN* 未决：`?.`/`??` 微信表达式支持度（已排除出白名单，实测后回收）。

**判例纠正（审查反哺）**：v1 期记录在 dsl-design-space.md 的"uni-app v3 放弃纯静态迁运行时"表述，经 internals 档源码级深读纠正为"双代均静态翻译+diff 运行时，真边界=七类长尾能力（scoped slot/DOM 查询/过滤器…）逼背包 177KB runtime fork"——负面清单的立项理由由"防走 v3 老路"升格为"主动砍长尾买零引擎税产物"。
