// Task 10 (compile-slice1): STRUCTURAL tier (spec §6 — file tree + ajv +
// official wxml compiler parse + zero-#ifdef grep + manifest + TYPE-tier tsc
// consumption of the emitted .d.ts + CLI exit-code shell). This is T2-tier in
// test-matrix terms; running it inside the compiler package keeps slice-1 cheap.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { compileProject } from './compileProject'

const SRC = dirname(fileURLToPath(import.meta.url))
const PKG = join(SRC, '..')
const SCHEMA = join(PKG, '..', 'packages', 'rule-schema', 'schema')

const EXPECTED_TREE = [
  'app.js',
  'app.json',
  'omnilet.d.ts',
  'omnilet.manifest.json',
  'pages/index/index.js',
  'pages/index/index.json',
  'pages/index/index.wxml',
  'pages/index/index.wxss',
]

function walk(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  )
}

describe('structural tier over the counter build', () => {
  const out = mkdtempSync(join(tmpdir(), 'omnilet-struct-'))

  beforeAll(async () => {
    const r = await compileProject({ root: join(PKG, 'tests', 'fixtures', 'counter'), outDir: out })
    expect(r.ok).toBe(true)
  })
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('file tree is EXACT (nothing extra, nothing missing)', () => {
    expect(walk(out).sort()).toEqual(EXPECTED_TREE)
  })

  it('app.json + page json validate against the rule-schema structural schemas', () => {
    const ajv = new Ajv2020({ allErrors: true })
    const app = ajv.compile(JSON.parse(readFileSync(join(SCHEMA, 'app.schema.json'), 'utf8')))
    const page = ajv.compile(JSON.parse(readFileSync(join(SCHEMA, 'page.schema.json'), 'utf8')))
    expect(app(JSON.parse(readFileSync(join(out, 'app.json'), 'utf8')))).toBe(true)
    expect(page(JSON.parse(readFileSync(join(out, 'pages', 'index', 'index.json'), 'utf8')))).toBe(true)
    // bite probe: a merged app.json MUST have pages — schema rejects the author-only shape
    expect(app({ window: {} })).toBe(false)
  })

  it('official miniprogram-compiler parses the emitted wxml (throw-free)', () => {
    const req = createRequire(join(PKG, 'noop.js'))
    const mp = req('miniprogram-compiler') as { wxmlToJs(root: string): string }
    expect(mp.wxmlToJs(out).length).toBeGreaterThan(1000) // compiled payload; parse-throw = fail
    // bite probe (same tree, poisoned wxml): the parser DOES throw on broken markup
    const bad = mkdtempSync(join(tmpdir(), 'omnilet-struct-bad-'))
    try {
      writeFileSync(join(bad, 'x.wxml'), '<view class="a"')
      expect(() => mp.wxmlToJs(bad)).toThrow(/wxml/)
    } finally {
      rmSync(bad, { recursive: true, force: true })
    }
  })

  it('zero #ifdef across every emitted byte (redline-1 machine form)', () => {
    const re = /#if(def)?\b|#else\b|#endif\b|@ifdef\b/
    // gate self-prove both directions: real conditional markers DO match...
    expect(re.test('<!-- #ifdef wechat -->\n<view/>\n<!-- #endif -->')).toBe(true)
    expect(re.test('x = y /* @ifdef web */ z')).toBe(true)
    expect(re.test('#ifdefx is not a marker')).toBe(false)
    // ...and CSS/JS hash-color text does NOT (the old unbounded '#if' over-matched)
    expect(re.test('.a { color: #333; background: #ffffff; }')).toBe(false)
    for (const rel of EXPECTED_TREE) expect(re.test(readFileSync(join(out, rel), 'utf8'))).toBe(false)
  })

  it('manifest sidecar = valid JSON with the storage capability (D17 audit word)', () => {
    const m = JSON.parse(readFileSync(join(out, 'omnilet.manifest.json'), 'utf8')) as {
      omniletManifestVersion: number
      capabilities: string[]
    }
    expect(m.omniletManifestVersion).toBe(1)
    expect(m.capabilities).toContain('storage')
  })

  it('TYPE tier: emitted omnilet.d.ts passes tsc --noEmit for a facade consumer', () => {
    const probe = mkdtempSync(join(tmpdir(), 'omnilet-types-'))
    const tsc = join(PKG, 'node_modules', 'typescript', 'bin', 'tsc')
    try {
      writeFileSync(join(probe, 'omnilet.d.ts'), readFileSync(join(out, 'omnilet.d.ts')))
      writeFileSync(
        join(probe, 'consumer.ts'),
        "import { reactive } from 'omnilet'\nconst s = reactive({ n: 1 })\ns.n = s.n + 1\n",
      )
      const good = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', 'omnilet.d.ts', 'consumer.ts'], {
        cwd: probe,
        encoding: 'utf8',
      })
      expect(good.status).toBe(0)
      // bite probe: the same command must REJECT a vocabulary word off the facade
      writeFileSync(join(probe, 'consumer.ts'), "import { notAWord } from 'omnilet'\nexport const x = notAWord\n")
      const bad = spawnSync(process.execPath, [tsc, '--noEmit', '--strict', 'omnilet.d.ts', 'consumer.ts'], {
        cwd: probe,
        encoding: 'utf8',
      })
      expect(bad.status).not.toBe(0)
    } finally {
      rmSync(probe, { recursive: true, force: true })
    }
  })
})

describe('CLI thin shell (exit codes + diagnostic text)', () => {
  const tsx = join(PKG, 'node_modules', '.bin', 'tsx')
  const cli = join(SRC, 'cli.ts')

  it('--dir/--out happy path exits 0 and lists artifacts', () => {
    const out = mkdtempSync(join(tmpdir(), 'omnilet-cli-'))
    try {
      const r = spawnSync(tsx, [cli, '--dir', join(PKG, 'tests', 'fixtures', 'counter'), '--out', out, '--mode', 'dev'], {
        encoding: 'utf8',
        cwd: PKG,
      })
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('OK')
      expect(r.stdout).toContain('omnilet.manifest.json')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('unregistered capability exits 1 with the 401 line + hint', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'omnilet-cli-bad-')), 'pkg')
    mkdirSync(dirname(out), { recursive: true })
    try {
      const r = spawnSync(tsx, [cli, '--dir', join(PKG, 'tests', 'fixtures', 'badcap'), '--out', out], {
        encoding: 'utf8',
        cwd: PKG,
      })
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('401')
      expect(r.stderr).toContain('hint:')
      expect(existsSync(out)).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('arg misuse exits 1 with usage, compiles nothing', () => {
    const r = spawnSync(tsx, [cli, '--dir'], { encoding: 'utf8', cwd: PKG })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('usage:')
  })
})
