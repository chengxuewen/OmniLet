// Task 10 (compile-slice1): `omnilet build` thin shell — arg parse, forward to
// compileProject, print diagnostics (human text), exit 0/1 by ok. NOTHING else:
// watch/incremental/pretty-errors are §8 reopen items.
//
// Run (README usage; 参数非冻结 — §8 trigger "CLI 参数冻结 = 管线定型后"):
//   pixi run pnpm --dir compiler exec tsx src/cli.ts --dir <src> --out <pkg> [--mode dev|prod]
import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { compileProject, type CompileMode } from './compileProject'
import { IngestError } from './ingest'
import { TableGateError } from './tables'

type CliArgs = { dir: string; out: string; mode: CompileMode }

export function parseArgs(argv: readonly string[]): CliArgs | string {
  let dir: string | null = null
  let out: string | null = null
  let mode: CompileMode = 'dev'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir' || a === '--out') {
      const v = argv[i + 1]
      if (!v) return `missing value for ${a}`
      if (a === '--dir') dir = v
      else out = v
      i++
    } else if (a === '--mode') {
      const v = argv[i + 1]
      if (v !== 'dev' && v !== 'prod') return `--mode takes dev|prod (got '${v ?? ''}')`
      mode = v
      i++
    } else {
      return `unknown argument '${a ?? ''}'`
    }
  }
  if (!dir) return 'missing --dir <project-root>'
  if (!out) return 'missing --out <package-dir>'
  return { dir, out, mode }
}

export function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (typeof args === 'string') {
    console.error(`omnilet build: ${args}`)
    console.error('usage: omnilet build --dir <project-root> --out <package-dir> [--mode dev|prod]')
    return Promise.resolve(1)
  }
  return compileProject({ root: args.dir, outDir: args.out, target: 'wechat', mode: args.mode })
    .then((r) => {
      for (const d of r.diagnostics) {
        const where = d.loc ? ` @ ${d.loc.file}:${d.loc.line}:${d.loc.col}` : ''
        console.error(`${d.code}${where}: ${d.message}\n  hint: ${d.hint}`)
      }
      if (r.ok) {
        console.log(`OK — ${r.artifacts.length} artifacts -> ${args.out}`)
        for (const a of r.artifacts) console.log(`  ${a}`)
        return 0
      }
      console.error(`FAILED — ${r.diagnostics.length} diagnostic(s), no files written`)
      return 1
    })
    .catch((e: unknown) => {
      // load-time refusals: rule-table gate (3xx) + ingest (missing required files).
      if (e instanceof TableGateError || e instanceof IngestError) {
        console.error(`${e.name}: ${e.message}`)
        return 1
      }
      throw e
    })
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}
