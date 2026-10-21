import { readFileSync } from 'node:fs'

// Capability vocabulary single source (D17: first word = storage).
// Consumers: compiler gate (T5) rejects capabilityRules rows for unknown words;
// container capability check (T9/T10) reads the same file.
export function loadCapabilities(): string[] {
  const raw = JSON.parse(
    readFileSync(new URL('../capabilities.json', import.meta.url), 'utf8')
  ) as { capabilities: string[] }
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
    const lead = /^(\s*)/.exec(lines[i])[1]
    if (lead.includes('\t') || lead.length % 2 !== 0) {
      throw new Error(`normalize: bad indent (${JSON.stringify(lead)}) at line ${i + 1} — 2-space steps only`)
    }
    const bad = /\/home\/|\/tmp\//.exec(lines[i])
    if (bad) {
      throw new Error(`normalize: absolute path '${bad[0]}' at line ${i + 1} — goldens must be path-independent`)
    }
  }
}