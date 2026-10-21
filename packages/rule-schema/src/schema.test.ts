import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../schema/manifest.schema.json'
import tableSchema from '../schema/table.schema.json'
import capabilitiesJson from '../capabilities.json'
import { loadCapabilities, assertNormalized } from './index'
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

const validateRow = ajv.compile(tableSchema)

// T2 contract test: rule-table row shape (seven-part table + 8-value primitive enum).
// Source of truth: compiler/src/types.ts mirrors these enums; ajv gate (T5) validates rows against this schema.
const goodRow = { kind: 'tagMap', s: 'view', t: 'div', primitive: 'rename', golden: '<div></div>' }

describe('rule-table row schema (T2 table contract)', () => {
  it('accepts a well-formed row', () => {
    expect(validateRow(goodRow)).toBe(true)
  })
  it('accepts a row without optional t / primitive', () => {
    expect(validateRow({ kind: 'exprWhitelist', s: 'a ? b : c', golden: 'a?b:c' })).toBe(true)
  })
  it('requires golden (minLength 1, fail-closed on empty)', () => {
    expect(validateRow({ kind: 'tagMap', s: 'view', golden: '' })).toBe(false)
    expect(validateRow({ kind: 'tagMap', s: 'view' })).toBe(false)
  })
  it('rejects a primitive outside the 8-value enum', () => {
    expect(validateRow({ ...goodRow, primitive: 'wrapBlock' })).toBe(false)
  })
  it('rejects a kind outside the seven-part table', () => {
    expect(validateRow({ ...goodRow, kind: 'attrMap' })).toBe(false)
  })
  it('requires s (source token)', () => {
    expect(validateRow({ kind: 'tagMap', golden: 'x' })).toBe(false)
  })
})

describe('capability vocabulary (D17)', () => {
  it('capabilities.json contains storage as the first word', () => {
    expect(capabilitiesJson.capabilities).toContain('storage')
  })
  it('loadCapabilities() returns the vocabulary', () => {
    expect(loadCapabilities()).toContain('storage')
    expect(loadCapabilities().every((c) => typeof c === 'string')).toBe(true)
  })
})


describe('assertNormalized (golden byte-contract pre-check, NORMALIZATION.md)', () => {
  it('accepts normalized text', () => {
    expect(() => assertNormalized('<view a="1">\n  <text/>\n</view>\n')).not.toThrow()
  })
  it('rejects CRLF — planted-red self-proof, the predicate can bite', () => {
    expect(() => assertNormalized('a\r\nb\n')).toThrow(/[Cc][Rr]/)
  })
  it('rejects odd-space and tab indentation', () => {
    expect(() => assertNormalized('a\n   b\n')).toThrow(/indent/)
    expect(() => assertNormalized('\tb\n')).toThrow(/indent/)
  })
  it('rejects absolute paths (/home/, /tmp/)', () => {
    expect(() => assertNormalized('src: /home/u/a.wxml\n')).toThrow(/absolute path/)
    expect(() => assertNormalized('tmp /tmp/a\n')).toThrow(/absolute path/)
  })
})