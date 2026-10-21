// Task 8 (compile-slice1): expression whitelist engine — parser + validator + paths.
//
// Why a mini-parser here instead of @babel/parser: the IR-order red line (spec §2)
// keeps every @babel/* import inside `codegen/js.ts` (T12 enforces this as a module
// boundary grep). Template expressions must still be walked as ASTs, and the
// accepted grammar is EXACTLY the dsl-spec §1 whitelist (data reads / arithmetic /
// compare / ternary; no calls, no `?.`/`??` — spec §9 keeps them out until WeChat
// support is measured). The grammar IS the whitelist, so a strict recursive-descent
// parser over the allowed shapes is the smallest correct engine: anything outside
// the grammar fails with a named reason, and the walk side still consults the
// exprWhitelist TABLE rows for node-type/operator acceptance ("table is data").

import type { TableRow } from './types'

export type ExprNode =
  | { nt: 'path'; parts: string[] }
  | { nt: 'lit'; lit: 'string' | 'number' | 'boolean' | 'null'; text: string }
  | { nt: 'bin'; op: string; l: ExprNode; r: ExprNode }
  | { nt: 'log'; op: '&&' | '||'; l: ExprNode; r: ExprNode }
  | { nt: 'un'; op: string; e: ExprNode }
  | { nt: 'cond'; test: ExprNode; yes: ExprNode; no: ExprNode }

export type ExprResult = { ok: true; node: ExprNode } | { ok: false; reason: string }

type Tok = { k: 'id' | 'num' | 'str' | 'punc'; v: string }

// Longest-match first; every operator the grammar can EVER contain is listed —
// constructs we reject (??, ?., =, [ , { , backtick) still need tokens so the
// failure reason can name them precisely.
const PUNCS = [
  '===', '!==', '==', '!=', '<=', '>=', '&&', '||', '??', '?.',
  '(', ')', '[', ']', '{', '}', ',', '.', ':', '?',
  '+', '-', '*', '/', '%', '!', '=', '<', '>',
]

function tokenize(src: string): Tok[] | string {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    if (c === '`') return 'template literal not in whitelist'
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1)
      if (end < 0) return 'unterminated string literal'
      toks.push({ k: 'str', v: src.slice(i, end + 1) })
      i = end + 1
      continue
    }
    const id = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))
    if (id) {
      toks.push({ k: 'id', v: id[0] })
      i += id[0].length
      continue
    }
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(src.slice(i))
    if (num) {
      toks.push({ k: 'num', v: num[0] })
      i += num[0].length
      continue
    }
    const punc = PUNCS.find((p) => src.startsWith(p, i))
    if (punc) {
      toks.push({ k: 'punc', v: punc })
      i += punc.length
      continue
    }
    return `unexpected character '${c}' in expression`
  }
  return toks
}

const RESERVED_WORDS = new Set(['in', 'instanceof', 'new', 'typeof', 'void', 'delete', 'await', 'yield'])

class ExprParser {
  private pos = 0
  constructor(private readonly toks: Tok[]) {}

  parse(): ExprNode | null {
    const node = this.ternary()
    if (node && this.pos < this.toks.length) this.die(`unexpected '${this.toks[this.pos]!.v}'`)
    return node
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos]
  }
  private isPunc(...vs: string[]): boolean {
    const t = this.peek()
    return !!t && t.k === 'punc' && vs.includes(t.v)
  }
  private eat(v: string): void {
    this.pos++
  }
  private die(reason: string): never {
    throw reason
  }

  private ternary(): ExprNode {
    const test = this.or()
    if (this.isPunc('?')) {
      this.eat('?')
      const yes = this.ternary()
      if (!this.isPunc(':')) this.die("ternary ':' missing")
      this.eat(':')
      return { nt: 'cond', test, yes, no: this.ternary() }
    }
    return test
  }
  private or(): ExprNode {
    let l = this.and()
    while (this.isPunc('||')) {
      this.eat('||')
      l = { nt: 'log', op: '||', l, r: this.and() }
    }
    return l
  }
  private and(): ExprNode {
    let l = this.equality()
    while (this.isPunc('&&')) {
      this.eat('&&')
      l = { nt: 'log', op: '&&', l, r: this.equality() }
    }
    return l
  }
  private equality(): ExprNode {
    let l = this.relational()
    while (this.isPunc('==', '===', '!=', '!==')) {
      const op = this.peek()!.v
      this.eat(op)
      l = { nt: 'bin', op, l, r: this.relational() }
    }
    if (this.isPunc('=', '??')) this.die(this.isPunc('??') ? 'nullish ?? not in whitelist' : 'assignment not in whitelist')
    return l
  }
  private relational(): ExprNode {
    let l = this.additive()
    while (this.isPunc('<', '<=', '>', '>=')) {
      const op = this.peek()!.v
      this.eat(op)
      l = { nt: 'bin', op, l, r: this.additive() }
    }
    return l
  }
  private additive(): ExprNode {
    let l = this.multiplicative()
    while (this.isPunc('+', '-')) {
      const op = this.peek()!.v
      this.eat(op)
      l = { nt: 'bin', op, l, r: this.multiplicative() }
    }
    return l
  }
  private multiplicative(): ExprNode {
    let l = this.unary()
    while (this.isPunc('*', '/', '%')) {
      const op = this.peek()!.v
      this.eat(op)
      l = { nt: 'bin', op, l, r: this.unary() }
    }
    return l
  }
  private unary(): ExprNode {
    if (this.isPunc('!', '-', '+')) {
      const op = this.peek()!.v
      this.eat(op)
      return { nt: 'un', op, e: this.unary() }
    }
    const t = this.peek()
    if (t?.k === 'id' && RESERVED_WORDS.has(t.v)) this.die(`'${t.v}' not in whitelist`)
    return this.postfix()
  }
  private postfix(): ExprNode {
    let base = this.primary()
    for (;;) {
      if (this.isPunc('.')) {
        this.eat('.')
        const p = this.peek()
        if (!p || p.k !== 'id') this.die('property name expected after .')
        this.eat(p.v)
        base = base.nt === 'path' ? { nt: 'path', parts: [...base.parts, p.v] } : this.die('member access on non-path')
        continue
      }
      if (this.isPunc('?.')) this.die('optional chaining not in whitelist')
      if (this.isPunc('(')) this.die('function call not in whitelist')
      if (this.isPunc('[')) this.die('computed access not in whitelist')
      return base
    }
  }
  private primary(): ExprNode {
    const t = this.peek()
    if (!t) this.die('expression ended unexpectedly')
    if (t.k === 'num') {
      this.eat(t.v)
      return { nt: 'lit', lit: 'number', text: t.v }
    }
    if (t.k === 'str') {
      this.eat(t.v)
      return { nt: 'lit', lit: 'string', text: t.v.slice(1, -1) }
    }
    if (t.k === 'id') {
      this.eat(t.v)
      if (t.v === 'true' || t.v === 'false') return { nt: 'lit', lit: 'boolean', text: t.v }
      if (t.v === 'null') return { nt: 'lit', lit: 'null', text: t.v }
      return { nt: 'path', parts: [t.v] }
    }
    if (t.v === '(') {
      this.eat('(')
      if (this.isPunc(')')) this.die('empty parens')
      const inner = this.ternary()
      if (!this.isPunc(')')) this.die("closing ')' missing")
      // group followed by '(' is still a call on the grouped expr; caught by postfix caller
      return inner
    }
    if (t.v === '{') this.die('object literal not in whitelist')
    if (t.v === '[') this.die('array literal not in whitelist')
    if (t.v === ',') this.die('comma sequence not in whitelist')
    this.die(`unexpected '${t.v}'`)
  }
}

/** Parse one whitelist-candidate expression. Never throws; failures carry a reason. */
export function parseExpr(raw: string): ExprResult {
  const toks = tokenize(raw)
  if (typeof toks === 'string') return { ok: false, reason: toks }
  const p = new ExprParser(toks)
  try {
    const node = p.parse()
    if (!node) return { ok: false, reason: 'empty expression' }
    return { ok: true, node }
  } catch (reason) {
    return { ok: false, reason: String(reason) }
  }
}

/** Map a parsed node onto its exprWhitelist table row name (dsl-spec §1 grammar). */
export function nodeTypeName(n: ExprNode): string {
  switch (n.nt) {
    case 'path':
      return n.parts.length === 1 ? 'Identifier' : 'MemberExpression'
    case 'lit':
      return { string: 'StringLiteral', number: 'NumericLiteral', boolean: 'BooleanLiteral', null: 'NullLiteral' }[n.lit]
    case 'bin':
      return 'BinaryExpression'
    case 'log':
      return 'LogicalExpression'
    case 'un':
      return 'UnaryExpression'
    case 'cond':
      return 'ConditionalExpression'
  }
}

/** Row index of the expression whitelist: name -> row (last wins, table order). */
export type ExprWhitelist = Map<string, TableRow>

export function buildExprWhitelist(rows: TableRow[]): ExprWhitelist {
  return new Map(rows.map((r) => [r.s, r]))
}

function opsAllowed(row: TableRow | undefined, op: string): boolean {
  if (!row || row.t === undefined) return false
  return row.t.split(',').map((o) => o.trim()).includes(op)
}

/**
 * Walk a parsed expression against the whitelist table. Returns the first
 * violation reason, or null when every node type is a listed row and every
 * operator is in the owning row's `t` list. The enum-vs-table walk is the
 * "table is data" half; parseExpr is the grammar half.
 */
export function validateExpr(node: ExprNode, whitelist: ExprWhitelist): string | null {
  const stack: ExprNode[] = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    const name = nodeTypeName(n)
    const row = whitelist.get(name)
    if (!row) return `${name} not in exprWhitelist table`
    if (n.nt === 'bin' || n.nt === 'log' || n.nt === 'un') {
      if (!opsAllowed(row, n.op)) return `${name} operator '${n.op}' not in whitelist row`
    }
    switch (n.nt) {
      case 'bin':
      case 'log':
        stack.push(n.l, n.r)
        break
      case 'un':
        stack.push(n.e)
        break
      case 'cond':
        stack.push(n.test, n.yes, n.no)
        break
      default:
        break
    }
  }
  return null
}

/** Dot-joined data paths referenced by a parsed expression, minus v-for alias scopes. */
export function collectPaths(node: ExprNode, scope: ReadonlySet<string>): string[] {
  const out: string[] = []
  const stack: ExprNode[] = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (n.nt === 'path') {
      if (!scope.has(n.parts[0]!)) out.push(n.parts.join('.'))
      continue
    }
    switch (n.nt) {
      case 'bin':
      case 'log':
        stack.push(n.l, n.r)
        break
      case 'un':
        stack.push(n.e)
        break
      case 'cond':
        stack.push(n.test, n.yes, n.no)
        break
      default:
        break
    }
  }
  return out
}
