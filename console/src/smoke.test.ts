import { describe, it, expect } from 'vitest'
// T1 smoke: proves the console workspace member participates in `pnpm -r test`; real tests land with the console slice
describe('@omnilet/console harness', () => {
  it('smoke passes', () => { expect(1 + 1).toBe(2) })
})
