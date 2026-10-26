# Compile Slice 2: Web/Own-Container Target + Container Closed Loop — Design Spec

**Date**: 2026-10-26 | **Status**: DRAFT (team review pending)
**Predecessor**: compile-slice1 (green, 23 commits 3ae1378..d3d6f65, A1 human-eye pending)
**Traceability**: D5 (table-driven compiler, second-table hypothesis), D17 (capability word = grant), D18 (Linux standard = CefBackend), D20 (T7 bridge lane), D21 (three-primitive responsive socket / mixed-vocab), C2 (no circled numerals), PIT-3/PIT-4/PIT-5 (bridge callback contract, eval null slot, host-env masking)

---

## 0. One-sentence version

Add a second rule table (`web`) to the table-driven compiler — same author source (`tests/fixtures/counter`), zero kernel changes, `--target web` emits a plain static web package; the same package runs in a bare browser (localStorage) AND inside our CEF container (native bridge storage), proving the closed loop "author DSL -> compile -> own container -> alive".

## 1. Goal & acceptance (user-ruled: full closed loop, option A)

1. Web package compiled from the SAME `counter` fixture source (zero source edits, only `--target` changes) — the "swap table, swap target" proof.
2. Browser behavior tier (Playwright, real Chromium — NOT jsdom, per PIT-5): initial 0 / list a,b; tap +1 x3 -> 3; same-tick double-tap -> one flush; detach freezes.
3. Container tier: `omnilet-container --dir <web-pkg>` headless -> `LOADED painted served=N` rc=0, counter initial state visible in the CEF-served frame (pixel-verdict method from cef T6).
4. Bridge storage round-trip (option 5A, real read/write): `window.omnilet.storage.set/get` through cefQuery -> BrowserSide handler -> real native persistence -> get returns the value. D17's first live-fire.
5. WeChat regression red-line: all 206 slice-1 tests + goldens byte-identical (the "new table must not hurt the proven target" evidence).

**Non-goals (explicit, scope-creep guards)**: no virtual DOM / path-granular refresh (slice 3 main dish); no signature verification (manifest `signature` placeholder, container today only fail-closes on presence); no HMR/watch/routing/multi-page fixtures; no WebViewBackend frozen-surface changes (container reuses the existing headless lane); no new diagnostic codes (see §4).

## 2. Architecture & data flow

```
author source (index.html/ts/css/json + app.json)
  |
  +-- --target wechat -> [wechat tables] -> WeChat package (wxml/wxss/...)   [green, untouched]
  +-- --target web    -> [web tables]    -> web package:
        index.html                 shell (mount point, script tags)
        pages/*/index.js           CJS, require('<rel>/omnilet-runtime.js') + createPage({...})
        pages/*/index.css
        manifest.json              envelope (schemaVersion/files/sha256 hash; format copied
                                   from examples/demo-app/manifest.json)
        omnilet.manifest.json      capability sidecar (unchanged)
        omnilet.d.ts               OUT-sidecar (unchanged)
        omnilet-runtime.js         web vendor bundle (esbuild, package root)
```

The web package has TWO consumers:
1. **Bare browser**: open index.html directly (or Playwright) -> runtime detects no `window.cefQuery` -> storage via localStorage.
2. **CEF container**: `omnilet-container --dir <pkg>` -> load_offline_dir -> runtime lazily detects `window.cefQuery` (the bootstrap injection surface `window.omnilet.storage` already exists in bridge.rs from T7/D20) -> storage via native bridge round-trip.

Key kernel-invariants being verified (the D5 hypothesis under test): ingest / IR / rewrite / table gate / capability gate consume ZERO changes; only target-dispatched pieces are new (rule table, template/css serialize targets, js emit call-sites, runtime vendor).

## 3. Components & file layout

```
compiler/
  rules/web.ts                  [NEW] table rows (see §3.1 vocab), same RawTableSet shape
  src/
    tables.ts ir.ts rewrite.ts ingest.ts diag.ts capabilities.ts   [UNCHANGED]
    compileProject.ts           [MOD] target: 'wechat' | 'web'; dispatch tables/ingest platform/emit set
    codegen/html.ts             [NEW] web shell emit (mount point + script wiring)
    codegen/js.ts               [MOD] call-site parameterization only (factory/emit already parameterized
                                      via EmitOpts; web callers pass web factory/rel)
    codegen/css.ts              [NEW or wxss.ts rename] selector whitelist reuse + rpx->px conversion (table-driven row)
    codegen/appjson.ts          [MOD] web target: no app.json; author app.ts -> main.js (createApp)
    codegen/wxml.ts             [UNCHANGED, wechat-only]
  runtime/
    wechat/                     [UNCHANGED]
    web/
      facade.ts                 [NEW] same four author words (reactive/ref/computed/watch), re-export @vue/reactivity
      dom-adapter.ts            [NEW] whole-region repaint (3A): effect -> innerHTML rebuild of the page
                                      region + root-level event delegation (survives repaint)
      storage.ts                [NEW] dual-mode: lazy probe `window.cefQuery` at first storage call;
                                      present -> bridge; absent -> localStorage
      vendor-entry.ts           [NEW] esbuild entry (mirror of wechat/vendor-entry.ts)
  tests/
    fixtures/counter/           [REUSED] same source compiles to both targets (zero edits)
    golden/                     [NEW] web-target goldens (g-web-gNNN ids), RECORD_GOLDEN=1 flow
    web-behavior.test.ts        [NEW] Playwright tier

crates/omnilet-cef/src/bridge.rs [MOD] register two BrowserSide handlers in bridge_registry():
                                      omnilet.storage.get / .set -> real read/write (file-backed store
                                      under a container data dir); est. 50-100 lines. The Dispatcher
                                      already routes by call.m — only registration + handler bodies are new.
```

### 3.1 Web table first-version vocabulary (user-ruled: exactly WeChat-wide, option 4A)

| partition | rows |
|---|---|
| tagMap | view->div, text->span, button->button (passthrough for button) |
| directiveMap | v-if->data-if (rename+wrap), v-for->data-for (splitDirective), :key->data-key (keyTransform), :class->class (rename+wrap), :style->style (rename+wrap) |
| eventMap | @tap->click (valueMap) |
| lifecycleMap | onLoad/onShow/onHide/onUnload/onLaunch — web timing: page init fires onLoad+onLaunch; visibilitychange fires onShow/onHide; beforeunload/pagehide fires onUnload |
| exprWhitelist | identical operator list to wechat (same author grammar) |
| styleRules | rpx->px (750-basis conversion: 1rpx = 0.5px @375px viewport, fixed basis recorded here), class->omnilet- prefix (same-source row as wechat), selector:class/tag/pseudo whitelist |
| capabilityRules | storage -> omnilet.storage (same word, same capabilities.json) |

Emission note: the rewritten AST carries `data-if`/`data-for`/`data-key` attributes; the web runtime's repaint honors them (v-if falsy -> node omitted; v-for -> repeated; :key keys the repeat). This keeps the template layer static and declarative — the runtime interprets the compiled attributes.

## 4. Error handling & diagnostics (zero new codes — user-ratified in design)

All failure shapes map onto the existing four-band families; "adding a target needs no new diagnostic codes" is itself a D5 verification:

| scenario | code band | mechanism |
|---|---|---|
| web table row illegal (missing golden id, enum-out primitive) | 301-303 | table gate (unchanged) |
| author word outside web vocab | 201-205 negative | rewrite layer, web table's own vocab |
| capability word unregistered | 401 | same capabilities.json |
| TS shape / strip failures | 122/123/204 | js.ts surgery (target-independent) |
| rpx conversion | (none) | table-driven data behavior: conversion is deterministic text transform; malformed input dies upstream at parse 1xx |

Fail-closed chain (unchanged): any diagnostic -> ok=false -> ZERO files written (envelope included); manifest files/hash generated only after zero diagnostics, hashing final artifact bytes (order: artifacts first, envelope second — no cycle).

**Runtime degradation semantics (the one new error-handling surface)**: if `window.cefQuery` exists but a bridge call fails, the web runtime does NOT silently fall back to localStorage (that would mask container bugs) — failure propagates to the author callback (onFailure console.error channel already in bridge.rs). Fallback to localStorage happens ONLY on the probe answer "cefQuery absent". Principle: **probe once, degrade once; after that, failures are failures.**

## 5. Testing & acceptance matrix (user-ratified)

| tier | content | form |
|---|---|---|
| unit/golden | web table rows -> g-web-gNNN goldens (html bytes / css bytes / module-surgery bytes) | existing RECORD_GOLDEN=1 mechanism; wechat 206 green ZERO-drift as the per-task gate |
| structural | package completeness: index.html exists, require-heads point at package-root runtime, manifest files list matches disk + hashes match | gates.test.ts four-probe pattern, web-target probes added |
| behavior (browser) | Playwright real Chromium: load artifact -> 0/a/b initial -> tap x3 -> 3; same-tick merge; detach freeze; storage localStorage-mode set/get | NOT jsdom (PIT-5): the artifact runs in a real browser engine |
| behavior (container) | `omnilet-container --dir <pkg>` headless -> LOADED painted served=N rc=0; in-page cefQuery round-trip: `window.omnilet.storage.set/get` value identity; counter initial state pixel-verdict from the CEF-served frame | CEF pixel method (cef T6) + bridge live-fire (PIT-3 dual-callback, PIT-4 null-slot lessons already fixed in bridge.rs) |

Acceptance red-lines:
1. wechat target: 206 tests + goldens zero-byte-drift (per-task gate, not a final-only check).
2. Same `counter` source compiles clean on both targets (`--target` is the ONLY delta).
3. Container pixel verdict: counter initial state readable in the frame (not merely "painted").

## 6. Risks (ranked)

1. **Whole-region repaint event flicker / focus loss** (medium): rebuild happens post-microtask-merge (isomorphic to wechat's "one setData per tick"); counter has no text-focus issue; if real-world perception appears, upgrade path = subtree-only rebuild (slice 3 rides along).
2. **rpx->px basis semantics** (low): fixed 750-basis (1rpx=0.5px @375px viewport), recorded in the table row + spec; widening = later slice.
3. **cefQuery probe timing** (low): probe is lazy (first storage call), not module-top-level — bootstrap injection will have completed by then.
4. **manifest hash stability** (low): envelope hashes artifact bytes after they are final; no cycle.

## 7. Deferred-minors policy

The 17 carried slice-1 minors fold into whichever T1-T8 task touches their file (same rule as slice 1); no dedicated task, no forced clearing.

## 8. Reopen triggers (recorded per house style)

- CLI flag freeze stays open (slice-1 precedent): flag NAMES and the tsx run route remain reopen-able; the emitted PACKAGE FORMAT (files + envelope + runtime slot) is the frozen part, pinned by web goldens + structural probes.
- rpx basis: fixed now; re-openable if a fixture needs a different basis (table row change + spec annotation).
- lifecycle web-timing mapping: first cut defined in §3.1; re-openable on real-fixture evidence (behavior tier will pin what it can).
