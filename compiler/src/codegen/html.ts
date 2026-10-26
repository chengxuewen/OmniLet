// Slice-2 Task 3: web shell + inline-template serialization.
//
// emitHtml: the web package's index.html shell — mount point, ONE
// `text/omnilet-template` script block PER PAGE (delivery seam (a): the spec §2
// frozen file list has no per-page template file, templates ride the shell),
// then the runtime + main entry script tags.
//
// emitPageTemplate: renders ONE page's rewritten OutNode tree to the block
// CONTENT — same render shape as wxml.ts (always-paired tags, attrs in the
// rewrite-ordered list, children inline, text verbatim) minus any wechat-isms:
// tags are already web-table real tags (view->div done at rewrite), `{{expr}}`
// interpolation passes through verbatim (the runtime expr-evaluator owns it).
import type { OutNode } from '../rewrite'

export function emitHtml(pages: readonly { name: string }[], opts: { title: string }): string {
  const blocks = pages
    .map((p) => `<script type="text/omnilet-template" data-page="${p.name}">\n${emitPageTemplate(p.name, [])}\n</script>`)
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    `<title>${escAttr(opts.title)}</title>`,
    '</head>',
    '<body>',
    '<div id="app"></div>',
    ...blocks,
    '<script src="./omnilet-runtime.js"></script>',
    '<script src="./main.js"></script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

// T4 note: compileProject passes each page's emitted tree through here and
// feeds the result into the matching block; the shell above keeps a placeholder
// empty-block body so the emitter stays total for the zero-page edge.
export function emitPageTemplate(pageName: string, outAst: readonly OutNode[]): string {
  void pageName
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

/** Keep `"` out of attribute values (same rule as wxml.ts). */
function escAttr(v: string): string {
  return v.replace(/"/g, '&quot;')
}
