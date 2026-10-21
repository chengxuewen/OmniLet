// Task 10 (compile-slice1): codegen family + full-chain golden + the Babel
// module-boundary redline (spec §2: "@babel 只准住 codegen/js.ts"; the regenerator
// dead-branch volume is a T12 assembly item — this slice enforces the boundary).
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertNormalized } from '../../packages/rule-schema/src/index'
import { loadTables } from './tables'
import { wechatTables } from '../rules/wechat'
import { emitWxml } from './codegen/wxml'
import { emitWxss } from './codegen/wxss'
import { emitAppJs, emitModuleJs, emitPageJs } from './codegen/js'
import { emitPageJson, mergeAppJson } from './codegen/appjson'
import { emitManifest } from './codegen/manifest'
import { emitDts } from './codegen/dts'
import { compileProject } from './compileProject'
import type { OutNode } from './rewrite'

const SRC = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(SRC, '..', 'tests', 'golden')
const tables = loadTables(wechatTables)

// ------------------------------------------------------- Babel module boundary

describe('redline: @babel imports live only in src/codegen/js.ts', () => {
  const tsFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
    )
  it('scan finds the resident (positive control = the gate can bite)', () => {
    const files = tsFiles(SRC).filter((f) => !f.endsWith('.test.ts')) // redline scope: shipped modules
    const needle = /from '@babel|import\('@babel/
    expect(needle.test(readFileSync(join(SRC, 'codegen', 'js.ts'), 'utf8'))).toBe(true) // self-prove the pattern hits
    const hits = files
      .filter((f) => needle.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'))
    expect(hits).toEqual(['codegen/js.ts'])
  })
})

// ------------------------------------------------------------------ emitWxml

describe('emitWxml — OutNode tree -> inline WXML text', () => {
  const el = (tag: string, attrs: [string, string][], children: OutNode[] = []): OutNode => ({
    kind: 'el',
    tag,
    attrs: attrs.map(([k, v]) => ({ k, v })),
    children,
  })
  it('renders paired tags, inline children, ordered attrs, interpolation', () => {
    const tree = [el('view', [['wx:if', '{{ok}}'], ['class', 'omnilet-box']], [el('text', [], [{ kind: 'interp', raw: 'count' }])])]
    expect(emitWxml(tree)).toBe('<view wx:if="{{ok}}" class="omnilet-box"><text>{{count}}</text></view>\n')
  })
  it('empty element keeps the paired form; text leaves pass through verbatim', () => {
    expect(emitWxml([el('view', []), { kind: 'text', value: 'a  b' }])).toBe('<view></view>a  b\n')
  })
  it('double quotes inside attr values escape (single-quoted source attrs)', () => {
    expect(emitWxml([el('view', [['title', 'say "hi"']])])).toBe('<view title="say &quot;hi&quot;"></view>\n')
  })
})

// ------------------------------------------------------------------ emitWxss

describe('emitWxss — prefix + selector whitelist (table-driven)', () => {
  const run = (css: string) => emitWxss(css, 't.css', tables)
  it('class selectors take the omnilet- prefix; declarations untouched (rpx identity)', () => {
    const r = run('.box { color: #333; padding: 10rpx; }')
    expect(r.diagnostics).toEqual([])
    expect(r.code).toBe('.omnilet-box { color: #333; padding: 10rpx; }\n')
  })
  it('id selector rejects 212 and drops only its selector', () => {
    const r = run('#top, .box { color: red; }')
    expect(r.diagnostics.map((d) => d.code)).toEqual([212])
    expect(r.code).toBe('.omnilet-box { color: red; }\n')
  })
  it('all selectors of a rule rejected -> rule gone; descendant combinators stay', () => {
    const r = run('#a, #b { color: red; }\n.list .item { color: blue; }')
    expect(r.diagnostics.map((d) => d.code)).toEqual([212, 212])
    expect(r.code).toBe('.omnilet-list .omnilet-item { color: blue; }\n')
  })
  it('at-rules reject 212 (no styleRules row claims them)', () => {
    const r = run('@media screen { .a { color: red; } }')
    expect(r.diagnostics.map((d) => d.code)).toEqual([212])
    expect(r.code).toBe('')
  })
  it('explicit > + ~ combinators reject (table declares compound families only)', () => {
    expect(run('a > .b { color: red; }').diagnostics.map((d) => d.code)).toEqual([212])
  })
  it('already-prefixed words pass through (template/css drift guard)', () => {
    expect(run('.omnilet-box { color: red; }').code).toBe('.omnilet-box { color: red; }\n')
  })
})

// -------------------------------------------------------- codegen row volumes

type VolumeKind = 'css' | 'manifest' | 'js-page' | 'js-app'
const VOLUMES: [string, VolumeKind][] = [
  ['g020', 'css'],
  ['g022', 'css'],
  ['g023', 'css'],
  ['g024', 'css'],
  ['g025', 'manifest'],
  ['g026', 'js-page'],
  ['g027', 'js-page'],
  ['g028', 'js-page'],
  ['g029', 'js-page'],
  ['g030', 'js-app'],
]

describe('codegen volumes g020-g030 (recorded by T10, styleRules/js/manifest rows)', () => {
  for (const [id, kind] of VOLUMES) {
    it(`${id} (${kind}) in -> expected.out.txt byte-for-byte`, () => {
      const inp = readFileSync(join(GOLDEN, id, 'in.html'), 'utf8')
      const stored = readFileSync(join(GOLDEN, id, 'expected.out.txt'), 'utf8')
      expect(() => assertNormalized(stored)).not.toThrow()
      let code = ''
      let diags: { code: number }[] = []
      if (kind === 'css') {
        const r = emitWxss(inp, `${id}.css`, tables)
        code = r.code
        diags = r.diagnostics
      } else if (kind === 'manifest') {
        const words = inp.split(',').map((s) => s.trim()).filter((s) => s !== '')
        code = emitManifest(words)
      } else if (kind === 'js-page') {
        const r = emitPageJs(inp, `pages/${id}/${id}`)
        code = r.code ?? ''
        diags = r.diagnostics
      } else {
        const r = emitAppJs(inp)
        code = r.code ?? ''
        diags = r.diagnostics
      }
      expect(diags).toEqual([])
      expect(code).toBe(stored)
    })
  }
})

// ------------------------------------------------------------------ emitJs gates

describe('emitJs pre-transform gates (never a silent half-strip)', () => {
  const opts = { file: 'p.ts', factory: 'createPage' as const, runtimeRel: '../omnilet-runtime.js' }
  const page = (body: string) => `import { reactive } from 'omnilet'\nconst state = reactive({})\n${body}\n`
  it('enum -> 204 with kind named, file not emitted', () => {
    const r = emitModuleJs(page('enum E { A }\nexport default { state }'), opts)
    expect(r.code).toBeNull()
    expect(r.diagnostics.map((d) => d.code)).toEqual([204])
    expect(r.diagnostics[0]!.message).toContain('TSEnumDeclaration')
  })
  it('namespace -> 204', () => {
    expect(emitModuleJs(page('namespace N { export const x = 1 }\nexport default { state }'), opts).diagnostics.map((d) => d.code)).toEqual([204])
  })
  it('parameter property -> 204', () => {
    expect(emitModuleJs(page('class C { constructor(private x: number) {} }\nexport default { state }'), opts).diagnostics.map((d) => d.code)).toEqual([204])
  })
  it('multiple kinds -> one 204 per kind', () => {
    expect(emitModuleJs(page('enum E { A }\nnamespace N { export const x = 1 }\nexport default { state }'), opts).diagnostics.length).toBe(2)
  })
  it('import from any other module rejects 213', () => {
    const r = emitModuleJs(`import { x } from 'lodash'\nexport default { x }`, opts)
    expect(r.code).toBeNull()
    expect(r.diagnostics.map((d) => d.code)).toEqual([213])
  })
  it('export default not an object literal rejects 213', () => {
    expect(emitModuleJs(`export default 42`, opts).diagnostics.map((d) => d.code)).toEqual([213])
  })
  it('missing export default rejects 213', () => {
    expect(emitModuleJs(`const a = 1`, opts).diagnostics.map((d) => d.code)).toEqual([213])
  })
  it('type-only imports erase cleanly (no require binding for them)', () => {
    const r = emitModuleJs(`import { reactive, type Foo } from 'omnilet'\nconst s = reactive({})\nexport default { s }`, opts)
    expect(r.diagnostics).toEqual([])
    expect(r.code).toContain("const { reactive, createPage } = require('../omnilet-runtime.js')")
    expect(r.code).not.toContain('Foo')
  })
  it('aliased import keeps the alias in the require destructure', () => {
    const r = emitModuleJs(`import { reactive as r } from 'omnilet'\nconst s = r({})\nexport default { s }`, opts)
    expect(r.code).toContain('const { reactive: r, createPage } = require(')
  })

  // T10 review fix item 1: facade-name shadowing used to emit a duplicate-const
  // SyntaxError product with ZERO diagnostics — now a 214 reject, file skipped.
  it('top-level const shadowing an imported facade word -> 214, not emitted', () => {
    const r = emitModuleJs(`import { reactive } from 'omnilet'\nconst reactive = { a: 1 }\nexport default { reactive }`, opts)
    expect(r.code).toBeNull()
    expect(r.diagnostics.map((d) => d.code)).toEqual([214])
    expect(r.diagnostics[0]!.message).toContain("'reactive'")
  })
  it('destructured / function / factory-name shadows all -> 214', () => {
    expect(emitModuleJs(`const { watch } = api()\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    expect(emitModuleJs(`const [ref] = xs\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    expect(emitModuleJs(`function computed() {}\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    expect(emitModuleJs(`const createPage = 1\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    // final-review wave item 2: RestElement carries .argument, not .value --
    // `...reactive` escaped the gate pre-fix (device SyntaxError, zero diags)
    expect(emitModuleJs(`const { a, ...reactive } = api()\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    expect(emitModuleJs(`const { a, ...watch } = api()\nexport default {}`, opts).diagnostics[0]!.message).toContain("'watch'")
    expect(emitModuleJs(`const [first, ...computed] = xs\nexport default {}`, opts).diagnostics.map((d) => d.code)).toEqual([214])
    // no false bite: non-facade rest names pass
    expect(emitModuleJs(`import { reactive } from 'omnilet'\nconst { a, ...rest } = api()\nexport default { s: reactive(a) }`, opts).diagnostics).toEqual([])
  })
  it('non-facade top-level names stay untouched (no false bite)', () => {
    const r = emitModuleJs(`import { reactive } from 'omnilet'\nconst { state } = store()\nexport default { state: reactive(state) }`, opts)
    expect(r.diagnostics).toEqual([])
    expect(r.code).toContain('createPage(')
  })
})

// ------------------------------------------------------- appjson + manifest + dts

describe('mergeAppJson / emitPageJson / emitManifest / emitDts', () => {
  it('author pages absent -> generated (sorted) injected; other keys pass through', () => {
    const r = mergeAppJson('{"window":{"navigationBarTitleText":"x"}}', ['pages/b/b', 'pages/a/a'])
    expect(r.diagnostics).toEqual([])
    expect(r.json).toBe('{\n  "window": {\n    "navigationBarTitleText": "x"\n  },\n  "pages": [\n    "pages/a/a",\n    "pages/b/b"\n  ]\n}\n')
  })
  it('author pages set-equal -> author order wins; set-mismatch -> 402, no json', () => {
    expect(mergeAppJson('{"pages":["pages/b/b","pages/a/a"]}', ['pages/a/a', 'pages/b/b']).json).toContain('"pages": [\n    "pages/b/b"')
    const bad = mergeAppJson('{"pages":["pages/a/a"]}', ['pages/a/a', 'pages/b/b'])
    expect(bad.json).toBeNull()
    expect(bad.diagnostics.map((d) => d.code)).toEqual([402])
  })
  it('invalid app.json -> 124; non-object -> 124', () => {
    expect(mergeAppJson('{oops', []).diagnostics.map((d) => d.code)).toEqual([124])
    expect(mergeAppJson('[1]', []).diagnostics.map((d) => d.code)).toEqual([124])
  })
  it('page json: passthrough + component:true; false -> 403; absent -> default object', () => {
    expect(emitPageJson('{"navigationBarTitleText":"c"}', 'p.json').json).toContain('"component": true')
    expect(emitPageJson('{"component":false}', 'p.json').diagnostics.map((d) => d.code)).toEqual([403])
    expect(emitPageJson(null, 'p.json').json).toBe('{\n  "component": true\n}\n')
    expect(emitPageJson('nonsense', 'p.json').diagnostics.map((d) => d.code)).toEqual([125])
  })
  it('manifest = sorted deduped union, stable keys, 2-space', () => {
    expect(emitManifest(['storage', 'storage'])).toBe(
      '{\n  "omniletManifestVersion": 1,\n  "capabilities": [\n    "storage"\n  ],\n  "builtBy": "omnilet-compiler@0.1.0-slice1"\n}\n',
    )
  })
  it('d.ts declares the dsl-spec §1 facade vocabulary', () => {
    const dts = emitDts()
    for (const word of ["declare module 'omnilet'", 'reactive', 'ref<', 'computed', 'watch']) expect(dts).toContain(word)
    expect(() => assertNormalized(dts)).not.toThrow()
  })
})

// ---------------------------------------------------------- full-chain golden

const ALL_FILES = [
  'app.js',
  'app.json',
  'omnilet-runtime.js',
  'omnilet.d.ts',
  'omnilet.manifest.json',
  'pages/index/index.js',
  'pages/index/index.json',
  'pages/index/index.wxml',
  'pages/index/index.wxss',
]

describe('compileProject(counter) -> g100-counter-out full-chain golden', () => {
  it('every artifact byte == golden, normalized, spot-pinned', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'omnilet-g100-'))
    try {
      const result = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'counter'), outDir: tmp })
      expect(result.diagnostics).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.artifacts).toEqual(ALL_FILES)

      const goldenDir = join(GOLDEN, 'g100-counter-out')
      if (process.env.RECORD_GOLDEN) {
        // record-from-measured-run (brief): overwrite the golden with current bytes
        for (const rel of ALL_FILES) writeFileSync(join(goldenDir, rel), readFileSync(join(tmp, rel), 'utf8'))
      }

      for (const rel of ALL_FILES) {
        const produced = readFileSync(join(tmp, rel), 'utf8')
        const stored = readFileSync(join(goldenDir, rel), 'utf8')
        // omnilet-runtime.js = esbuild-bundled vendor bytes: the 2-space-step +
        // path-hygiene contract governs codegen-written text, and vue's internal
        // indentation does not obey it. The bundle is still byte-pinned here and
        // proven live by behavior.test.ts — normalization exemption, not pin loss.
        if (rel !== 'omnilet-runtime.js') {
          expect(() => assertNormalized(produced)).not.toThrow()
          expect(() => assertNormalized(stored)).not.toThrow()
        }
        expect({ file: rel, bytes: produced }).toEqual({ file: rel, bytes: stored })
      }

      // content spot-pins (measured, not assigned — a golden rewrite that changes
      // behavior reddens here even under RECORD_GOLDEN):
      const wxml = readFileSync(join(tmp, 'pages/index/index.wxml'), 'utf8')
      expect(wxml).toContain('wx:for="{{list}}"')
      expect(wxml).toContain('wx:key="index"')
      const pageJs = readFileSync(join(tmp, 'pages/index/index.js'), 'utf8')
      expect(pageJs).toContain("require('../../omnilet-runtime.js')")
      expect(pageJs).toContain('createPage(')
      expect(readFileSync(join(tmp, 'app.js'), 'utf8')).toContain('createApp(')
      const manifest = JSON.parse(readFileSync(join(tmp, 'omnilet.manifest.json'), 'utf8')) as { capabilities: string[] }
      expect(manifest.capabilities).toEqual(['storage'])
      expect(readFileSync(join(tmp, 'omnilet.d.ts'), 'utf8')).toContain("declare module 'omnilet'")
      const pageJson = JSON.parse(readFileSync(join(tmp, 'pages/index/index.json'), 'utf8')) as Record<string, unknown>
      expect(pageJson.component).toBe(true)
      expect(pageJson.navigationBarTitleText).toBe('counter')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

// ------------------------------------------------------------ fail-closed e2e

describe('capability refusal blocks the whole emit (4xx before write)', () => {
  it('unregistered requires word -> ok=false, 401, artifacts empty, nothing written', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'omnilet-badcap-'))
    const outDir = join(tmp, 'out') // deliberately NOT pre-created
    try {
      const r = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'badcap'), outDir })
      expect(r.ok).toBe(false)
      expect(r.diagnostics.map((d) => d.code)).toEqual([401])
      expect(r.diagnostics[0]!.message).toContain('network')
      expect(r.artifacts).toEqual([])
      expect(existsSync(outDir)).toBe(false)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

// T11: 'prod' now builds — the mode leg it promised is the esbuild vendor
// minify (all other artifact bytes are mode-independent by contract).
describe("mode 'prod' = minified vendor, identical js", () => {
  it('prod builds; vendor smaller than dev; page js byte-identical', async () => {
    const tmpDev = mkdtempSync(join(tmpdir(), 'omnilet-mode-dev-'))
    const tmpProd = mkdtempSync(join(tmpdir(), 'omnilet-mode-prod-'))
    try {
      const root = join(SRC, '..', 'tests', 'fixtures', 'counter')
      const dev = await compileProject({ root, outDir: tmpDev, mode: 'dev' })
      const prod = await compileProject({ root, outDir: tmpProd, mode: 'prod' })
      expect(dev.ok && prod.ok).toBe(true)
      const devV = readFileSync(join(tmpDev, 'omnilet-runtime.js'), 'utf8')
      const prodV = readFileSync(join(tmpProd, 'omnilet-runtime.js'), 'utf8')
      expect(devV).toContain('/*! omnilet-runtime') // banner survives in dev
      expect(prodV).toContain('/*! omnilet-runtime') // /*! banner survives minify
      expect(prodV.length).toBeLessThan(devV.length)
      expect(readFileSync(join(tmpProd, 'pages/index/index.js'), 'utf8')).toBe(readFileSync(join(tmpDev, 'pages/index/index.js'), 'utf8'))
    } finally {
      rmSync(tmpDev, { recursive: true, force: true })
      rmSync(tmpProd, { recursive: true, force: true })
    }
  })
})
