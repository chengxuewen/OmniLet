// Slice-2 Task 3: web shell emitter — index.html with inlined per-page template
// blocks (delivery seam (a), plan "Spec-code reconciliation" note 1: the frozen
// spec §2 file list has no per-page template file; the shell carries them).
import { describe, expect, it } from 'vitest'
import { emitHtml, emitPageTemplate } from './html'
import type { OutNode } from '../rewrite'

describe('emitHtml web shell', () => {
  it('mount point + one template block per page + runtime/main script tags', () => {
    const html = emitHtml([{ name: 'pages/index/index' }], { title: 'counter' })
    expect(html).toContain('<div id="app"></div>')
    expect(html).toContain('<script type="text/omnilet-template" data-page="pages/index/index">')
    expect(html).toContain('<script src="./omnilet-runtime.js"></script>')
    expect(html).toContain('<script src="./main.js"></script>')
  })
  it('template block carries emitted elements verbatim; braces preserved', () => {
    const tpl = emitPageTemplate('pages/index/index', [
      { kind: 'el', tag: 'div', attrs: [{ k: 'data-if', v: '{{ready}}' }], children: [{ kind: 'interp', raw: 'count' }] },
    ] satisfies OutNode[])
    expect(tpl).toContain('<div data-if="{{ready}}">')
    expect(tpl).toContain('{{count}}')
  })
})
