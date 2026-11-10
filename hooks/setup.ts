import type { EngineInterface } from 'claude-code'
import type { SettingsDraft } from '../types'
import { config, type Hideable, type JudgeConfig } from './config'
import { chainIds, withRoute } from './decisions'
import { envHome, envUserProfile } from './env'

// Fork: decision is where a decision model runs (Zen, OpenRouter or TypeSafe); decision-openrouter and decision-typesafe take that key.
export type SetupStep = 'pick' | 'decision' | 'decision-openrouter' | 'decision-typesafe' | 'lean' | 'handoff' | 'look' | 'done'

/** The lean's five stops, cheaper to smarter: a name, and what it does to the judge's pick (see tipped). */
export const LEAN_STOPS = [
  ['Cheapest', 'more picks go lower'],
  ['Cheaper', 'unsure picks go lower'],
  ['Balanced', 'the judge decides'],
  ['Smarter', 'unsure picks go higher'],
  ['Smartest', 'more picks go higher'],
] as const

/** The guide's step after this one: the judge (with its key or URL), the lean, the handoff, then done. */
export function setupNext(step: SetupStep): SetupStep | null {
  if (step === 'pick' || step === 'decision' || step === 'decision-openrouter' || step === 'decision-typesafe') return 'lean'
  if (step === 'lean') return 'handoff'
  if (step === 'handoff') return 'look'
  if (step === 'look') return 'done'
  return null
}

/** The step Back goes to: the judge's key or URL goes back to the pick, as does the lean. */
export function setupBack(step: SetupStep): SetupStep | null {
  if (step === 'decision-openrouter' || step === 'decision-typesafe') return 'decision'
  if (step === 'decision' || step === 'lean') return 'pick'
  if (step === 'handoff') return 'lean'
  if (step === 'look') return 'handoff'
  if (step === 'done') return 'look'
  return null
}

/** "2/3" for the step shown; the closing step has no number. */
export function setupCounter(step: SetupStep): string {
  const n = { pick: 1, decision: 1, 'decision-openrouter': 1, 'decision-typesafe': 1, lean: 2, handoff: 3, look: 4, done: 0 }[step]
  return n ? `${n}/4` : ''
}

/** The guide's choices over the saved settings: what each step shows. */
export function setupShown(draft: SettingsDraft, saved: JudgeConfig) {
  return {
    judge: (draft.judge ?? saved.judge) as JudgeConfig['judge'],
    bias: draft.bias !== undefined ? Number(draft.bias) : saved.bias,
    handoffSkill: draft.handoffSkill ?? saved.handoffSkill,
    hide: (draft.hide ?? saved.hide.join(',')).split(',').filter(Boolean) as Hideable[],
    appearance: (draft.appearance ?? saved.appearance) as JudgeConfig['appearance'],
  }
}

/** The decision model a TypeSafe key is used by: TypeSafe's Jev. */
export const TYPESAFE_ROUTE = 'typesafe/jev-latest'
/** The draft's decision models (or the saved ones) with the TypeSafe route added. */
export const withTypesafeRoute = (raw?: string) => withRoute(raw ?? chainIds(config.decisionModels), TYPESAFE_ROUTE)

/**
 * Where `claude` may be: on PATH, then where the official installers put it. The desktop app starts with the PATH it
 * had at login, so a CLI installed since is not on it until the next sign-in.
 */
export function claudeCandidates(home: string | undefined): string[] {
  if (!home) return ['claude']
  const win = /^[A-Za-z]:/.test(home)
  const sep = home.includes('\\') ? '\\' : '/'
  return ['claude', [home.replace(/[\\/]+$/, ''), '.local', 'bin', win ? 'claude.exe' : 'claude'].join(sep)]
}
// What the engine says when a command cannot be started at all, as opposed to one that ran and failed.
const NOT_STARTED = /ENOENT|not found or is in an unsafe location|failed to start/i
/** For a `claude` that would not start: what to install, in the person's own shell; undefined for any other error. */
export function noClaudeHint(error: string, home: string | undefined): string | undefined {
  if (!NOT_STARTED.test(error)) return undefined
  const install = home && /^[A-Za-z]:/.test(home) ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash'
  return `This needs the Claude Code CLI. Install it with ${install}, then reopen the app.`
}
export async function homeDir($: EngineInterface) {
  return ((await envUserProfile($)) ?? (await envHome($))) || undefined
}
/** `claude <args>`, from the next place it may be when one will not start. */
export async function runClaude($: EngineInterface, args: string[], opts: Parameters<EngineInterface['process']['run']>[1]) {
  let last: unknown
  for (const bin of claudeCandidates(await homeDir($))) {
    try {
      return await $.process.run([bin, ...args], opts)
    } catch (error) {
      last = error
      if (!NOT_STARTED.test(String(error))) throw error
    }
  }
  throw last
}
/** A plain /reload-plugins holds back a change that would make the next message re-read the chat without the cache
 * (new commands do), says "installed but not applied" and keeps the old code running. Uninstall was pressed: apply it. */
export const RELOAD_ARGS = '--force'
