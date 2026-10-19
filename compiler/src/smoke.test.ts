import { describe, it, expect } from 'vitest'
// T1 smoke: proves the harness (test-matrix tier-1); logic arrives with the kernel slice
describe('@omnilet/compiler harness', () => {
  it('smoke passes', () => { expect(1 + 1).toBe(2) })
})
