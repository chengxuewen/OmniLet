// First rule table (compile-slice1 T5): WeChat target, table-driven (D5).
// Only tagMap is populated now — three passthrough rows. The other six
// partitions ship as empty arrays so T8/T9 ADD rows without rewriting this
// file's shape. `golden` fields are golden-dir ids under compiler/tests/golden.
import type { RawTableSet } from '../src/tables'

export const wechatTables: RawTableSet = {
  tagMap: [
    { kind: 'tagMap', s: 'view', t: 'view', primitive: 'passthrough', golden: 'g001' },
    { kind: 'tagMap', s: 'text', t: 'text', primitive: 'passthrough', golden: 'g002' },
    { kind: 'tagMap', s: 'button', t: 'button', primitive: 'passthrough', golden: 'g003' },
  ],
  directiveMap: [],
  eventMap: [],
  lifecycleMap: [],
  exprWhitelist: [],
  styleRules: [],
  capabilityRules: [],
}
