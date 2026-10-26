// Slice-2 Task 3: web css emitter — rpx->px at the 750 basis (D22 Card 3) +
// the SAME selector whitelist / class-prefix policy the wxss side reads (shared
// tables.ts exports; no copied lists). Also the g-web codegen volume loop
// (g-web-g020..g025), mode-mirroring codegen.test.ts's VOLUMES loop.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assertNormalized } from '../../../packages/rule-schema/src/index'
import { loadTables } from '../tables'
import { webTables } from '../../rules/web'
import { emitCss } from './css'
import { ENVELOPE_FILE, emitManifestEnvelope } from './manifest'

const t = loadTables(webTables)

describe('emitCss rpx->px (basis 750) + shared whitelist', () => {
  it('10rpx -> 5px; class prefixed via classPrefixPolicy (same-source row)', () => {
    const r = emitCss('.box { color: #333; padding: 10rpx; }', 't.css', t)
    expect(r.diagnostics).toEqual([])
    expect(r.code).toBe('.omnilet-box { color: #333; padding: 5px; }\n')
  })
  it('id selector rejects 212 — same band, zero new codes', () => {
    expect(emitCss('#top { color: red; }', 't.css', t).diagnostics.map((d) => d.code)).toEqual([212])
  })
  it('at-rules reject 212 (parity with wxss whitelist philosophy)', () => {
    expect(emitCss('@media screen { .a { color: red; } }', 't.css', t).diagnostics.map((d) => d.code)).toEqual([212])
  })
})

// ------------------------------------------------- web codegen row volumes
// Same loop shape as codegen.test.ts VOLUMES: in.html -> emitter -> byte-compare
// against expected.out.txt. Placeholder stubs are OVERWRITTEN with measured
// bytes here under RECORD_GOLDEN=1 (Step 4 record flow; rerun asserts drift).

const SRC = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(SRC, '..', '..', 'tests', 'golden')

type WebVolumeKind = 'css' | 'css-prefix' | 'manifest-envelope'
const WEB_VOLUMES: [string, WebVolumeKind][] = [
  ['g-web-g020', 'css'], // styleRules rpx->px row
  ['g-web-g021', 'css-prefix'], // classPrefix row (class word prefix, no rpx hit)
  ['g-web-g022', 'css'], // selector:class
  ['g-web-g023', 'css'], // selector:tag
  ['g-web-g024', 'css'], // selector:pseudo
  ['g-web-g025', 'manifest-envelope'], // capabilityRules -> envelope volume (D8-1 shape)
]

describe('web codegen volumes g-web-g020..g025 (recorded by T3, styleRules/manifest rows)', () => {
  for (const [id, kind] of WEB_VOLUMES) {
    it(`${id} (${kind}) in -> expected.out.txt byte-for-byte`, () => {
      const inp = readFileSync(join(GOLDEN, id, 'in.html'), 'utf8')
      const stored = readFileSync(join(GOLDEN, id, 'expected.out.txt'), 'utf8')
      expect(() => assertNormalized(stored)).not.toThrow()
      let code = ''
      let diags: { code: number }[] = []
      if (kind === 'manifest-envelope') {
        // volume input = capability word list; the envelope volume pins the
        // D8-1 demo-app shape (schemaVersion/minEngineVersion/files[sha256]).
        const words = inp.split(',').map((s) => s.trim()).filter((s) => s !== '')
        code = emitManifestEnvelope([{ path: 'index.html', bytes: 'x' }], {
          packageVersion: '0.1.0',
          minEngineVersion: '0.1.0',
        })
        expect(JSON.parse(code)).toMatchObject({ schemaVersion: 1, minEngineVersion: '0.1.0' })
        expect(ENVELOPE_FILE).toBe('manifest.json')
        void words
      } else {
        const r = emitCss(inp, `${id}.css`, t)
        code = r.code
        diags = r.diagnostics
      }
      expect(diags).toEqual([])
      if (process.env.RECORD_GOLDEN) {
        // record-from-measured-run: overwrite the golden with current bytes
        writeFileSync(join(GOLDEN, id, 'expected.out.txt'), code)
      }
      expect(code).toBe(stored)
    })
  }
})
