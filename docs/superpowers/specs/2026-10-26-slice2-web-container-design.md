# Compile Slice 2: Web/Own-Container Target + Container Closed Loop — Design Spec

**Date**: 2026-10-26 | **Status**: REVISED per D22 (4-axis team review + 6 user adjudications, all A, 2026-10-26; supersedes draft 2843d89)
**Predecessor**: compile-slice1 (green, 23 commits 3ae1378..d3d6f65, A1 human-eye pending)
**Traceability**: D5 (table-driven compiler, second-table hypothesis), D17 (capability word = grant), D18 (Linux standard = CefBackend), D20 (T7 bridge lane), D21 (three-primitive socket / mixed-vocab), **D22 (this slice's 6-card adjudication package)**, C2, PIT-3/PIT-4/PIT-5

---

## 0. One-sentence version

Add a second rule table (`web`) to the table-driven compiler — same author source (`tests/fixtures/counter`), `--target web` emits a plain static web package; the same package runs in a bare browser (localStorage) AND inside our CEF container (native bridge storage), proving the closed loop "author DSL -> compile -> own container -> alive".

**Honest hypothesis verdict (D22 Card 1)**: the literal "zero kernel changes" claim was KILLED by the team review — splitDirective hardcodes `wx:for-item`/`wx:for-index` (rewrite.ts:246). Honest restatement: **zero kernel BEHAVIOR changes + one row-field extension** (splitDirective reads item/index attr names from the row, defaults = today's literals; wechat output byte-identical). A second table exposing the coupling IS the D5 experiment working as designed.

## 1. Goal & acceptance (user-ruled: full closed loop, option A)

1. Web package compiled from the SAME `counter` fixture source (zero source edits, only `--target` changes) — the "swap table, swap target" proof.
2. Browser behavior tier (Playwright, real Chromium — NOT jsdom, per PIT-5): initial 0 / list a,b; tap +1 x3 -> 3; same-tick double-tap -> one flush; detach freezes.
3. Container tier: `omnilet-container --dir <web-pkg>` headless -> `LOADED painted served=N` rc=0; counter initial state proven by TWO legs (D22 Card 4): (a) pixel lane = non-blank frame (T6 center-pixel proves paint, not text — honestly downgraded); (b) DOM-state echo probe = in-page JS writes `document.querySelector(<count>).textContent` into the native store via `omnilet.storage.set('probe', ...)`, harness asserts "0" from the native side (pattern proven at cef_lifecycle.rs:123-143). "Text readable in frame" moves to the eval-channel reopen trigger (§8).
4. Bridge storage round-trip (option 5A, real read/write): `window.omnilet.storage.set/get` through cefQuery -> BrowserSide handler -> real native persistence -> get returns the value, **asserted via native-side store observation — NEVER via backend.eval return** (eval result channel does not exist: lib.rs:499 returns hardcoded "null", a D20-deferred extension; an implementer writing `let v = backend.eval(...)` builds a broken-by-construction test). D17's first live-fire.
5. WeChat regression red-line: all 206 slice-1 tests + goldens byte-identical (the "new table must not hurt the proven target" evidence).

**Non-goals (explicit, scope-creep guards)**: no virtual DOM / path-granular refresh (slice 3 main dish); no signature verification (manifest `signature` placeholder, container today only fail-closes on presence); no HMR/watch/routing/multi-page fixtures; no WebViewBackend frozen-surface changes (container reuses the existing headless lane); no new diagnostic codes (see §4).

## 2. Architecture & data flow

```
author source (index.html/ts/css/json + app.json + optional app.ts — LOW-10: app.ts part of the
        single source of truth; both targets consume it)
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

**D15-4 reconciliation (D22 Card 2)**: the web package is SELF-CONTAINED (runtime bundled in-package) — the bare-browser consumer has no injection surface, so bundling is the only viable form. D15-4's injection model ("runtime injected by SDK, never bundled") is scoped to the CONTAINER-NATIVE lane (cef bootstrap injection, T7/D20 surface); static-package consumption is exempt. Version-mismatch guard = the envelope's `minEngineVersion` field (D8-1 format, demo-app shape): container load validates it (small new consumption leg). Recorded as D22.

## 3. Components & file layout

```
compiler/
  rules/web.ts                  [NEW] table rows (see §3.1 vocab), same RawTableSet shape
  src/
    tables.ts ir.ts ingest.ts diag.ts capabilities.ts   [UNCHANGED]
    rewrite.ts                  [MOD] splitDirective row-field extension (D22 Card 1): item/index attr names
                                      read from the row (defaults 'wx:for-item'/'wx:for-index'; ~3 lines,
                                      wechat rows unchanged -> wechat output byte-identical)
    compileProject.ts           [MOD] target: 'wechat' | 'web'; dispatch tables/ingest platform/emit set
    codegen/html.ts             [NEW] web shell emit (mount point + script wiring)
    codegen/js.ts               [MOD] call-site parameterization only (factory/emit already parameterized
                                      via EmitOpts; web callers pass web factory/rel)
    codegen/css.ts              [NEW FILE, wxss.ts kept as-is for wechat (LOW-9: no rename; selector-
                                      whitelist helper lives in tables.ts, shared by both targets)] + rpx->px:
                                      codegen-consumed row (D22 Card 3 honesty note: NO kernel code consumes
                                      styleRules rpx rows — css.ts unit-math keys on s='rpx',t='px', basis 750
                                      hardcoded here; new codegen code, not primitive dispatch)
    codegen/appjson.ts          [MOD] web target: no app.json; author app.ts -> main.js (createApp)
    codegen/manifest.ts         [NAMED OWNER] envelope emit — files/sha256 generator, single source
                                      (team finding: envelope generator had no owner)
    codegen/wxml.ts             [UNCHANGED, wechat-only]
  runtime/
    wechat/                     [UNCHANGED]
    web/
      facade.ts                 [NEW] same four author words (reactive/ref/computed/watch), re-export @vue/reactivity
      dom-adapter.ts            [NEW] whole-region repaint (3A): effect -> innerHTML rebuild of the page
                                      region + root-level event delegation (survives repaint); flush queue
                                      microtask-coalesced, scheduler lives HERE (test-honesty F5: without a
                                      named scheduler, "same-tick merge" has no mechanism to land on);
                                      detach test hook `window.omnilet.page.detach()` for the browser tier
      expr-evaluator.ts         [NEW] evaluates the dsl-spec §1 expression grammar over state for interp
                                      text + brace-wrapped attr values (the piece wechat's platform interpreter
                                      did for free — named per hypothesis-killer F3); one-way contract:
                                      compile-time gate >= runtime evaluator
      storage.ts                [NEW] dual-mode: lazy probe at first storage call checks BOTH surfaces:
                                      `typeof window.omnilet?.storage?.get === 'function' &&
                                      typeof window.cefQuery === 'function'` (bridge-live-fire F6: probe the
                                      surface actually called); present -> bridge; absent -> localStorage; the
                                      browser require shim for emitted CJS require-heads is installed by
                                      vendor-entry.ts (F4: contract owned, nobody's orphan)
      vendor-entry.ts           [NEW] esbuild entry (mirror of wechat/vendor-entry.ts)
  tests/
    fixtures/counter/           [REUSED] same source compiles to both targets (zero edits)
    golden/                     [NEW] web-target goldens, NAMESPACE 'g-web-gNNN' (LOW-11: prefix-isolated
                                      from wechat's gNNN by naming convention), RECORD_GOLDEN=1 flow
    web-behavior.test.ts        [NEW] Playwright tier

crates/omnilet-cef/src/bridge.rs [MOD] register two BrowserSide handlers in bridge_registry():
                                      omnilet.storage.get/.set -> real read/write. Store location: OUTSIDE the
                                      serving root (`<dir>-omnilet-data/` sibling — per-package derivation
                                      satisfies invariant-6 isolation BY CONSTRUCTION: keys never cross
                                      package boundaries; no shared-store namespace needed), create_dir_all at first
                                      write, single JSON file, temp+rename atomic; F3: load_offline_dir serves
                                      ANY file under package root — an in-package store would leak via
                                      omnilet://app/ and pollute the served-count proof). Handler discipline
                                      (F4): every body calls responder.respond EXACTLY once (T7 example's set
                                      handler is the counter-example: dropped responder = silent JS hang);
                                      bodies run on browser UI thread under registry read-lock — no registry
                                      re-entry, sync file I/O acceptable at this size; registration inside
                                      browser_router() get_or_init (race-free) or before first pump. ~50-100 lines.
crates/omnilet-container/src/main.rs [MOD] headless lane grows the proof loop: storage-handler
                                      consumption, echo-probe evals, native store polling, extended timeout,
                                      verdict output (F8: the acceptance row had no owner without this).
```

### 3.1 Web table first-version vocabulary (user-ruled: exactly WeChat-wide, option 4A)

| partition | rows |
|---|---|
| tagMap | view->div, text->span, button->button (passthrough for button) |
| directiveMap | v-if->data-if (rename+wrap; value carries braces `data-if="{{ready}}"`, runtime strips — F8 pinned), v-for->data-for (splitDirective + D22 Card 1 row fields: `data-for-item`/`data-for-index`), :key->data-key (keyTransform; VALUE vocabulary '*this'/'index'/prop-name carried verbatim, runtime interprets — F7), :class->class (rename+wrap), :style->style (rename+wrap) |
| eventMap | @tap->click (valueMap); **web v1: event modifiers (.stop etc.) NOT supported — silently dropped today (rewrite.ts:283 bind->catch is wechat-only math); declared gap + deferred minor + reopen trigger (D22 Card 6)** |
| lifecycleMap | onLoad/onShow/onHide/onUnload/onLaunch — web timing: page init fires onLoad; **onLaunch fires ONCE at FIRST page mount** (app-level word on a static single-entry package, NOT per navigation — F9); visibilitychange fires onShow/onHide; beforeunload/pagehide fires onUnload |
| exprWhitelist | identical operator list to wechat (same author grammar; ?./??/calls OUT — wechat reason: platform uncertainty; web reason: grammar parity; D22/F6: widening = expr.ts parser change, NOT a table-row add) |
| styleRules | rpx->px (750-basis: 1rpx = 0.5px @375px viewport, D22 Card 3; consumed by css.ts unit-math, see §3), class->omnilet- prefix (same-source row as wechat), selector:class/tag/pseudo whitelist |
| capabilityRules | storage -> omnilet.storage (same word, same capabilities.json) |

Emission note: the rewritten AST carries `data-if`/`data-for`/`data-for-item`/`data-for-index`/`data-key`; the web runtime's repaint honors them (v-if falsy -> node omitted; v-for -> repeated; :key keys the repeat; brace values unwrapped). The runtime ALSO evaluates the §1 expression grammar (expr-evaluator.ts, §3). Template layer stays static/declarative; the interpreter is ours (wechat's is the platform — fair-comparison caveat, §2).

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

**Runtime degradation semantics (the one new error-handling surface)**: probe checks BOTH surfaces (`window.omnilet?.storage?.get` function AND `window.cefQuery` function) lazily at first storage call. If probe says "bridge" but a call fails, NO silent localStorage fallback — failure propagates (onFailure console.error channel already in bridge.rs). Fallback ONLY on "surfaces absent". Principle: **probe once, degrade once; after that, failures are failures.**

## 5. Testing & acceptance matrix (user-ratified)

| tier | content | form |
|---|---|---|
| unit/golden | web table rows -> g-web-gNNN goldens (html bytes / css bytes / module-surgery bytes) | existing RECORD_GOLDEN=1 mechanism; wechat 206 green ZERO-drift as the per-task gate |
| structural | package completeness: index.html exists, require-heads point at package-root runtime, manifest files list matches disk + hashes match | gates.test.ts four-probe pattern, web-target probes added |
| behavior (browser) | TWO layers (D22 Card 5): (a) web-vendor bare-vm unit tier mirroring device-detach.test.ts — cheap per-task gate, PIT-5-honest; (b) Playwright real Chromium — FIRST Playwright wiring in this repo (devDep + browser install + proxy routing per lessons #39/#40, ~0.5-task one-time bring-up, named in plan); NOT jsdom |
| behavior (container) | `omnilet-container --dir <pkg>` headless -> LOADED painted served=N rc=0; TWO-LEG verdict (D22 Card 4): pixel lane non-blank + DOM-state echo probe (set('probe', <count>.textContent) -> native store poll asserts "0"); storage value identity via native-side store observation (echo pattern, cef_lifecycle.rs:123-143); NEVER via backend.eval return (hardcoded "null" today) |

Acceptance red-lines:
1. wechat target: 206 tests + goldens zero-byte-drift (per-task gate, not a final-only check).
2. Same `counter` source compiles clean on both targets (`--target` is the ONLY delta).
3. Container verdict = non-blank pixel frame + DOM-state echo probe returns counter initial value (D22 Card 4 downgrade; "text readable in frame" is the eval-channel reopen trigger, §8).
4. Same-source red-line pinned by a NAMED test (test-honesty F2): one suite hashes tests/fixtures/counter, compiles BOTH targets from the same root in one run, asserts both ok=true AND fixture-hash unchanged between compiles — causal, not narrative.
5. Cross-table isolation pinned (test-honesty F4-minor): grep-assertion that compileProject's wechat dispatch does not import webTables + web.ts-rename isolation probe (wechat output byte-identical with web table present vs absent).

## 6. Risks (ranked)

1. **Whole-region repaint event flicker / focus loss** (medium): rebuild happens post-microtask-merge via the dom-adapter flush queue (named in §3; mirrors wechat's "one setData per tick"); counter has no text-focus issue; upgrade path = subtree-only rebuild (slice 3 rides along).
2. **rpx->px basis semantics** (low): fixed 750-basis (D22 Card 3); dsl-spec §4 synced same-commit (C3); widening = reopen trigger.
3. **Playwright first-wiring cost** (low-medium, D22 Card 5): devDep + ~150MB browser download via proxy + first skeleton = one-time ~0.5-task bring-up; proxy route measured working (#39/#40).
4. **Probe timing** (low): lazy first-call probe checking both surfaces — bootstrap injection runs at on_context_created, strictly before page scripts (bridge.rs:121-136).
5. **manifest hash stability** (low): envelope hashes artifact bytes after they are final; no cycle.

## 7. Deferred-minors policy

The 17 carried slice-1 minors fold into whichever task touches their file (same rule as slice 1); no dedicated task, no forced clearing. Slice-2 addition (D22 Card 6): web-v1 event-modifier gap (`@tap.stop` silently dropped) enters the ledger with its reopen trigger.

## 8. Reopen triggers (recorded per house style)

- CLI flag freeze stays open (slice-1 precedent): flag NAMES and the tsx run route remain reopen-able; the emitted PACKAGE FORMAT (files + envelope + runtime slot) is the frozen part, pinned by web goldens + structural probes.
- rpx basis: fixed (D22 Card 3); re-openable if a real multi-screen fixture needs vw/rem (dsl-spec §4 trigger).
- lifecycle web-timing mapping: first cut in §3.1 (onLaunch once at first mount); re-openable on real-fixture evidence.
- eval result channel (D20-deferred): reopening unlocks "text readable in frame" as a red-line and drops the echo pattern; NOT this slice (D22 Card 4).
- event modifiers on web (D22 Card 6): first fixture needing .stop => compile-time rejection or tStop row field.
- expr grammar widening (?? / ?. / calls): kernel work in disguise — lives in expr.ts parser, NOT a table-row add (F6); any widening = explicit kernel amendment, never silent.
