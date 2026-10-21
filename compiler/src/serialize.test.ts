// Task 8: the serializer contract (WXML-FLAT tree text). This file is the byte
// contract's own pin — see the header of rewrite.ts for the full definition.
import { describe, expect, it } from 'vitest'
import { serializeAst, type OutNode } from './rewrite'
import { assertNormalized } from '../../packages/rule-schema/src/index'

describe('serializeAst contract', () => {
  const tree: OutNode = {
    kind: 'el',
    tag: 'view',
    attrs: [
      { k: 'wx:if', v: '{{ready}}' },
      { k: 'class', v: 'box' },
    ],
    children: [
      { kind: 'text', value: 'hi ' },
      { kind: 'interp', raw: 'count + 1' },
      { kind: 'el', tag: 'button', attrs: [], children: [{ kind: 'text', value: 'tap' }] },
    ],
  }

  it('element line = tag + attr="value" in array order; children indented 2; closing tag', () => {
    expect(serializeAst(tree)).toBe(
      '<view wx:if="{{ready}}" class="box">\n' +
        '  text:hi \n' +
        '  {{count + 1}}\n' +
        '  <button>\n' +
        '    text:tap\n' +
        '  </button>\n' +
        '</view>\n',
    )
  })

  it('empty element = open + close lines (no self-closing special case)', () => {
    expect(serializeAst({ kind: 'el', tag: 'view', attrs: [], children: [] })).toBe('<view>\n</view>\n')
  })

  it('array input (root children) lists nodes at the given depth', () => {
    expect(serializeAst([tree.children[0]!, tree.children[1]!])).toBe('text:hi \n{{count + 1}}\n')
  })

  it('output conforms to NORMALIZATION.md: LF, 2-space steps, no blank lines', () => {
    const text = serializeAst(tree)
    expect(() => assertNormalized(text)).not.toThrow()
    expect(text.endsWith('\n')).toBe(true)
    expect(text.includes('\n\n')).toBe(false)
  })

  it('attr order is the array order — serializer never sorts (order = table emission order, owned by rewrite)', () => {
    const el: OutNode = { kind: 'el', tag: 'view', attrs: [{ k: 'a', v: '1' }, { k: 'b', v: '2' }], children: [] }
    expect(serializeAst(el)).toBe('<view a="1" b="2">\n</view>\n')
    expect(serializeAst({ ...el, attrs: [...el.attrs].reverse() })).toBe('<view b="2" a="1">\n</view>\n')
  })
})
