// Negative entries AS DATA (T4): 话术单源 = docs/dsl-spec.md §2 表.
// message = §2 "原因" column verbatim, hint carries §2 "替代写法" column verbatim.
// SYNC OBLIGATION (dsl-spec §2 footer): a new negative entry = dsl-spec revision
// + a row here (next code in its family) + diag.test.ts id list + goldens (T9).
import type { Diag } from './types'

export type NegativeFamily = 'form-negative' | 'whitelist-escape'

export type NegativeEntry = {
  /** stable id, §2 row order pinned by diag.test.ts IDS */
  id: string
  /** substring of the §2 形态 column (spec↔data anchor) */
  form: string
  family: NegativeFamily
  /** 1xx form-negative / 2xx whitelist-escape (3xx table-gate T5, 4xx manifest later) */
  code: number
  message: string
  hint: string
}

const NEGATIVES: NegativeEntry[] = [
  {
    id: 'dynamic-component',
    form: '运行时拼接组件名',
    family: 'form-negative',
    code: 101,
    message: '静态编译（D10-2）无法穷举',
    hint: '替代：条件分支 `<view v-if>` 全枚举',
  },
  {
    id: 'func-macro',
    form: '函数式子组件宏',
    family: 'form-negative',
    code: 102,
    message: '破坏静态可翻译性',
    hint: '替代：组件 props + slot',
  },
  {
    id: 'dynamic-include',
    form: '跨文件动态 include',
    family: 'form-negative',
    code: 103,
    message: '同上',
    hint: '替代：显式 import 组件',
  },
  {
    id: 'iframe',
    form: '<iframe>',
    family: 'form-negative',
    code: 104,
    message: '双渲染路径语义不可对齐（标准模式=iframe / HMI 模式=OSR 实例，行为差异泄漏）',
    hint: '替代：`<web-view src>`（D13-1；自动翻译+告警为 Web 切片起的目标行为，编译器切片 1 = 报错保守版）',
  },
  {
    id: 'model-sugar',
    form: 'model:',
    family: 'whitelist-escape',
    code: 201,
    message: '单向数据流（2c 裁决；双线程无同步回写通道）',
    hint: '替代：逻辑层 state 单向赋值 + computed；输入回显走事件 handler',
  },
  {
    id: 'class-obj',
    form: ':class',
    family: 'whitelist-escape',
    code: 202,
    message: 'Vue 全保真 = 运行时归约需求（uni-app 双代背包 177KB runtime fork 的长尾清单实证）',
    hint: '替代：三元拼字符串或静态 class + script 层切换 class 名',
  },
  {
    id: 'vfor-proto',
    form: 'v-for 解构三元组',
    family: 'whitelist-escape',
    code: 203,
    message: '微信 wx:for 无对位；静态穷举域外',
    hint: '替代：`(item, index)` 两元；数据先在 script 层整形',
  },
  {
    id: 'ts-unerasurable',
    form: 'TS 不可擦除语法',
    family: 'whitelist-escape',
    code: 204,
    message: '类型剥除内核（erasableSyntaxOnly 纪律）不编译它们，降级会产运行时代码破坏"逻辑层纯 TS 即真相"',
    hint: '替代：const 对象字面量 / 顶层函数',
  },
  {
    id: 'handler-form',
    form: 'handler 非标识符',
    family: 'whitelist-escape',
    code: 205,
    message: '事件表静态提取的前提',
    hint: '替代：具名方法，复杂逻辑进方法体',
  },
]

/** Live table reference — mutation-visible by design (diag.test.ts self-proof). */
export function negativeEntries(): NegativeEntry[] {
  return NEGATIVES
}

export const NEGATIVE_ENTRIES: readonly NegativeEntry[] = NEGATIVES

/** Expected golden error text for a negative id; pure table render, no per-id branches. */
export function renderExpect(id: string): string {
  const e = NEGATIVES.find((x) => x.id === id)
  if (!e) throw new Error(`renderExpect: unknown negative id '${id}'`)
  return `${e.code} ${e.message} hint: ${e.hint}`
}

export function diag(code: number, message: string, hint: string, loc?: Diag['loc']): Diag {
  return { code, message, hint, ...(loc ? { loc } : {}) }
}
