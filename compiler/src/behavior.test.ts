// @vitest-environment jsdom
// Task 11 (compile-slice1): BEHAVIOR tier (test-matrix T2 row) — loads the
// EXACT compileProject output (temp dir, nothing hand-written) through
// miniprogram-simulate and proves state -> flush -> setData -> re-render.
// Spike verdict (README Task-1): Component-shape only, jsdom globals seeded
// before the simulate require, tap = native touchstart+touchend on wx-button,
// re-render asserts behind simulate.sleep.
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// vitest's jsdom env replaces globalThis.Uint8Array with the jsdom-realm one;
// esbuild's import-time invariant `new TextEncoder().encode("") instanceof
// Uint8Array` then breaks ACROSS realms (node-realm encoder vs jsdom-realm
// global). Restore the node-realm Uint8Array before the import that loads
// esbuild (compileProject -> vendor.ts -> esbuild).
globalThis.Uint8Array = Object.getPrototypeOf(Buffer.prototype).constructor as never
const { compileProject } = await import('./compileProject')

const SRC = dirname(fileURLToPath(import.meta.url)) // dirname+fileURLToPath: see Uint8Array note above (no global URL in jsdom env)
const require_ = createRequire(import.meta.url)

// simulate/j-component are untyped CJS — `any` here keeps the spike's exact
// call shape (README Task-1) without inventing a parallel type surface.
/* eslint-disable @typescript-eslint/no-explicit-any */
let simulate: any
let comp: any

describe('behavior tier: compiled counter package in miniprogram-simulate', () => {
  const out = mkdtempSync(join(tmpdir(), 'omnilet-behavior-'))

  beforeAll(async () => {
    const r = await compileProject({ root: join(SRC, '..', 'tests', 'fixtures', 'counter'), outDir: out })
    expect(r.ok).toBe(true)
    // jsdom env provides window/document; Event/CustomEvent must be on
    // globalThis before simulate is required (its dispatchEvent instanceof
    // checks against them — spike finding, README Task-1).
    globalThis.Event ??= window.Event
    globalThis.CustomEvent ??= window.CustomEvent
    simulate = require_('miniprogram-simulate')
    const id = simulate.load(join(out, 'pages', 'index', 'index'), 'omnilet-behavior-counter')
    comp = simulate.render(id)
    // comp.attach (not raw appendChild): sets parentNode and fires attached/
    // ready through exparser — comp.detach() is a no-op unless attached this way.
    comp.attach(document.body)
  }, 30000)

  afterAll(() => {
    try {
      comp.detach()
    } catch {
      /* already detached */
    }
    rmSync(out, { recursive: true, force: true })
  })

  const texts = () => [...comp.dom.querySelectorAll('wx-text')].map((t: Element) => t.textContent)

  it('vendor require resolves inside the package tree; initial render shows state', () => {
    expect(texts()).toEqual(['0', 'a', 'b']) // v-if view + v-for rows from the data snapshot
  })

  it('bindtap touch sequence drives reactive -> setData -> re-render 0 -> 1', async () => {
    const btnDom = comp.dom.querySelector('wx-button') as Element
    const mk = (type: string) =>
      // lib.dom's TouchEventInit demands full Touch objects; jsdom accepts the
      // spike's plain init at runtime (verified behavior — README Task-1).
      new window.TouchEvent(type, {
        bubbles: true,
        touches: type === 'touchend' ? [] : [{ identifier: 1, target: btnDom, pageX: 0, pageY: 0 }],
        changedTouches: [{ identifier: 1, target: btnDom, pageX: 0, pageY: 0 }],
      } as unknown as TouchEventInit)
    btnDom.dispatchEvent(mk('touchstart'))
    btnDom.dispatchEvent(mk('touchend'))
    await simulate.sleep(30) // event dispatch promise-deferred + flush microtask + async re-render
    expect(texts()[0]).toBe('1')
  })

  it('two writes in one tick land the latest value in one visual step (每 tick 一次)', async () => {
    comp.instance.inc()
    comp.instance.inc()
    await simulate.sleep(30)
    expect(texts()[0]).toBe('3') // 1 (tap) + 2 incs; a lost-update bug would show 2
    // queue-level dedup (ONE setData for both writes) is pinned in the unit
    // describe below — DOM text alone cannot distinguish one flush from two.
  })

  it('detached tears down: dom removed, no post-detach re-render', async () => {
    comp.detach()
    await simulate.sleep(10)
    expect(document.body.contains(comp.dom)).toBe(false)
    expect(texts()[0]).toBe('3') // frozen at last flush — no further updates reachable
  })
})

describe('createPage/createApp adapter unit (facade primitives + flush contract)', () => {
  it('data is a PLAIN deep snapshot; onLoad fires exactly once at created; one setData per tick; detached stops the effect', async () => {
    const { createPage } = await import('../runtime/wechat/adapter')
    const { reactive } = await import('../runtime/wechat/facade')
    // simulate's global.Component shim needs its loader `nowLoad` context and
    // throws outside it — gate it off so the adapter takes its no-Component
    // path (returns the options object for direct unit driving).
    const g = globalThis as { Component?: unknown }
    const savedComponent = g.Component
    delete g.Component
    const state = reactive({ n: { deep: 1 } })
    let loads = 0
    const opts = createPage({ state, methods: {}, onLoad: () => { loads++ } }) as {
      data: Record<string, unknown>
      created: (this: { setData(d: Record<string, unknown>): void }) => void
      detached: (this: { setData(d: Record<string, unknown>): void }) => void
    }
    expect(opts.data).toEqual({ n: { deep: 1 } })
    expect(opts.data.n).not.toBe(state.n) // snapshot copy, not the proxy
    const writes: Record<string, unknown>[] = []
    const inst = { setData: (d: Record<string, unknown>) => void writes.push(d) }
    opts.created.call(inst)
    expect(loads).toBe(1) // onLoad single-call at created (device framework slot left empty)
    await Promise.resolve()
    expect(writes.length).toBe(1) // initial flush = the snapshot
    state.n.deep = 2
    state.n.deep = 3
    await Promise.resolve()
    expect(writes.length).toBe(2) // TWO writes -> ONE queued setData (dedup by the queued flag)
    expect(writes[1]).toEqual({ n: { deep: 3 } }) // latest wins
    opts.detached.call(inst)
    state.n.deep = 4
    await Promise.resolve()
    expect(writes.length).toBe(2) // effect stopped: no flush after teardown
    if (savedComponent) g.Component = savedComponent
  })

  it('createApp calls global App() when present, else fires onLaunch directly', async () => {
    const { createApp } = await import('../runtime/wechat/adapter')
    const g = globalThis as { App?: (c: unknown) => void }
    delete g.App
    let launched = 0
    createApp({ onLaunch: () => { launched++ } })
    expect(launched).toBe(1)
    let passed: unknown
    g.App = (c) => { passed = c }
    const cfg = { x: 1 }
    createApp(cfg)
    expect(passed).toBe(cfg) // App() route hands the config to the framework (owns onLaunch)
    delete g.App
  })
})
