# Golden Normalization Spec (compile-slice1 T2)

Byte contract for every golden fragment referenced by a rule-table row's
`golden` field and for golden files under the compiler's test fixtures.
`assertNormalized()` (this package, `src/index.ts`) is the machine pre-check
run before any golden comparison; a golden that fails it never reaches diff.

## Rules

1. **Line endings: LF only.** No CR anywhere (`assertNormalized` throws on
   `\r`). CRLF-authored files must be converted before landing.
2. **Indentation: 2-space stepping.** Leading whitespace must be an even
   number of spaces; tabs are rejected. (Interior spacing is verbatim output.)
3. **wxml attribute order: table-driven fixed order.** Attribute emission order
   is the row order of the owning `tagMap`/`directiveMap` table — never object
   key iteration order. Goldens therefore stay byte-stable across runtimes.
4. **No absolute paths.** The regexes `/home/` and `/tmp/` are banned inside
   goldens (`assertNormalized` throws); reference package-relative paths only.
5. **No timestamps or other per-run values** in goldens. Machine-checked for
   the two path prefixes; the timestamp ban is an authoring rule — anything
   non-deterministic must be table-stripped or templated before it reaches a
   golden, so no byte regex can pin it.

## Consumers

- `@omnilet/compiler` golden gate (T5/T10): every golden loaded for comparison
  passes `assertNormalized` first; the check failing is a diagnostic (code 2xx,
  normalize family), not a golden diff.
- Rule-table authoring: `golden` strings in table rows follow the same rules.
