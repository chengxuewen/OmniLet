// First rule table (compile-slice1 T5/T8/T9): WeChat target, table-driven (D5).
// All seven partitions populated: tagMap/directiveMap/eventMap/exprWhitelist
// (T8) + lifecycleMap/styleRules/capabilityRules rows (T9). Goldens g018-g021 are
// template-side real bytes (loop-checked); g022-g030 are existence-only placeholders
// whose volumes T10 (css/js/manifest codegen) records — same ruling as g001-g003 (R2).
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
    // :class/:style simple-expr rows (T9 ruling): object/array literals reject at the
    // visitor as NEGATIVE class-obj (202); anything the expr whitelist accepts emits
    // target-attr `="{{expr}}"` via rename+wrap.
    { kind: 'directiveMap', s: ':class', t: 'class', primitive: 'rename', wrap: true, golden: 'g018' },
    { kind: 'directiveMap', s: ':style', t: 'style', primitive: 'rename', wrap: true, golden: 'g019' },
  ],
  eventMap: [
    { kind: 'eventMap', s: '@tap', t: 'bindtap', primitive: 'valueMap', golden: 'g007' },
  ],
  // Page hooks first, App-level onLaunch last (dsl-spec §1 生命周期: 沿用微信原名).
  // No `t` = identity passthrough (词表直通); js-side volumes land with codegen (T10).
  lifecycleMap: [
    { kind: 'lifecycleMap', s: 'onLoad', primitive: 'lifecyclePassthrough', golden: 'g026' },
    { kind: 'lifecycleMap', s: 'onShow', primitive: 'lifecyclePassthrough', golden: 'g027' },
    { kind: 'lifecycleMap', s: 'onHide', primitive: 'lifecyclePassthrough', golden: 'g028' },
    { kind: 'lifecycleMap', s: 'onUnload', primitive: 'lifecyclePassthrough', golden: 'g029' },
    { kind: 'lifecycleMap', s: 'onLaunch', primitive: 'lifecyclePassthrough', golden: 'g030' },
  ],
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
  // rpx identity on WeChat (spec §4: 对齐微信 750 设计稿; web targets convert in their
  // own slice). class row = the single prefix source both template rewrite (T9
  // classPrefix()) and css codegen (T10) read — same-source word table. selector:*
  // rows are the css selector whitelist (spec §3), consumed via selectorWhitelist();
  // pseudo-class set not enumerated yet (UNCERTAIN, same policy as ?. / ??).
  styleRules: [
    { kind: 'styleRules', s: 'rpx', t: 'rpx', golden: 'g020' },
    { kind: 'styleRules', s: 'class', t: 'omnilet-', primitive: 'classPrefix', golden: 'g021' },
    { kind: 'styleRules', s: 'selector:class', golden: 'g022' },
    { kind: 'styleRules', s: 'selector:tag', golden: 'g023' },
    { kind: 'styleRules', s: 'selector:pseudo', golden: 'g024' },
  ],
  // Declaration word = grant word (D17). Consumed by checkCapabilities() against
  // rule-schema capabilities.json; manifest emission lands with T10.
  capabilityRules: [
    { kind: 'capabilityRules', s: 'storage', t: 'omnilet.storage', golden: 'g025' },
  ],
}
