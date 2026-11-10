import type { Effort, HandoffAfter, ModelKey } from '../types'
import { type DecisionRoute, parseDecisionModels } from './decisions'
import { type ThemeName, THEMES } from './theme'

// The ladders the two sliders walk, cheapest first.
export const MODELS: { key: ModelKey; label: string }[] = [
  { key: 'haiku', label: 'Haiku' },
  { key: 'sonnet', label: 'Sonnet' },
  { key: 'opus', label: 'Opus' },
  { key: 'fable', label: 'Fable' },
]
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// shortcut: every Claude family is taken to keep the prompt cache when effort changes, as Opus, Sonnet, Haiku and Fable
// do per Claude Code's docs; older models (which rewrote it) and no-cache setups are not detected (README, Models).
export const cacheSafe = (modelId: string) => /opus|sonnet|haiku|fable/.test(modelId)

export const EFFORT_LABELS: Record<Effort, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' }

/** Which judge the person picked in the plugin's settings, and what it needs. */
export type JudgeConfig = {
  judge: 'auto' | 'haiku'
  typesafeKey: string
  /** Decision models asked in order before Haiku. Empty: Haiku judges alone. */
  decisionModels: DecisionRoute[]
  /** For the openrouter/ decision models; left empty, OPENROUTER_API_KEY is used. */
  openrouterKey: string
  /** How long each decision model may take, in ms. */
  judgeTimeoutMs: number
  /** How long all the decision models together may take before Haiku judges, in ms. */
  judgeBudgetMs: number
  /** A skill or slash command that writes the handoff instead of the built-in prompt, e.g. "session-handoff". */
  handoffSkill: string
  /** What follows the handoff: clear and carry on, clear and wait, or keep the chat and copy the handoff. The handoff
   *  bar opens on the choice made last; this is the first one. */
  handoffAfter: HandoffAfter
  /** The effort slider, -2 (cheaper) to 2 (smarter): tips the judge's close calls that way. */
  bias: number
  /** Auto never goes below this effort. */
  floor: Effort
  /** Auto never goes above this effort. */
  ceiling: Effort
  /** What the person switched off: the footer's handoff button and any of the alert bands. */
  hide: Hideable[]
  /** The swamp band shows once the context fills this share of the window, in percent. */
  swampAt: number
  /** default: the dashboard band above the prompt; minimal: the footer's small buttons and no band. */
  layout: 'default' | 'minimal'
  /** Who writes a compaction's summary: Haiku (the default, a fraction of the price) or the chat's own model. */
  compactWith: 'haiku' | 'session'
  /** advised: the footer slot is Compact until Haiku advises a handoff. always: it is always the Handoff button. */
  handoffButton: 'advised' | 'always'
  /** on: every subagent the chat sends off gets an effort picked by the judge before it starts. */
  helpers: 'on' | 'off'
  /** The accent colour of everything effortless draws: the brand violet, Claude orange or cherry-blossom rose. */
  theme: ThemeName
  /** auto: light when Claude Code's own theme is light. dark and light fix it. */
  appearance: 'auto' | 'dark' | 'light'
}

/** The swamp thresholds the settings offer, in percent of the context window. */
export const SWAMP_STEPS = [10, 20, 30, 40, 50, 60, 70, 80] as const

/** The parts of effortless a person can switch off: the footer's handoff button, the cache timer and the judge's line.
 * The context (swamp), running-low (hot) and cold-cache alerts can be switched off for good in Customize; the judge-down
 * alert always shows. Each alert also has its own ✕. */
export const HIDEABLE = ['handoff', 'timer', 'reason', 'swamp', 'hot', 'cold'] as const
export type Hideable = (typeof HIDEABLE)[number]
const JUDGE_TIMEOUT_MS = 4000
const JUDGE_BUDGET_MS = 8000

export let config: JudgeConfig = {
  judge: 'auto',
  typesafeKey: '',
  decisionModels: [],
  openrouterKey: '',
  judgeTimeoutMs: JUDGE_TIMEOUT_MS,
  judgeBudgetMs: JUDGE_BUDGET_MS,
  handoffSkill: '',
  handoffAfter: 'continue',
  bias: 0,
  floor: 'low',
  ceiling: 'max',
  hide: ['reason'],
  swampAt: 70,
  layout: 'default',
  compactWith: 'haiku',
  handoffButton: 'advised',
  helpers: 'off',
  theme: 'violet',
  appearance: 'auto',
}
export function setConfig(v: JudgeConfig) { config = v }

/** A setting in milliseconds: a positive whole number as typed, else undefined. */
function validMs(s: string): number | undefined {
  const n = Number(s)
  return /^\d+$/.test(s) && n > 0 && Number.isSafeInteger(n) ? n : undefined
}

/** One line per judge timing the person set that is not a positive whole number, saying the default it falls back to. */
export function timingWarnings(options: unknown): string[] {
  const o = (options ?? {}) as Record<string, unknown>
  return ([['judgeTimeoutMs', JUDGE_TIMEOUT_MS], ['judgeBudgetMs', JUDGE_BUDGET_MS]] as const).flatMap(([k, fallback]) => {
    const v = typeof o[k] === 'string' ? (o[k] as string).trim() : ''
    return v && validMs(v) === undefined ? [`${k} "${v}" is not a positive whole number of ms; using ${fallback}`] : []
  })
}

/** The settings as the engine hands them over (defaults filled in), cleaned to the shape the judge reads. */
export function readConfig(options: unknown): JudgeConfig {
  const o = (options ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const picked = str(o.judge)
  return {
    judge: picked === 'haiku' ? 'haiku' : 'auto',
    typesafeKey: str(o.typesafeKey),
    decisionModels: parseDecisionModels(str(o.decisionModels)),
    openrouterKey: str(o.openrouterKey),
    // Used as typed: network waits don't count toward the 10 s hook budget, so the budget is how long a prompt can be held.
    judgeTimeoutMs: validMs(str(o.judgeTimeoutMs)) ?? JUDGE_TIMEOUT_MS,
    judgeBudgetMs: validMs(str(o.judgeBudgetMs)) ?? JUDGE_BUDGET_MS,
    handoffSkill: str(o.handoffSkill).replace(/^\//, ''),
    handoffAfter: (['confirm', 'copy'] as const).find(a => a === str(o.handoffAfter)) ?? 'continue',
    bias: Math.max(-2, Math.min(2, Math.round(Number(str(o.effortBias)) || 0))),
    floor: EFFORTS.includes(str(o.effortFloor) as Effort) ? (str(o.effortFloor) as Effort) : 'low',
    ceiling: EFFORTS.includes(str(o.effortCeiling) as Effort) ? (str(o.effortCeiling) as Effort) : 'max',
    swampAt: SWAMP_STEPS.includes(Number(str(o.swampAt)) as (typeof SWAMP_STEPS)[number]) ? Number(str(o.swampAt)) : 70,
    layout: str(o.layout) === 'minimal' ? 'minimal' : 'default',
    compactWith: str(o.compactWith) === 'session' ? 'session' : 'haiku',
    handoffButton: str(o.handoffButton) === 'always' ? 'always' : 'advised',
    helpers: str(o.helpers) === 'on' ? 'on' : 'off',
    theme: THEMES.find(t => t === str(o.theme)) ?? 'violet',
    appearance: (['dark', 'light'] as const).find(a => a === str(o.appearance)) ?? 'auto',
    // The judge's line is off until switched on; an empty string saved from the panel means everything shows.
    hide: (o.hide === undefined ? 'reason' : str(o.hide))
      .split(',')
      .map(part => part.trim())
      .filter((part): part is Hideable => (HIDEABLE as readonly string[]).includes(part)),
  }
}

export const HAIKU_MODEL = 'claude-haiku-5-5'
