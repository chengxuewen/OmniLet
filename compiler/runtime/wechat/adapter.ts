// Task 11 (compile-slice1): wechat adapter — createPage/createApp turn the
// emitted page/app config (codegen/js.ts contract) into a WeChat Component()/
// App() definition. Bundle entry: vendor-entry.ts -> omnilet-runtime.js.
//
// setData strategy (slice 1, honest): the WHOLE state snapshot is sent on every
// flush tick — the wxml template's read paths are NOT shipped into the js by
// codegen yet, so there is no dirty-path list to diff against. Correctness
// (0 -> 1 visible) is what the behavior tier proves; fine-grained dirty-path
// setData lands when codegen emits a `paths` manifest (dsl-spec §10 flush row).
import { effect, reactive, toRaw } from './facade'

type AnyRecord = Record<string, unknown>
type PageDef = {
  state?: AnyRecord
  methods?: AnyRecord
  onLoad?: (this: WxInstance) => void
  onShow?: (this: WxInstance) => void
  onHide?: (this: WxInstance) => void
  onUnload?: (this: WxInstance) => void
} & AnyRecord
// the WeChat Component instance surface we touch (j-component provides all of it):
type WxInstance = { setData(data: AnyRecord): void } & AnyRecord

export function createPage(def: PageDef): AnyRecord {
  const state = reactive(def.state ?? {})
  // vue effect() returns a RUNNER: calling it re-runs; stopping lives on
  // runner.effect.stop() (3.5 API). Stored for detached.
  let runner: { effect: { stop(): void } } | undefined
  const options: AnyRecord = {
    properties: {},
    // initial render data: plain (toRaw) deep snapshot — j-component stores and
    // diffs plain values; proxies in `data` would leak reactivity internals.
    data: plain(state) as AnyRecord,
    methods: { ...(def.methods as AnyRecord) },
    // created (not attached): fires for BOTH simulate render and device page
    // instantiation; the page framework's own onLoad slot is deliberately NOT
    // populated (we fire def.onLoad here instead -> single call, works live).
    created(this: WxInstance) {
      const inst = this
      let latest: AnyRecord = {}
      let queued = false
      runner = effect(() => {
        // observe: every read inside plain() registers that path;
        // any author write re-runs this effect (vue default = sync).
        latest = plain(state) as AnyRecord
        if (!queued) {
          queued = true
          // ponytail: full-state setData; switch to dirty paths from a codegen
          // `paths` manifest once template read-paths ship into the js artifact.
          Promise.resolve().then(() => {
            queued = false
            inst.setData(latest)
          })
        }
      })
      def.onLoad?.call(inst)
    },
    detached(this: WxInstance) {
      runner?.effect.stop()
      stop?.()
      def.onUnload?.call(this)
    },
  }
  // onShow/onHide ride the Component options top level: real WeChat honors the
  // page-lifecycle keys on component:true pages (device semantics); j-component
  // reads only its enumerated fields, so in simulate they are inert — navigation
  // lifecycles have no simulate driver anyway. Measured in behavior.test.ts.
  if (def.onShow) options.onShow = def.onShow
  if (def.onHide) options.onHide = def.onHide
  // @Component() is the WeChat global registration function; simulate provides it.
  registerComponent(options)
  return options
}

export function createApp(config: AnyRecord) {
  const g = globalThis as { App?: (c: AnyRecord) => void }
  if (typeof g.App === 'function') g.App(config)
  else (config.onLaunch as ((...a: unknown[]) => void) | undefined)?.call(config)
  return config
}

// ------------------------------------------------------------------ internals

/** global Component() provider: real device + miniprogram-simulate both define
 *  it before the page js runs; absent = plain unit context (caller uses the
 *  returned options object directly). */
function registerComponent(options: AnyRecord) {
  const g = globalThis as { Component?: (o: AnyRecord) => void }
  if (typeof g.Component === 'function') g.Component(options)
}

/**
 * Deep plain snapshot that READS THROUGH the reactive proxies (that read is the
 * observe primitive — toRaw-then-walk would register zero dependencies).
 * ponytail ceilings (slice 1, dsl-spec §1 vocabulary writes are JSON-shaped):
 *  - cycles: not guarded (author state literals are acyclic; add a WeakSet if
 *    a slice ever routes user graphs through state);
 *  - non-plain objects (Date/Map/...): cloned via for-in keys only.
 */
function plain(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return toRaw(v)
  if (Array.isArray(v)) return v.map(plain)
  const out: AnyRecord = {}
  for (const k of Object.keys(v)) out[k] = plain((v as AnyRecord)[k])
  return out
}
