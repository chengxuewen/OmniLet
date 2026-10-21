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
**参数非冻结（§8 trigger "CLI 参数冻结 = 管线定型后"）**: flag names, the tsx-based
run route, and the exact dev/prod vendor split (T11 wired the esbuild minify leg:
prod = minified vendor, all other bytes mode-independent) are reopen-able; the
emitted *package format* (package files + omnilet.d.ts sidecar + the
`omnilet-runtime.js` vendor slot at the package root) is
the frozen part — pinned by the `g100-counter-out` goldens + structural.test.ts.
Re-record full-chain goldens with `RECORD_GOLDEN=1` (measured bytes only).


## runtime vendor shim + behavior tier (Task 11)

The `omnilet-runtime.js` package-root slot is an esbuild CJS bundle of
`runtime/wechat/{facade,adapter,vendor-entry}.ts` (@vue/reactivity 3.5.44,
pinned). Measured bytes for the counter-fixture build:

| mode | vendor bytes |
|---|---|
| dev (readable) | 49,868 |
| prod (esbuild minify) | 17,451 |

Observation only (no regression redline): uni-app ships a 177 KB
vue.runtime fork per mini-app package (`docs/reference/uniapp-compiler-internals.md`
§measured) — our slice-1 shim is ~1/9 of that in prod. Not like-for-like:
uni-mp-vue carries the full runtime-core component system, we bundle the
reactivity kernel + this slice's adapter only.

Behavior tier (test-matrix T2, runs the COMPILED artifact, nothing
hand-written): `src/behavior.test.ts` (jsdom) — `compileProject` ->
`simulate.load` of the emitted tree -> initial `0/a/b`, bindtap touch
sequence -> `1`, same-tick double inc -> `3` via one flush, detach stops
the effect; plus adapter unit asserts (plain snapshot, onLoad single-call,
one setData per tick). Env notes: jsdom swaps `Uint8Array`/`URL` into its
own realm — esbuild's import invariant and node's `fileURLToPath` reject
cross-realm objects there, hence the realm-restore + string-path patterns
in `behavior.test.ts`/`vendor.ts`/`rule-schema/src/index.ts` (measured).

Lifecycle finding (closes the T10 *UNCERTAIN*): the page js runs as a
Component (simulate has no Page runtime, README Task-1), so the adapter
fires `def.onLoad` at `created` and `def.onUnload` at `detached` itself,
leaving the framework's own onLoad slot empty (single-call, live-verified
in the behavior tier); `onShow/onHide` ride the top-level options for the
real-device framework — simulate has no navigation driver for them.


## 人眼档 runbook (A1)

机器三档（单元/golden、结构、行为）全绿；行为档 = simulate 保真声明，**≠ 真机**。
A1 一级勾选挂在下面这段人工实测上（做完在 `docs/mvp-checklist.md` A1 行勾一级 + 本仓库
`.agents/memorys/status.md` 记一行结果）。

```bash
# 1. 编译 counter 样例到固定目录（产物 = 微信开发者工具可直接导入的包）
pixi run pnpm --dir compiler exec tsx src/cli.ts \
  --dir tests/fixtures/counter --out tests/out [--mode dev|prod]   # exit 0 = 零诊断
```

2. **Windows/Mac**：微信开发者工具 → 「导入项目」→ 目录选 `compiler/tests/out/`，
   AppID 用「测试号」。模拟器应渲染：
   - 一行计数文本，初始 `0`（`v-if="ready"` 恒真分支，样例无切换动作——看不到这段文本即回归）
   - 两行列表项 `a`、`b`（v-for + :key）
   - 一个 `+1` 按钮
3. 点 `+1` 三次 → 计数 `0 → 3`（同一 tick 连点应合并为一次 setData，页面不报错、控制台零红）。
4. 通过后：`docs/mvp-checklist.md` A1 一级勾选 + status 记「人眼档实测 pass <日期>」。

产物构成（`tests/out/`）：`app.json`/`app.js` + `pages/index/index.{wxml,js,wxss,json}` +
包根 `omnilet-runtime.js`（vendor 垫片）；`omnilet.d.ts`/`omnilet.manifest.json` 为侧车，
微信侧忽略不报错。