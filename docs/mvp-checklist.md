# OmniLet MVP 验收清单

**版本**：v1.0（定稿，user-adjudicated 2026-10-16） | **日期**：2026-10-16
**性质**：MVP 完成定义（一级条目稳定；修改条目 = 新决策条目，防范围蠕动）
**来源**：decisions.md D2/D3/D5 系列/D6 全部裁决的汇总——本文件不产生新决策。
**二级展开**：脚手架阶段将一级条目展开为可执行任务（plans）；勾选状态随实施滚动更新。

## 一级验收条目（全部 ✅ = MVP 完成）

### A. 多端编译（D5 主体）
- [ ] A1 统一 DSL/TS 样例工程 → **微信小程序包**可运行于微信开发者工具 —— 二级首块完成（compile-slice1 机器三档全绿 + 四道门禁探针永久化）/ 一级 pending 人眼档（runbook: compiler/README.md）
- [ ] A2 同一样例 → **Web 产物**在 Chrome/Firefox/Safari/Edge 可运行（组件→DOM 映射 + omnilet- 前缀）
- [ ] A3 同一样例 → **自有容器包**在容器 SDK 内可运行
- [ ] A4 编译器 = 表驱动架构（规则表独立于内核），Babel v1 内核跑通三目标管线

### B. 容器 SDK（D5 add1/2 + D3 + D9）
- [ ] B0 桌面开发壳：标准模式宿主兼任（加载未打包目录 + watch 热重载 + CDP 调试端口）——容器目标开发迭代秒级 + T2/T3 容器层自动化测试驱动器（D9 裁决 1）
- [ ] B1 SDK 嵌入 **iOS + Android** 演示 App，轻应用可打开/前后台切换/销毁
- [ ] B2 JS 引擎矩阵生效：iOS=JSC（OC 胶水桥）/ Android=V8；lite flavor（rquickjs）可在嵌入式 target 演示
- [ ] B3 双通道就位：标准模式 StructuredChannel / HMI 模式 SharedRingBuffer，上层 setData API 统一
- [ ] B4 Worker 三级能力可用（L1 全平台；L2 vtree-diff 双模式；架构预留 L3）

### C. 热更新（D5 add2-3）
- [ ] C1 离线包 = manifest 签名 + 目录级差分格式落地
- [ ] C2 全链路：后台发版 → 对象存储/CDN → SDK 差分下载 → 验签 → 静默切换
- [ ] C3 篡改样本必拒（fail-closed 实测）

### D. 安全沙箱（不变量⑤ + D5 add5）
- [ ] D1 权限三层模型生效：manifest 声明 → 低敏静默授权 → 审计日志记录
- [ ] D2 沙箱隔离：存储隔离/网络白名单/无宿主敏感数据访问路径

### E. 管理后台（D6-1）
- [ ] E1 应用管理/版本管理/发布流程可用（TS 全栈 console/）
- [ ] E2 manifest 签发与密钥管理（KMS 配置）就位

### F. 测试与门禁（D6-2）
- [ ] F1 T1 单元层 CI 就位（cargo test + vitest + 规则表 golden 样例）
- [ ] F2 T2 集成层跑通：三 flavor 引擎一致性（R1）+ 权限三层矩阵 + Worker 用例
- [ ] F3 三发版红线机制立起：R1/R2/R3 任一红 = 不可发版（R3 白名单流程文档化）；每条红线交付时附红/绿双向验证记录（坏样本必红 + 好样本应绿，testing 纪律：gate 能咬人）

### G. 性能指标（tech-whitepaper §9 lite 列【已落地】/ standard 列【待 G2 实测】，D5 add1-② 分列制）
- [ ] G1 lite flavor（rquickjs）：冷启动 < 50ms、内存基线 < 15MB、体积增量 < 5MB（实测达标志）
- [ ] G2 standard flavor 指标数字实测锁定并回填 tech-whitepaper §9 standard 列

## 明确不做（MVP 出局清单）
- 支付宝/飞书/快应用编译目标（路线图激活）
- 可视化设计器（Phase 2 起，D5 add4）
- SCADA dataChannel 完整实现（仅架构预留 ring buffer 数据分区，D5 add3-3）
- 开放平台/第三方开发者入驻（Phase 3）
- 高敏权限运行时弹窗细节（架构三层定型，细节随开放平台，D5 add5）
- 运行时引擎切换（编译期 flavor 矩阵为最终形态；业界零先例，D5 add1）
- Hermes 引擎（RN 生态专属、无独立维护社区，已从引擎矩阵除名，D5 add1；白皮书 v1.0.1 勘误对应）

## 二级展开占位
脚手架（scaffold）阶段：一级条目 → 垂直切片任务序列（plans）；本节记录切片顺序裁决的引用。
