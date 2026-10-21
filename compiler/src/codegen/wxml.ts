// Task 10 (compile-slice1): WXML final text serialization.
//
// rewrite.ts (T8) owns the OUTNODE shape + emission ORDER (its serializeAst flat
// tree form is the rewrite-layer golden contract — `text:` markers and per-node
// lines). This module renders the SAME OutNode tree to real WXML text: children
// inline (no inserted whitespace — WXML renders text nodes verbatim, inventing
// indentation would change render), attributes `k="v"` in the already-ordered
// attr list, always-paired tags (`<view></view>`; self-closing omitted — paired
// form is valid WXML for every tag and the minimal-loss choice).
//
// Expression vs literal attr values need no local decision: the rewrite layer
// already brace-wrapped expression attrs per the table `wrap` flag (T10 ruling:
// the v-for row carries wrap:true → `wx:for="{{list}}"`).
import type { OutNode } from '../rewrite'

export function emitWxml(outAst: readonly OutNode[]): string {
  return `${outAst.map(render).join('')}\n`
}

function render(node: OutNode): string {
  switch (node.kind) {
    case 'el': {
      const attrs = node.attrs.map((a) => ` ${a.k}="${escAttr(a.v)}"`).join('')
      const kids = node.children.map(render).join('')
      return `<${node.tag}${attrs}>${kids}</${node.tag}>`
    }
    case 'text':
      return node.value
    case 'interp':
      return `{{${node.raw}}}`
  }
}

/** Keep `"` out of attribute values (single-quoted source attrs can carry them). */
function escAttr(v: string): string {
  return v.replace(/"/g, '&quot;')
}
