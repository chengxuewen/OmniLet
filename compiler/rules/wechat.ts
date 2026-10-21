// First rule table (compile-slice1 T5/T8): WeChat target, table-driven (D5).
// tagMap/directiveMap/eventMap/exprWhitelist populated (T8); lifecycleMap/
// styleRules/capabilityRules stay empty until T9 adds rows + goldens.
// `golden` fields are golden-dir ids under compiler/tests/golden.
import type { RawTableSet } from '../src/tables'

export const wechatTables: RawTableSet = {
  tagMap: [
    { kind: 'tagMap', s: 'view', t: 'view', primitive: 'passthrough', golden: 'g001' },
    { kind: 'tagMap', s: 'text', t: 'text', primitive: 'passthrough', golden: 'g002' },
    { kind: 'tagMap', s: 'button', t: 'button', primitive: 'passthrough', golden: 'g003' },
  ],
  directiveMap: [
    { kind: 'directiveMap', s: 'v-if', t: 'wx:if', primitive: 'rename', wrap: true, golden: 'g004' },
    { kind: 'directiveMap', s: 'v-for', t: 'wx:for', primitive: 'splitDirective', golden: 'g005' },
    { kind: 'directiveMap', s: ':key', t: 'wx:key', primitive: 'keyTransform', golden: 'g006' },
  ],
  eventMap: [
    { kind: 'eventMap', s: '@tap', t: 'bindtap', primitive: 'valueMap', golden: 'g007' },
  ],
  lifecycleMap: [],
  exprWhitelist: [
    // Node-type acceptance rows for the template expression grammar (dsl-spec §1).
    // `t` on binary/logical/unary rows = the allowed-operator list (data, not code).
    // `?.`/`??`/calls stay OUT (spec §9: WeChat support *UNCERTAIN*, measured later).
    { kind: 'exprWhitelist', s: 'Identifier', golden: 'g008' },
    { kind: 'exprWhitelist', s: 'MemberExpression', golden: 'g009' },
    { kind: 'exprWhitelist', s: 'StringLiteral', golden: 'g010' },
    { kind: 'exprWhitelist', s: 'NumericLiteral', golden: 'g011' },
    { kind: 'exprWhitelist', s: 'BooleanLiteral', golden: 'g012' },
    { kind: 'exprWhitelist', s: 'NullLiteral', golden: 'g013' },
    { kind: 'exprWhitelist', s: 'BinaryExpression', t: '+, -, *, /, %, ==, ===, !=, !==, <, <=, >, >=', golden: 'g014' },
    { kind: 'exprWhitelist', s: 'LogicalExpression', t: '&&, ||', golden: 'g015' },
    { kind: 'exprWhitelist', s: 'UnaryExpression', t: '!, -, +', golden: 'g016' },
    { kind: 'exprWhitelist', s: 'ConditionalExpression', golden: 'g017' },
  ],
  styleRules: [],
  capabilityRules: [],
}
