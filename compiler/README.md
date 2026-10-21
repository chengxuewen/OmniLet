# @omnilet/compiler

Table-driven mini-app compiler (D5). Slice-1 target: WeChat.

## Registry / connectivity probe (Task 0, measured 2026-10-21)

`pixi run pnpm install --dir compiler` resolved all deps against the default
registry (`https://registry.npmjs.org/`, no `.npmrc`, no mirror) through the
system proxy (`http_proxy=10.144.0.1:7897`) — 4-7s per add, zero retries.
The proxy route is the measured working path; a domestic mirror is deferred
to a later slice (spec §7).

## simulate spike verdict (Task 1)

Measured 2026-10-21 with miniprogram-simulate 1.6.2 + jsdom 30.1.3 under Node 24
(throwaway spike in `/tmp/omnilet-sim-spike/`, findings only). Verdict: **the behavior
tier for WeChat output is Component-shape, strictly** — `Page()` is not an option.

- **Component-shape loads and renders.** A hand-written fixture as our compiler
  would emit (`index.js` = `Component({ data: { count: 0 }, methods: { inc() { this.setData({ count: this.data.count + 1 }) } } })`,
  `index.wxml` = `<text>{{ count }}</text><button bindtap="inc">+1</button>`,
  `index.json` = `{ "component": true }`) loads via `simulate.load(path, tagName, opts)`
  and renders in jsdom: `comp.dom.innerHTML` = `<wx-text>0</wx-text><wx-button>+1</wx-button>`.
- **Tap → 0→1 assertion works two ways.**
  1. Realistic input path (preferred, works without any id in the wxml): native
     touch sequence on the button's DOM node — `wx-button` derives `tap` from
     touchstart+touchend internally:

     ```js
     const btnDom = comp.dom.querySelector('wx-button')
     const mk = (type) => new dom.window.TouchEvent(type, {
       bubbles: true,
       touches: type === 'touchend' ? [] : [{ identifier: 1, target: btnDom, pageX: 0, pageY: 0 }],
       changedTouches: [{ identifier: 1, target: btnDom, pageX: 0, pageY: 0 }],
     })
     btnDom.dispatchEvent(mk('touchstart'))
     btnDom.dispatchEvent(mk('touchend'))
     await simulate.sleep(20) // event dispatch is promise-deferred
     // comp.dom.querySelector('wx-text').textContent: '0' -> '1' (assert pass)
     ```

  2. Direct handler call: `comp.instance.inc()` also flips text 0→1 after a
     `simulate.sleep(10)` (setData re-render is async). Note `comp.dispatchEvent('tap')`
     (custom-event route) only reaches `bindtap` when the node is addressable via
     `comp.querySelector('#btn')` — plain tag selectors return undefined; only
     id/class selectors and custom-component tags are queryable.
- **Page-shape does NOT load.** `simulate.load` executes the .js against a global
  `Component` shim only; a `Page({...})` fixture fails with `Page is not defined`.
  There is no page runtime in simulate at all. So the compiler's WeChat output must
  wrap pages as `Component()` + `{"component": true}` json for the behavior tier.
- **Both compilers work.** Default options (official `miniprogram-compiler` wcc) and
  `{ compiler: 'simulate' }` both load the fixture; official is the default and needs
  no extra option — Tasks 10/11 can stay on defaults.
- **jsdom API surface required before `require('miniprogram-simulate')`:** seed
  `global.window` / `global.document` from a fresh `new JSDOM(...)`, plus
  `global.Event` and `global.CustomEvent` copied from `dom.window` — without the
  latter, simulate's internal `dispatchEvent` throws "parameter 1 is not of type
  'Event'". `TouchEvent` exists in jsdom 30 natively; simulate's own polyfill
  supplies `global.Touch`. `matchMedia` was NOT needed. Vitest tests using this must
  run under the jsdom environment (per-file `// @vitest-environment jsdom` or a
  setup file that seeds the globals above).

**Final behavior-tier shape (decided by measurement, feeds Tasks 10/11):** emitted
WeChat page = `Component()` .js + `{"component": true}` .json; test harness =
`simulate.load` → `simulate.render` → append `comp.dom` → touch-sequence (or
`comp.instance.<handler>()`) → `await simulate.sleep` → assert `wx-text` textContent.
If a future slice wants true `Page()` semantics, it needs a page shim of our own —
simulate will not provide one.

## CLI / compileProject (Task 10)

```bash
# build a WeChat package from the authoring tree:
pixi run pnpm --dir compiler exec tsx src/cli.ts --dir tests/fixtures/counter --out /tmp/pkg [--mode dev|prod]
# exit 0 = zero diagnostics + files written; 1 = diagnostics printed (nothing written) or bad args
```

`compileProject({root, outDir, target, mode})` is the programmatic entry
(orchestration: ingest -> parse -> table rewrite -> codegen -> fail-closed write).
**参数非冻结（§8 trigger "CLI 参数冻结 = 管线定型后"）**: flag names, `--mode`
behavior (dev/prod emit identical bytes in slice 1), and the tsx-based run route
are reopen-able; the emitted *package format* (package files + omnilet.d.ts sidecar
+ the `omnilet-runtime.js` vendor slot at the package root that T11 must fill) is
the frozen part — pinned by the `g100-counter-out` goldens + structural.test.ts.
Re-record full-chain goldens with `RECORD_GOLDEN=1` (measured bytes only).
