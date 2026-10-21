# 竞品档案：Remax（阿里）

> 快照日期：2026-10-21。证据：浅克隆 `remaxjs/remax` @ **a7b27ff**（末次提交 **2022-08-09 = 死亡四年余**）+ 20 包结构 + babel 插件族实测。

## 基本信息

| 项 | 值 |
|---|---|
| 维护方 | 阿里巴巴（remaxjs org）——*UNCERTAIN* 与 ice 的接续关系（ice 现支持 glass-easel 配置，Remax 线无下文） |
| 定位 | **真正的 React 跑在小程序里**——自述"你可以把 Remax 理解为针对小程序的 React Native"，明确与静态编译方案对立 |
| 活跃度 | **已死**：末次提交 2022-08-09；文档站随集团前端线收缩 *UNCERTAIN* 现状 |
| License | MIT |
| 包结构 | 每端一个运行时包：`remax-wechat` / `remax-ali` / `remax-toutiao` / `remax-one`（多端抽象）/ `remax-web`；babel 插件族：`turbo-render` / `lifecycle` / `host-component` / `regenerator-runtime` / `auto-css-modules`；`postcss-remax-tag` |

## 架构与原理（只留 OmniLet 相关轴）

1. **载体 = React 运行时 + 自研 reconciler 映射**：JSX 直用 React 心智，渲染经宿主组件树——运行时派旗手。
2. **turbo-render 的自我修正**（最值钱的发现）：`babel-plugin-remax-turbo-render` 内含 `extractTemplate.ts` + `templates/`——**纯运行时派实际上也做了静态模板提取**（把渲染产物的静态部分预抽成模板降低 setData 量）。口号是"不同于静态编译"，身体在往静态回收。运行时派向静态派的收敛样本。
3. **每端一个运行时包 = 运行时派的适配单位**：与 Taro 的编译期平台插件相对——它的多端差异吸收在运行时包里，每加一端要发一个运行时包。

## 优势（生前）

- React 语义完整度最高（真 React，不转译不阉割）；One 模式跨端 API 抽象

## 局限 / 死亡教训

- 双层运行时成本（React reconciler + 宿主 setData）——正是 kbone 自认的性能税的另一实现；2022 停更、生态无接续——**React 小程序赛道被 Taro 运行时派挤出**（同一人群两家，活着的那家也没赢口碑）；静态+运行时混合已是 D10-2 时代共识，纯运行时派无残余玩家

## 对 OmniLet 的借鉴

1. **收敛方向判例**（→ D10-2 论据库）：纯运行时派的头号代表最后自己加了静态模板提取——"静态为体"不是 OmniLet 的偏好，是赛道尸检结论。与 kbone 1000 节点红线、uni-app v3 运行时化后未被小程序端证明、Chameleon 之死并列为四份证据。
2. **每端一运行时包的反例**（→ 架构.md 平台适配层）：OmniLet 规则表是数据不是包——新增目标端 = 新增表，不发运行时版本，适配单位差异要说清。

## 不借鉴

- 整条路线（运行时派，D10-2 已裁反）；仅作为方向证据与负面清单注脚保留本档案。

## 来源

- remax @ a7b27ff：README "真正的 React / 不同于静态编译"自述、`packages/babel-plugin-remax-turbo-render/src/extractTemplate.ts`、`packages/remax-*` 平台包树
- OmniLet 对照：D10-2 裁决；docs/reference/README.md frameworks lane
