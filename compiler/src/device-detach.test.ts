// Task 11 fix round 1 (reviewer finding 1): device-shaped detach regression that
// jsdom CANNOT mask. jsdom defines window.stop (so a bare `stop?.()` zombie reads
// as a function there), and node's `process` leaks into the page context — a real
// WeChat device has neither. This leg runs the ACTUAL vendor bundle bytes inside a
// bare node:vm context (no window/document/process/stop globals), drives the full
// createPage -> created -> write -> detached cycle, and asserts clean teardown.
// Companion to behavior.test.ts (which keeps its jsdom/simulate leg unchanged).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { RUNTIME_VENDOR } from './codegen/js'
import { compileProject } from './compileProject'

const SRC = dirname(fileURLToPath(import.meta.url))
const tick = () => new Promise((r) => setTimeout(r, 5))

function loadVendorBareVm(code: string): Record<string, unknown> {
  const ctx = vm.createContext({ module: { exports: {} } })
  new vm.Script(code).runInContext(ctx)
  return (ctx.module as { exports: Record<string, unknown> }).exports
}

describe('no-DOM-globals detach leg (device-shaped vm sandbox)', () => {
  it('bundle evaluates and detaches clean without window/document/process', async () => {
    // build through the real pipeline, then read the written bytes (same ones
    // the goldens pin) — not a re-typed copy (PIT rule: consume the shipped artifact)
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const out = mkdtempSync(join(tmpdir(), 'omnilet-device-vendor-'))
    try {
      const r = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'counter'), outDir: out })
      expect(r.ok).toBe(true)
      const code = readFileSync(join(out, RUNTIME_VENDOR), 'utf8')

      const { createPage } = loadVendorBareVm(code) as unknown as {
        createPage: (def: Record<string, unknown>) => {
          data: Record<string, unknown>
          created: (this: { setData(d: Record<string, unknown>): void }) => void
          detached: (this: { setData(d: Record<string, unknown>): void }) => void
        }
      }
      // the context really is bare: none of the jsdom/node leaks exist
      const ctx = vm.createContext({ module: { exports: {} } })
      new vm.Script(code).runInContext(ctx)
      for (const name of ['window', 'document', 'process', 'stop']) {
        expect(vm.runInContext(`typeof ${name}`, ctx)).toBe('undefined')
      }

      let loads = 0
      let unloads = 0
      const writes: Record<string, unknown>[] = []
      const inst = { setData: (d: Record<string, unknown>) => void writes.push(d) }
      const opts = createPage({ state: { count: 0 }, methods: {}, onLoad: () => { loads++ }, onUnload: () => { unloads++ } })
      expect(opts.data).toEqual({ count: 0 })
      opts.created.call(inst)
      expect(loads).toBe(1)
      await tick()
      expect(writes.length).toBe(1) // initial flush landed through the context Promise queue
      opts.detached.call(inst) // <-- before fix: ReferenceError: stop is not defined (old bundle)
      expect(unloads).toBe(1)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  // Final-review wave RIDER (retires the T11 prod-bake deferred item): the esbuild-
  // MINIFIED vendor must carry the full facade lifecycle in a bare vm — the exact
  // reviewer-described surface jsdom hides: methods mutating state, computed, watch,
  // ref, same-tick setData dedup, and post-detach write freeze (+ the no-DUM leaks).
  it('PROD vendor: full lifecycle in bare vm (methods/computed/watch/ref/dedup/freeze)', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const out = mkdtempSync(join(tmpdir(), 'omnilet-device-prod-'))
    try {
      const r = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'counter'), outDir: out, mode: 'prod' })
      expect(r.ok).toBe(true)
      const code = readFileSync(join(out, RUNTIME_VENDOR), 'utf8')

      const ctx = vm.createContext({ module: { exports: {} } })
      new vm.Script(code).runInContext(ctx)
      for (const name of ['window', 'document', 'process', 'stop']) {
        expect(vm.runInContext(`typeof ${name}`, ctx)).toBe('undefined')
      }
      type WxInstance = { setData(d: Record<string, unknown>): void }
      type WxPageOpts = {
        data: Record<string, unknown>
        methods: Record<string, () => void>
        created: (this: WxInstance) => void
        detached: (this: WxInstance) => void
      }
      const ex = (ctx.module as { exports: Record<string, unknown> }).exports as unknown as {
        createPage: (def: Record<string, unknown>) => WxPageOpts
        reactive: <T extends object>(o: T) => T
        ref: <T>(v: T) => { value: T }
        computed: <T>(g: () => T) => { value: T }
        watch: (src: () => unknown, cb: (n: unknown, o: unknown) => void) => void
      }

      const state = ex.reactive({ count: 0 })
      const double = ex.computed(() => state.count * 2)
      const seen: [unknown, unknown][] = []
      ex.watch(() => state.count, (n, o) => seen.push([n, o]))
      const r7 = ex.ref(7)
      let loads = 0
      let unloads = 0
      const writes: Record<string, unknown>[] = []
      const inst: WxInstance = { setData: (d) => void writes.push(d) }
      const opts = ex.createPage({
        state,
        methods: { inc() { state.count++ } },
        onLoad: () => { loads++ },
        onUnload: () => { unloads++ },
      })
      expect(opts.data).toEqual({ count: 0 })
      opts.created.call(inst)
      await tick()
      expect(loads).toBe(1)
      expect(writes.length).toBe(1) // initial flush

      opts.methods.inc()
      await tick()
      expect(state.count).toBe(1)
      expect(double.value).toBe(2)
      expect(r7.value).toBe(7)
      expect(seen).toEqual([[1, 0]])
      expect(writes.length).toBe(2)
      expect(writes[1]!.count).toBe(1)

      // tick dedup on the WRITE path: method increment + direct mutation in ONE
      // tick -> ONE setData wave with the latest value (measured record: watch
      // fires per change -> pairs [2,1],[3,2]; only the flush queue dedups)
      opts.methods.inc()
      state.count++
      await tick()
      expect(state.count).toBe(3)
      expect(double.value).toBe(6)
      expect(writes.length).toBe(3)
      expect(writes[2]!.count).toBe(3)
      expect(seen).toEqual([[1, 0], [2, 1], [3, 2]])

      // post-detach freeze: render effect stopped -> no further setData ever
      opts.detached.call(inst)
      expect(unloads).toBe(1)
      const frozen = writes.length
      state.count++
      await tick()
      expect(writes.length).toBe(frozen)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  it('the zombie-stop defect bites in the same sandbox (bite probe, old bytes from git)', () => {
    // red-line honesty (#35: execute, don't grep): the reviewer's repro must
    // actually throw here. Old bundle = the commit that shipped the zombie line.
    // Exempted via `git show` only when the object exists in this working tree
    // (never on a fresh clone without that history — vitest skips with a note).
    let shown: string | null
    try {
      shown = execFileSync(
        'git',
        ['show', '7fff691:compiler/tests/golden/g100-counter-out/omnilet-runtime.js'],
        { encoding: 'utf8', cwd: join(SRC, '..', '..'), stdio: ['ignore', 'pipe', 'ignore'] },
      )
    } catch {
      shown = null
    }
    if (shown === null) {
      // git object unavailable (shallow/clone contexts) — declared skip, not a fake green
      console.warn('SKIP bite probe: git object 7fff691 not resolvable in this checkout')
      return
    }
    const ctx = vm.createContext({ module: { exports: {} } })
    // The OLD bundle needs `process` just to LOAD (second defect the probe
    // found — jsdom/node leak it; real devices don't have it) — so emulate
    // that leak only here; the detached() line still dies on the bare `stop`.
    ctx.process = { env: {} }
    new vm.Script(shown).runInContext(ctx)
    const exportsOld = (ctx.module as { exports: Record<string, unknown> }).exports
    const createPageOld = exportsOld.createPage as (d: Record<string, unknown>) => {
      created: (this: { setData(d: Record<string, unknown>): void }) => void
      detached: (this: { setData(d: Record<string, unknown>): void }) => void
    }
    const opts = createPageOld({ state: { count: 0 }, methods: {}, onLoad() {}, onUnload() {} })
    const inst = { setData: () => {} }
    opts.created.call(inst)
    expect(() => opts.detached.call(inst)).toThrow(/stop is not defined|ReferenceError/)
  })
})
