// Task 11 (compile-slice1): the esbuild vendor leg — runtime/wechat/vendor-entry.ts
// -> the `omnilet-runtime.js` package-root artifact (RUNTIME_VENDOR slot that
// codegen/js.ts require-paths point at). esbuild is the compiler-side bundler
// assigned by spec §7 (D5: 打包 esbuild); per-mode bundle is cached in-process.
// mode semantics (slice 1): dev = readable bundle; prod = same code, esbuild
// minify (the leg promised by the T10 prod-throw comment). All other emitted
// bytes are mode-independent (js.ts `ponytail:` note stays true).
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import type { CompileMode } from './compileProject'

export const RUNTIME_VERSION = '0.1.0-slice1'
const VUE_REACTIVITY = '3.5.44' // must equal the pin in package.json (vendor header)
// string-path arithmetic on import.meta.url (NOT `new URL()`): under vitest's
// jsdom env the global URL is jsdom's realm and node's fileURLToPath rejects
// cross-realm URL objects ("URL must be of scheme file") — measured in T11.
const ENTRY = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'runtime', 'wechat', 'vendor-entry.ts')

const cache = new Map<CompileMode, string>()

export async function buildVendor(mode: CompileMode): Promise<string> {
  const hit = cache.get(mode)
  if (hit) return hit
  const res = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'cjs', // simulate/jsthird execute CJS (T10 contract §2; ESM would need build-npm — spec §2 forbids)
    platform: 'neutral',
    target: 'es2017', // WeChat base-library floor + node/jsdom both parse this
    minify: mode === 'prod',
    // vue dev-code carries `process.env.NODE_ENV` guards; WeChat devices have
    // no `process` global (found via the no-DOM vm probe — jsdom masked it
    // because node's process leaks through). define bakes the mode value in.
    define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'prod' ? 'production' : 'development') },
    write: false,
    legalComments: 'none',
    banner: {
      js: `/*! omnilet-runtime ${RUNTIME_VERSION} mode=${mode} vendor=@vue/reactivity@${VUE_REACTIVITY} */`,
    },
  })
  const code = res.outputFiles[0]!.text
  cache.set(mode, code)
  return code
}
