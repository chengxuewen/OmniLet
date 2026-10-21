// Task 11 (compile-slice1): vendor bundle entry — everything the emitted
// require('<rel>omnilet-runtime.js') head binds. esbuild (src/vendor.ts)
// bundles THIS file into the package-root CJS artifact; no author code here.
export { reactive, ref, computed, watch } from './facade'
export { createPage, createApp } from './adapter'
