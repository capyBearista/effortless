import type { Spent } from '../types'
import { EFFORT_LABELS, EFFORTS } from './config'

// What one token costs relative to an uncached input token, the same ratios on every Claude model. Measured over
// 80k requests of real Claude Code use, cache reads are about 76% of a session's cost, cache writes 16% and output 8%: effort
// mostly changes how many tool calls a prompt makes, not what one answer writes, so all four are counted.
export const WEIGHT = { input: 1, write: 1.25, read: 0.1, out: 5 }

/**
 * The tally in its current shape. A hot reload keeps the state an older version wrote ({ requests, actual,
 * baseline } before 0.2.0), so every read goes through this.
 */
export function asSpent(t: unknown): Spent {
  const v = (t ?? {}) as Partial<Spent>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const judged = (v.judge ?? {}) as Partial<Spent['judge']>
  return {
    prompts: num(v.prompts),
    requests: num(v.requests),
    input: num(v.input),
    write: num(v.write),
    read: num(v.read),
    out: num(v.out),
    byEffort: v.byEffort && typeof v.byEffort === 'object' ? v.byEffort : {},
    judge: {
      decision: num(judged.decision),
      haikuUnsure: num(judged.haikuUnsure),
      haikuNoAnswer: num(judged.haikuNoAnswer),
      haikuOnly: num(judged.haikuOnly),
      ms: num(judged.ms),
      tokens: num(judged.tokens),
    },
    helpers: {
      runs: v.helpers?.runs && typeof v.helpers.runs === 'object' ? v.helpers.runs : {},
      requests: num(v.helpers?.requests),
      cost: num(v.helpers?.cost),
    },
  }
}

/** A request's tokens weighted by price, in input-token terms (see WEIGHT). */
export function weighted(usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  return (
    (usage.input_tokens ?? 0) * WEIGHT.input +
    (usage.cache_creation_input_tokens ?? 0) * WEIGHT.write +
    (usage.cache_read_input_tokens ?? 0) * WEIGHT.read +
    (usage.output_tokens ?? 0) * WEIGHT.out
  )
}

/** 1234 -> "1.2k", 87 -> "87". */
export function tokens(n: number): string {
  const v = Math.abs(n)
  const text = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  return n < 0 ? `-${text}` : text
}

const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)} %`

/**
 * What /effortless stats answers: what the prompts Auto steered cost, measured, split by kind and by effort,
 * and what the judge took. No "saved" figure: what a prompt would have cost at another effort is not known,
 * since effort mostly changes how many tool calls it makes. Cost is in tokens weighted as priced (WEIGHT).
 */
export function savedText(raw: Spent): string {
  const t = asSpent(raw)
  const judged = t.judge.decision + t.judge.haikuUnsure + t.judge.haikuNoAnswer + t.judge.haikuOnly
  const helperRuns = EFFORTS.reduce((n, e) => n + (t.helpers.runs[e] ?? 0), 0)
  if (t.prompts === 0 && judged === 0 && helperRuns === 0) return 'nothing measured yet'
  const input = t.input * WEIGHT.input
  const write = t.write * WEIGHT.write
  const cached = t.read * WEIGHT.read
  const out = t.out * WEIGHT.out
  const total = input + write + cached + out
  const lines = [
    `${t.prompts} prompts, ${t.requests} requests, cost about ${tokens(Math.round(total))} tokens weighted by price` +
      (total > 0 ? ` (cache reads ${share(cached, total)}, cache writes ${share(write, total)}, output ${share(out, total)})` : ''),
  ]
  const per = EFFORTS.filter(e => t.byEffort[e]?.prompts).map(e => {
    const b = t.byEffort[e]!
    return `${EFFORT_LABELS[e]} ${b.prompts}, average ${tokens(Math.round(b.cost / b.prompts))}`
  })
  if (per.length) lines.push(`Per prompt: ${per.join('; ')}`)
  if (helperRuns) {
    const per = EFFORTS.filter(e => t.helpers.runs[e]).map(e => `${EFFORT_LABELS[e]} ${t.helpers.runs[e]}`)
    lines.push(`Helpers: ${helperRuns} subagent${helperRuns === 1 ? '' : 's'} (${per.join(', ')}), ${t.helpers.requests} requests, cost about ${tokens(Math.round(t.helpers.cost))} tokens`)
  }
  if (judged) {
    lines.push(
      `Judge: decision models ${t.judge.decision}, Haiku after unsure ${t.judge.haikuUnsure}, after no answer ${t.judge.haikuNoAnswer}, Haiku only ${t.judge.haikuOnly}, average ${Math.round(t.judge.ms / judged)} ms, ${tokens(t.judge.tokens)} tokens in all`,
    )
  }
  return lines.join('\n')
}

/** k/M for token counts: 420000 -> "420k", 1000000 -> "1.0M". */
export function kTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}
