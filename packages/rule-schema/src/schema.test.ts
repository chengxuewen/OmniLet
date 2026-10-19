import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../schema/manifest.schema.json'

// D8-1 contract test: a well-formed manifest v1 validates; tampered shapes fail.
const ajv = new Ajv2020({ allErrors: true })
const validate = ajv.compile(schema)

const good = {
  schemaVersion: 1,
  minEngineVersion: '0.1.0',
  packageVersion: '1.2.3',
  files: [{ path: 'pages/index.js', hash: 'sha256:' + 'a'.repeat(64), size: 100 }],
  signature: { algorithm: 'ed25519', value: 'AAAA' },
}

describe('manifest v1 schema (D8-1 machine contract)', () => {
  it('accepts a well-formed manifest', () => {
    expect(validate(good)).toBe(true)
  })
  it('rejects wrong schemaVersion (fail-closed)', () => {
    expect(validate({ ...good, schemaVersion: 2 })).toBe(false)
  })
  it('rejects path traversal (security: no ../, no leading slash)', () => {
    expect(validate({ ...good, files: [{ path: '../evil.js', hash: 'sha256:' + 'a'.repeat(64), size: 1 }] })).toBe(false)
    expect(validate({ ...good, files: [{ path: '/abs.js', hash: 'sha256:' + 'a'.repeat(64), size: 1 }] })).toBe(false)
  })
  it('rejects malformed hash', () => {
    expect(validate({ ...good, files: [{ path: 'a.js', hash: 'md5:abc', size: 1 }] })).toBe(false)
  })
  it('rejects unknown signature algorithm', () => {
    expect(validate({ ...good, signature: { algorithm: 'rsa', value: 'AAAA' } })).toBe(false)
  })
})
