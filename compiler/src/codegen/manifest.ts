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



// ------------------------------------------------------------------ envelope
// Slice-2 Task 3: the web package's SELF-describing envelope (manifest.json,
// D8-1 format = examples/demo-app/manifest.json shape). NAMED OWNER of the
// files/sha256 generator (spec §3: "envelope emit — single source").
//
// Contract (spec §2/§4): the envelope hashes the FINAL bytes of the OTHER
// package files — compileProject emits artifacts first, envelope LAST (no
// cycle; fail-closed: zero diagnostics before any file incl. the envelope is
// written). Strings encode UTF-8 before hashing. `signature` stays an empty
// VALUE placeholder (spec §1 non-goal: no signature verification this slice;
// the container today only fail-closes on presence). Keys sorted by path —
// a hash manifest feeding an audit surface must be byte-deterministic.
import { createHash } from 'node:crypto'

export const ENVELOPE_FILE = 'manifest.json'

export function emitManifestEnvelope(
  files: readonly { path: string; bytes: string | Uint8Array }[],
  pkg: { packageVersion: string; minEngineVersion: string },
): string {
  const list = [...files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => {
      const bytes = typeof f.bytes === 'string' ? Buffer.from(f.bytes, 'utf8') : f.bytes
      return { path: f.path, hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, size: bytes.length }
    })
  return `${JSON.stringify({ schemaVersion: 1, minEngineVersion: pkg.minEngineVersion, packageVersion: pkg.packageVersion, files: list, signature: { algorithm: 'ed25519', value: '' } }, null, 2)}\n`
}
