// Task 9 (compile-slice1): D17 capability-word validation — 4xx manifest family.
// The manifest validator/emitter lands in T10 (codegen); the check and the codes
// are named NOW so the negative matrix has a live 4xx representative (T9 ruling).
import { diag } from './diag'
import type { Diag } from './types'

/** 4xx family, named: 401 = declared capability word not in the registered vocabulary. */
export const CAPABILITY_UNREGISTERED = 401

/**
 * Validate collected ol:requires words (ingest, T6) against the registered
 * capability vocabulary (rule-schema capabilities.json = single source; D17:
 * 编号即许可, 申报词 = 授权词 = 审计词 — zero mapping table).
 * Dedup keeps first-occurrence order; every unknown word gets one 401 Diag.
 * The caller (T10 compileProject) turns non-empty output into a manifest refusal.
 */
export function checkCapabilities(requires: readonly string[], caps: readonly string[]): Diag[] {
  return [...new Set(requires)]
    .filter((w) => !caps.includes(w))
    .map((w) =>
      diag(
        CAPABILITY_UNREGISTERED,
        `能力 '${w}' 未注册（D17 编号即许可）`,
        `D17: 登记格式 omnilet.<capability>.<method>，capability 段 = manifest 权限声明词 = 授权判定词 = 审计日志词，零映射表 —— ` +
          `先在 packages/rule-schema/capabilities.json 注册 '${w}'，再进 ol:requires 申报`,
      ),
    )
}
