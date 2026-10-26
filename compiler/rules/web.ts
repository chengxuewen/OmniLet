// Second rule table (slice-2 Task 2): Web/own-container target, spec §3.1
// (user-ruled: exactly WeChat-wide vocabulary, option 4A). Row shapes mirror
// wechat.ts; golden namespace `g-web-gNNN` is disjoint from wechat `gNNN`
// (LOW-11 isolation, probed in tests/gates.test.ts P5). Lifecycle notes are
// runtime-behavior rulings recorded here as comments: onLoad fires at page
// init, onLaunch fires ONCE at FIRST page mount (app-level word on a static
// single-entry package, F9 — NOT per navigation); visibilitychange fires
// onShow/onHide; beforeunload/pagehide fires onUnload (spec §3.1).
// v-if value carries braces `data-if="{{ready}}"` — runtime strips (F8);
// :key VALUE vocabulary ('*this'/'index'/prop-name) carried verbatim (F7).
// Event modifiers (.stop etc.) NOT supported in web v1 — silently dropped
// today (rewrite.ts bind->catch is wechat-only math); declared gap + deferred
// minor, reopen trigger D22 Card 6.
// rpx row: primitive omitted — conversion is css.ts code (basis 750 hardcoded
// there), D22 Card 3 honest note. Golden tiers: g-web-g001..g019 template-side
// real bytes (rewrite-layer, recorded by Task 2 Step 4); g-web-g020..g025 are
// codegen volumes (css/js/manifest) — expected.out.txt stays a non-empty
// placeholder until Task 3's codegen loop records real bytes; g-web-g026..g030
// lifecycle js-side volumes ride Task 4 the same way.
import type { RawTableSet } from '../src/tables'

export const webTables: RawTableSet = {
  tagMap: [
    { kind: 'tagMap', s: 'view', t: 'div', primitive: 'passthrough', golden: 'g-web-g001' },
    { kind: 'tagMap', s: 'text', t: 'span', primitive: 'passthrough', golden: 'g-web-g002' },
    { kind: 'tagMap', s: 'button', t: 'button', primitive: 'passthrough', golden: 'g-web-g003' },
  ],
  directiveMap: [
    { kind: 'directiveMap', s: 'v-if', t: 'data-if', primitive: 'rename', wrap: true, golden: 'g-web-g004' },
    {
      kind: 'directiveMap',
      s: 'v-for',
      t: 'data-for',
      primitive: 'splitDirective',
      wrap: true,
      forItem: 'data-for-item',
      forIndex: 'data-for-index',
      golden: 'g-web-g005',
    },
    { kind: 'directiveMap', s: ':key', t: 'data-key', primitive: 'keyTransform', golden: 'g-web-g006' },
    // :class/:style rename+wrap rows, same-source shape as wechat (object/array
    // literals reject at the visitor as NEGATIVE class-obj (202)).
    { kind: 'directiveMap', s: ':class', t: 'class', primitive: 'rename', wrap: true, golden: 'g-web-g018' },
    { kind: 'directiveMap', s: ':style', t: 'style', primitive: 'rename', wrap: true, golden: 'g-web-g019' },
  ],
  eventMap: [
    { kind: 'eventMap', s: '@tap', t: 'click', primitive: 'valueMap', golden: 'g-web-g007' },
  ],
  // Web timing (spec §3.1 / F9): onLoad at page init; onLaunch ONCE at FIRST
  // page mount — app-level word on a static single-entry package, NOT per
  // navigation. No `t` = identity passthrough (same as wechat).
  lifecycleMap: [
    { kind: 'lifecycleMap', s: 'onLoad', primitive: 'lifecyclePassthrough', golden: 'g-web-g026' },
    { kind: 'lifecycleMap', s: 'onShow', primitive: 'lifecyclePassthrough', golden: 'g-web-g027' },
    { kind: 'lifecycleMap', s: 'onHide', primitive: 'lifecyclePassthrough', golden: 'g-web-g028' },
    { kind: 'lifecycleMap', s: 'onUnload', primitive: 'lifecyclePassthrough', golden: 'g-web-g029' },
    { kind: 'lifecycleMap', s: 'onLaunch', primitive: 'lifecyclePassthrough', golden: 'g-web-g030' },
  ],
  // Identical operator list to wechat (spec §3.1: same author grammar;
  // ?./??/calls OUT — grammar parity on web, platform uncertainty on wechat;
  // D22/F6: widening = expr.ts parser change, NOT a table-row add).
  exprWhitelist: [
    { kind: 'exprWhitelist', s: 'Identifier', golden: 'g-web-g008' },
    { kind: 'exprWhitelist', s: 'MemberExpression', golden: 'g-web-g009' },
    { kind: 'exprWhitelist', s: 'StringLiteral', golden: 'g-web-g010' },
    { kind: 'exprWhitelist', s: 'NumericLiteral', golden: 'g-web-g011' },
    { kind: 'exprWhitelist', s: 'BooleanLiteral', golden: 'g-web-g012' },
    { kind: 'exprWhitelist', s: 'NullLiteral', golden: 'g-web-g013' },
    { kind: 'exprWhitelist', s: 'BinaryExpression', t: '+, -, *, /, %, ==, ===, !=, !==, <, <=, >, >=', golden: 'g-web-g014' },
    { kind: 'exprWhitelist', s: 'LogicalExpression', t: '&&, ||', golden: 'g-web-g015' },
    { kind: 'exprWhitelist', s: 'UnaryExpression', t: '!, -, +', golden: 'g-web-g016' },
    { kind: 'exprWhitelist', s: 'ConditionalExpression', golden: 'g-web-g017' },
  ],
  // rpx->px (750-basis: 1rpx = 0.5px @375px viewport, D22 Card 3). No
  // `primitive` field — the conversion is css.ts unit-math code consuming this
  // row (basis 750 hardcoded in css.ts); on wechat the row is identity. The
  // class row = the single prefix source (classPrefix), same as wechat.
  styleRules: [
    { kind: 'styleRules', s: 'rpx', t: 'px', golden: 'g-web-g020' },
    { kind: 'styleRules', s: 'class', t: 'omnilet-', primitive: 'classPrefix', golden: 'g-web-g021' },
    { kind: 'styleRules', s: 'selector:class', golden: 'g-web-g022' },
    { kind: 'styleRules', s: 'selector:tag', golden: 'g-web-g023' },
    { kind: 'styleRules', s: 'selector:pseudo', golden: 'g-web-g024' },
  ],
  // Declaration word = grant word (D17): same word, same capabilities.json.
  capabilityRules: [
    { kind: 'capabilityRules', s: 'storage', t: 'omnilet.storage', golden: 'g-web-g025' },
  ],
}
