// Task 10 (compile-slice1): omnilet.manifest.json sidecar (package root; WeChat
// ignores unknown files — own-container + audit consume it, spec §2 落点具名).
//
// The 4xx capability gate (checkCapabilities vs rule-schema capabilities.json,
// D17 编号即许可) runs in compileProject BEFORE this emitter is called: a build
// reaching emitManifest has only REGISTERED words. `capabilities` = sorted union
// of every page's ol:requires — sorted because a sidecar feeding an audit log
// must be byte-deterministic, not ingestion-order-dependent.

export const MANIFEST_FILE = 'omnilet.manifest.json'

export function emitManifest(allRequires: readonly string[], builtBy = 'omnilet-compiler@0.1.0-slice1'): string {
  const capabilities = [...new Set(allRequires)].sort()
  return `${JSON.stringify({ omniletManifestVersion: 1, capabilities, builtBy }, null, 2)}\n`
}


