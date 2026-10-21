import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Capability vocabulary single source (D17: first word = storage).
// Consumers: compiler gate (T5) rejects capabilityRules rows for unknown words;
// container capability check (T9/T10) reads the same file.
export function loadCapabilities(): string[] {
  // string-path arithmetic (NOT `new URL(..., import.meta.url)`): when a
  // consumer runs under a jsdom-family environment the global URL belongs to
  // another realm and node's fs rejects it (T11 behavior tier, measured).
  const p = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'capabilities.json')
  const raw = JSON.parse(readFileSync(p, 'utf8')) as { capabilities: string[] }
  return raw.capabilities
}


/**
 * Golden byte-contract pre-check (NORMALIZATION.md): fail fast before any
 * golden comparison. Rules: LF-only line endings, 2-space indentation
 * stepping (no tabs, no odd leading spaces), no absolute paths (/home/, /tmp/).
 */
export function assertNormalized(text: string): void {
  if (text.includes('\r')) {
    throw new Error('normalize: CR/CRLF found — golden files are LF-only')
  }
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const lead = /^\s*/.exec(lines[i] ?? '')?.[0] ?? ''
    if (lead.includes('\t') || lead.length % 2 !== 0) {
      throw new Error(`normalize: bad indent (${JSON.stringify(lead)}) at line ${i + 1} — 2-space steps only`)
    }
    const bad = /\/home\/|\/tmp\//.exec(lines[i])
    if (bad) {
      throw new Error(`normalize: absolute path '${bad[0]}' at line ${i + 1} — goldens must be path-independent`)
    }
  }
}
