// Task 6 contract: ingest = directory scan + four-file pairing + platform-override
// SELECTION + ol:requires collection. Override deep-resolution (IR 覆写区) is T8.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ingest, IngestError } from './ingest'

const FIXTURE = join(import.meta.dirname, '../tests/fixtures/counter')

/** Temp workspace so override/degenerate variants never touch the frozen fixture. */
let work: string
beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'ol-ingest-'))
})
afterAll(() => {
  rmSync(work, { recursive: true, force: true })
})

function makeDir(rel: string): string {
  const d = join(work, rel)
  mkdirSync(d, { recursive: true })
  return d
}

describe('ingest — fixture pairing (frozen tests/fixtures/counter)', () => {
  it('pairs one page with all four files and collects requires=[storage]', () => {
    const { pages, app } = ingest(FIXTURE)
    expect(pages).toHaveLength(1)
    const p = pages[0]
    expect(p.name).toBe('pages/index/index')
    expect(p.html).toContain('ol:requires="storage"')
    expect(p.ts).toContain("from 'omnilet'")
    expect(p.css).toContain('.box')
    // css/json raw text here; parsed in T10 as manifest input
    expect(p.json).toContain('navigationBarTitleText')
    expect(p.requires).toEqual(['storage'])
    expect(app.json).toContain('"pages"')
    expect(app.ts).toContain('onLaunch')
  })

  it('pages come out in path-sorted order (deterministic, no fs-walk noise)', () => {
    const { pages } = ingest(FIXTURE)
    const names = pages.map((p) => p.name)
    expect(names).toEqual([...names].sort())
  })
})

describe('ingest — platform override selection (dsl-spec §5)', () => {
  it('index.wechat.ts beats index.ts for platform=wechat (default)', () => {
    const root = makeDir('ov1')
    makeDir('ov1/pages/index')
    const pg = 'ov1/pages/index'
    writeFileSync(join(work, `${pg}/index.html`), '<view></view>')
    writeFileSync(join(work, `${pg}/index.ts`), 'export default { base: true }')
    writeFileSync(join(work, `${pg}/index.wechat.ts`), 'export default { wechat: true }')
    writeFileSync(join(work, `${pg}/index.css`), '.a{}')
    writeFileSync(join(work, `${pg}/index.wechat.css`), '.b{}')
    const { pages } = ingest(join(work, 'ov1'))
    expect(pages[0].ts).toContain('wechat: true')
    expect(pages[0].css).toContain('.b') // html/css/json override alike, not just ts
  })

  it('platform=web ignores .wechat files and keeps the base pair', () => {
    const { pages } = ingest(join(work, 'ov1'), { platform: 'web' })
    expect(pages[0].ts).toContain('base: true')
    expect(pages[0].css).toContain('.a')
  })

  it('html override parity: co-present index.wechat.html beats index.html (§5)', () => {
    const root = makeDir('ovh')
    makeDir('ovh/pages/index')
    const pg = join(work, 'ovh/pages/index')
    writeFileSync(join(pg, 'index.html'), '<view ol:requires="storage">base</view>')
    writeFileSync(join(pg, 'index.wechat.html'), '<view ol:requires="network">wechat</view>')
    writeFileSync(join(pg, 'index.ts'), 'x')
    const { pages } = ingest(join(work, 'ovh'))
    expect(pages).toHaveLength(1) // override shape never anchors a second page
    expect(pages[0].html).toContain('wechat')
    expect(pages[0].requires).toEqual(['network']) // requires collected from the WINNER
  })

  it('hyphen/case platform tokens never become page anchors (narrowed charset)', () => {
    const root = makeDir('ovp')
    makeDir('ovp/pages/index')
    const pg = join(work, 'ovp/pages/index')
    writeFileSync(join(pg, 'index.html'), '<view>base</view>')
    writeFileSync(join(pg, 'index.Quick-App.html'), '<view>other-end</view>')
    writeFileSync(join(pg, 'index.ts'), 'x')
    const { pages } = ingest(join(work, 'ovp'), { platform: 'wechat' })
    expect(pages).toHaveLength(1)
    expect(pages[0].html).toContain('base') // not consumed, not an anchor, not picked for wechat
  })

  it('bare .wechat.html (no base) is an override with nothing to override — no page', () => {
    const root = makeDir('ov2')
    makeDir('ov2/pages/index')
    writeFileSync(join(work, 'ov2/pages/index/index.wechat.html'), '<view></view>')
    writeFileSync(join(work, 'ov2/pages/index/index.wechat.ts'), 'x')
    const { pages } = ingest(join(work, 'ov2'))
    expect(pages).toEqual([]) // anchors are .html only; documented in ingest.ts
  })
})

  it("single-quote ol:requires='...' supported; data-ol:requires rejected (boundary)", () => {
    const root = makeDir('req4')
    makeDir('req4/pages/index')
    const pg = join(work, 'req4/pages/index')
    // decoy attribute lives on the ROOT tag too — otherwise the boundary is never exercised
    writeFileSync(join(pg, 'index.html'), "<view data-ol:requires=\"net\" ol:requires='camera'><text>hi</text></view>")
    writeFileSync(join(pg, 'index.ts'), 'x')
    expect(ingest(join(work, 'req4')).pages[0].requires).toEqual(['camera'])
  })

describe('ingest — optional/required files + degenerate cases', () => {
  it('missing css/json yields null fields (html+ts required, css+json optional)', () => {
    const root = makeDir('opt')
    makeDir('opt/pages/index')
    writeFileSync(join(work, 'opt/pages/index/index.html'), '<view></view>')
    writeFileSync(join(work, 'opt/pages/index/index.ts'), 'x')
    const { pages } = ingest(join(work, 'opt'))
    expect(pages[0].css).toBeNull()
    expect(pages[0].json).toBeNull()
  })

  it('missing html or ts throws IngestError naming the page and the file', () => {
    const root = makeDir('miss')
    makeDir('miss/pages/bad')
    writeFileSync(join(work, 'miss/pages/bad/index.html'), '<view></view>')
    expect(() => ingest(join(work, 'miss'))).toThrowError(/pages\/bad\/index\.ts/)
  })

  it('ts-only dir (no html anchor) is a stray file, not a page unit', () => {
    const root = makeDir('miss2')
    makeDir('miss2/pages/bad')
    writeFileSync(join(work, 'miss2/pages/bad/index.ts'), 'x')
    expect(ingest(join(work, 'miss2')).pages).toEqual([])
  })

  it('root with no pages/ dir ingests zero pages (empty project is legal here)', () => {
    const root = makeDir('empty')
    expect(() => ingest(root)).not.toThrow()
    expect(ingest(root).pages).toEqual([])
  })

  it('page dir with a lone orphan .html (no .ts) is a required-file error, not a skip', () => {
    const root = makeDir('lone')
    makeDir('lone/pages/index')
    writeFileSync(join(work, 'lone/pages/index/index.html'), '<view></view>')
    expect(() => ingest(join(work, 'lone'))).toThrowError(IngestError)
  })
})

describe('ingest — ol:requires on the root element only', () => {
  it('splits comma-separated values, trims, drops empty tokens', () => {
    const root = makeDir('req')
    makeDir('req/pages/index')
    writeFileSync(
      join(work, 'req/pages/index/index.html'),
      '<view ol:requires="storage, network,">\n<text ol:requires="net"></text></view>'
    )
    writeFileSync(join(work, 'req/pages/index/index.ts'), 'x')
    const { pages } = ingest(join(work, 'req'))
    expect(pages[0].requires).toEqual(['storage', 'network'])
  })

  it('no ol:requires attribute → empty array', () => {
    expect(ingest(FIXTURE).pages[0].requires).toEqual(['storage']) // fixture sanity
    const root = makeDir('req2')
    makeDir('req2/pages/index')
    writeFileSync(join(work, 'req2/pages/index/index.html'), '<view><text>hi</text></view>')
    writeFileSync(join(work, 'req2/pages/index/index.ts'), 'x')
    expect(ingest(join(work, 'req2')).pages[0].requires).toEqual([])
  })

  it('requires survives the leading comment/whitespace before the root tag', () => {
    const root = makeDir('req3')
    makeDir('req3/pages/index')
    writeFileSync(
      join(work, 'req3/pages/index/index.html'),
      '\n<!-- page: counter -->\n<view ol:requires="storage"></view>'
    )
    writeFileSync(join(work, 'req3/pages/index/index.ts'), 'x')
    expect(ingest(join(work, 'req3')).pages[0].requires).toEqual(['storage'])
  })
})
