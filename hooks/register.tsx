import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelForkResult, Register, RenderInput } from 'claude-code'

import type { AgentRec, Effort, HandoffAfter, HandoffChoice, JudgedModel, ModelAnswer, ModelKey, Pick, SettingsDraft, Spent } from '../types'
import { agentsPane, demoAgents, demoFiles, demoSteps, importsOf, relPath, toolLine, touchOf, withTouch, withWaits } from './agents'
import { ART_COLUMNS, ART_FRAME_MS, ART_MIN_WIDTH, ART_ROWS, type ArtKind, artFrame, MOVING } from './art'
import { MARK_SVG } from './brand-mark'
import { cacheSafe, config, EFFORT_LABELS, EFFORTS, HAIKU_MODEL, type Hideable, type JudgeConfig, MODELS, readConfig, setConfig, SWAMP_STEPS, timingWarnings } from './config'
import { chainIds, DECISION_PRESETS, type DecisionRoute, hopTimeout, MAX_ROUTES, movedEarlier, OPENROUTER_APP_HEADERS, OPENROUTER_URL, parseDecisionModels, routeLabel, routeName, routeShortName, withoutRoute, withRoute, ZEN_URL } from './decisions'
import { type EnvAsk, envHome, envOpenRouterKey, envTypesafeKey, envTypesafeUrl, envUserProfile, loadedSession, parseEnvLine, parseTypesafeKey, proof, renderLog, setLoadedSession, typedTypesafeKey, withEnvLine, withTypesafeKey, writeRenderLog } from './env'
import { forkOutcome, HANDOFF_FULL_PROMPT, HANDOFF_PROMPT, haikuCompaction, haikuHandoff, handoffArgs, handoffMessage, handoffWhat, withFocus } from './handoff'
import { answersText, DECISION_QUESTIONS, DECISION_TASK, HANDOFF_SYSTEM, handoffEvidence, helperFloor, helperQuestion, isFollowUp, isUnsure, JUDGE_SYSTEM, judgeFailure, judgeQuestion, keepsEffort, namedEffort, parseDecisionAnswer, parseHandoffAnswer, parseVerdict, recentContext, sureWords, type HaikuWhy, type Judged, type Verdict, typedSkill, withAttachments, withMidTurn } from './judge'
import { onKnob, themedEls } from './theme'
import { PILL_H, stepsFromTodos, thinkingSvg, THINK_W, withTaskCreated, withTaskUpdated } from './progress'
import { asSpent, kTokens, savedText, tokens, WEIGHT, weighted } from './stats'
import { ACCENT, applyTheme, AUTO_GLOW_H, AUTO_GLOW_MS, AUTO_GLOW_W, autoGlowSvg, autoSwitchSvg, binSvg, BOG, BOG_BG, BOG_EDGE, BRAND_BG, BRAND_EDGE, BRAND_SVG, CARD_HOVER, CARD_HOVER_EDGE, CLAUDE_MARK, COLD_GLOW_MS, coldGlowSvg, COMPACT_FADE_MS, compactFadeSvg, DASH_BG, DASH_DIM, DASH_EDGE, DASH_HEAD, DASH_MARK_OFF, DASH_MARK_SIZE, DASH_SVG, DASH_TEXT, dashboardLines, DONE_ACCENT, DONE_BG, DONE_EDGE, DONE_MARK_SVG, DONE_SVG, DOWN_SVG, EMBER, EMBER_BG, EMBER_EDGE, EMBER_SVG, enterSvg, FLASH_MS, FLASH_STEPS, flashColor, FROST_HEIGHT, FROST_SVG, FROST_WIDTH, GLOW_H, GLOW_W, GO_CELLS, GO_W, goPillSvg, HANDOFF_BOX_AT, HANDOFF_PILL_H, HANDOFF_PILL_W, HANDOFF_SVG, handoffGlowStep, handoffGlowSvg, handoffLook, handoffPillSvg, HOVER_BOX, ICE_BG, ICE_EDGE, inPhase, INTRO_SVG, JUDGE_FADE_MS, JUDGE_RISE_MS, JUDGE_STEP_MS, judgeGlowAt, OPENCODE_MARK, OPENROUTER_MARK, providerMark, refreshAppearance, ringSvg, rowIconSvg, SETTINGS_MARK, SETTINGS_TITLE, settingsSvg, SLATE, SLATE_BG, SLATE_EDGE, SWAMP_SVG, TYPESAFE_MARK } from './svgs'
import { bounded, CACHE_TTL, cacheClock, cacheClockSvg, cacheColor, cacheLabel, cacheTtlOf, capped, type HotClosed, hotVisible, hotWindow, ICE, mostlyCached, resetLabel, tipped } from './usage'

// Auto: whether the judge picks the effort.
const isAuto = atom({ plugin: 'effortless', key: 'isAuto' } as const, true)
const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone'
const EMPTY_SPENT: Spent = { prompts: 0, requests: 0, input: 0, write: 0, read: 0, out: 0, byEffort: {}, judge: { decision: 0, haikuUnsure: 0, haikuNoAnswer: 0, haikuOnly: 0, ms: 0, tokens: 0 } }
const SWITCHED_MS = 2500
const CACHE_TICK_MS = 15_000
const pick = atom({ plugin: 'effortless', key: 'pick' } as const, null)
const isJudging = atom({ plugin: 'effortless', key: 'isJudging' } as const, false)
const appEffort = atom({ plugin: 'effortless', key: 'appEffort' } as const, null)
const model = atom({ plugin: 'effortless', key: 'model' } as const, null)
// The last change Auto made to the effort, shown for a moment as "Low → High" and then cleared.
const switched = atom({ plugin: 'effortless', key: 'switched' } as const, null)
// What the prompts Auto steered cost this session, measured, and what judging them took.
const saved = atom({ plugin: 'effortless', key: 'saved' } as const, EMPTY_SPENT)
// True while the session runs a model where Auto must not change effort (see cacheSafe).
const paused = atom({ plugin: 'effortless', key: 'paused' } as const, false)
// How long the main conversation's prompt cache stays warm, in whole minutes left: null before the first response,
// 0 once it has gone cold. Updated only when the minute changes, so the footer redraws once a minute at most.
const cacheLeft = atom({ plugin: 'effortless', key: 'cacheLeft' } as const, null)
const cacheMemo = atom({ plugin: 'effortless', key: 'cacheMemo' } as const, null)
const isCompacting = atom({ plugin: 'effortless', key: 'isCompacting' } as const, false)
// The compact bar: open after Compact is pressed, with a field for what the summary should keep.
const compactAsk = atom({ plugin: 'effortless', key: 'compactAsk' } as const, false)
// What is typed in that field. Kept here, not in state: a write per key would redraw the bar under the cursor.
let compactNote = ''
// When the compact bar opened: its first half second fades the swamped band's colours out (see compactFadeSvg).
let compactOpenedAt = 0
// Where a handoff is: null idle, writing (the handoff turn runs), clearing (clear and resend).
const handoffStage = atom({ plugin: 'effortless', key: 'handoffStage' } as const, null)
// The handoff bar above the prompt, open with the choice shown in it, or null.
const handoffPick = atom({ plugin: 'effortless', key: 'handoffPick' } as const, null)
// The context is swamped: tokens read per request, or null below the line. Drives the swamp band.
const swamped = atom({ plugin: 'effortless', key: 'swamped' } as const, null)
// Why Haiku thinks a handoff would suit now, or null. It lights Handoff and says why; there is no percent threshold.
const handoffAdvice = atom({ plugin: 'effortless', key: 'handoffAdvice' } as const, null)
// The swamp band was closed at this many tokens; it comes back once the context has grown well past it.
// The handoff card above the prompt: shown from the start of a handoff, and once it lands ('done' in the
// cleared chat, 'copied'). It goes with the next message, its ✕, or HANDOFF_CARD_MS after it was set.
type HandoffCard = { kind: 'writing' | 'done' | 'copied' | 'compacting' | 'compacted'; full: boolean; at: number; seen: boolean }
// Kinds still under way: they stay until they land, with moving art. Compacting shares the card with the handoff.
const cardRunning = (kind: HandoffCard['kind']) => kind === 'writing' || kind === 'compacting'
// Kinds that landed well: the card turns green with a checkmark.
const cardLanded = (kind: HandoffCard['kind']) => kind === 'done' || kind === 'compacted'
const handoffCard = atom({ plugin: 'effortless', key: 'handoffCard' } as const, null)
const HANDOFF_CARD_MS = 2 * 60_000

async function setHandoffCard($: EngineInterface, kind: HandoffCard['kind'], full: boolean, seen = false) {
  const at = await $.clock.now()
  await update($, handoffAdvice, () => null)
  await update($, handoffCard, () => ({ kind, full, at, seen }))
  // Gone after a while even with no reply; a timer that dies with its request leaves the next reply to clear it.
  if (!cardRunning(kind)) {
    try {
      $.clock.after(HANDOFF_CARD_MS, () => void update($, handoffCard, card => (card && card.at === at ? null : card)))
    } catch {}
  }
}

// The newest reply's text, so the warning card goes under its last block and nowhere else.
const lastAnswer = atom({ plugin: 'effortless', key: 'lastAnswer' } as const, '')
const lastTurn = atom({ plugin: 'effortless', key: 'lastTurn' } as const, null)
// The weighted tokens of the main thread's requests since the prompt; kept in lastTurn when the turn ends.
let turnCost = 0
const swampHiddenAt = atom({ plugin: 'effortless', key: 'swampHiddenAt' } as const, null)
// The first-run setup is not done: the footer offers "Setup".
const setupPending = atom({ plugin: 'effortless', key: 'setupPending' } as const, false)
// Why the judge the person picked is failing (Haiku stands in), or null when it works.
// The effortless settings panel is open above the prompt.
const settingsOpen = atom({ plugin: 'effortless', key: 'settingsOpen' } as const, false)
// What was changed in the panel and not saved yet, by field; Save applies it all, the cross drops it.
// The user and plugin skills, read when the settings panel opens.
const installedSkills = atom({ plugin: 'effortless', key: 'installedSkills' } as const, [])
const settingsDraft = atom({ plugin: 'effortless', key: 'settingsDraft' } as const, {})
const judgeDown = atom({ plugin: 'effortless', key: 'judgeDown' } as const, null)
// Which part of the settings panel is open: null for the cards.
type SettingsCard = 'effort' | 'judge' | 'handoff' | 'show' | 'models'
const settingsCard = atom({ plugin: 'effortless', key: 'settingsCard' } as const, null)
/** The settings panel's parts: a card each on the overview, and what the part is for, said once it is open. */
const CARDS: readonly { id: SettingsCard; title: string; about: string }[] = [
  { id: 'effort', title: 'Effort', about: 'How hard Claude thinks. The slider tips close calls; Min and Max are hard limits.' },
  { id: 'handoff', title: 'Handoff & alerts', about: 'The full handoff skill, which model writes a compaction, when to suggest compacting, and which alerts show.' },
  { id: 'show', title: 'Customize', about: 'How effortless looks and which parts it shows. Uninstall removes it.' },
  { id: 'judge', title: 'Judge', about: 'Haiku judges prompts and handoffs. Add decision models for quicker effort calls. Test checks they answer.' },
]
/** Fork: the Judge part's own sub-part, opened from it and not on the overview: the decision models, in order. */
const MODELS_PART = { id: 'models', title: 'Models', about: 'Asked in order until one answers; Haiku judges when none does. ↑ moves one earlier.' } as const
/** A part's name and what it does, sub-parts included. */
const partOf = (card: SettingsCard) => (card === 'models' ? MODELS_PART : CARDS.find(c => c.id === card))
const BIAS_WORDS = ['Cheapest', 'Cheaper', 'Balanced', 'Smarter', 'Smartest'] as const
// The settings panel's judge test: running, or what it found. Null before a test and once the panel closes.
const judgeTest = atom({ plugin: 'effortless', key: 'judgeTest' } as const, null)
// The judge-down band was closed for this reason; a new reason shows it again.
const judgeDownHidden = atom({ plugin: 'effortless', key: 'judgeDownHidden' } as const, null)
// A usage limit is close: which window, how much is used, when it resets. Null below the line.
const hot = atom({ plugin: 'effortless', key: 'hot' } as const, null)
// The running-hot band was closed at this many percent; it returns ten points later or in a new window.
// The running-hot band closed with its cross: in which window and how full. Kept in the store too, so a new chat keeps it closed.
const hotHidden = atom({ plugin: 'effortless', key: 'hotHidden' } as const, null as HotClosed | null)
// The agent panel: this chat's subagents, and the card opened in it (hooks/agents.tsx).
const agentsState = atom({ plugin: 'effortless', key: 'agents' } as const, [])
const agentsOpen = atom({ plugin: 'effortless', key: 'agentsOpen' } as const, null)
// The panel's map: the files touched, the main chat's own steps, the module opened in its list.
const agentFiles = atom({ plugin: 'effortless', key: 'agentFiles' } as const, [])
const agentSteps = atom({ plugin: 'effortless', key: 'agentSteps' } as const, null)
const agentsModule = atom({ plugin: 'effortless', key: 'agentsModule' } as const, null)
// Save mode: Auto picks at most medium until this time (ms), when the limit resets.
const saveUntil = atom({ plugin: 'effortless', key: 'saveUntil' } as const, null)
const isColdHidden = atom({ plugin: 'effortless', key: 'isColdHidden' } as const, false)
// The setup guide above the prompt: which step it shows, or null when it is closed.
const setupStep = atom({ plugin: 'effortless', key: 'setupStep' } as const, null)
// What was picked in the setup guide and not saved yet: it is saved in one go at Done or ✕. Each saved setting reloads
// the plugin, and the app says so in the chat, so a save per click filled the chat with notices.
const setupDraft = atom({ plugin: 'effortless', key: 'setupDraft' } as const, {})
/** How long a band's entrance runs: it is drawn only this long after the band appears, since every redraw of the band
 * (a choice, the minute tick) would replay it. */
const INTRO_MS = 1300
// The band last drawn above the prompt, and when it appeared (see introShows).
let introKind = ''
let introAt = 0
// How far the entrance on screen is, for introLayer.
let introElapsed = 0
// Set when a band replaces another, taken by the first draw of the new one.
let introFresh = false
async function introShows($: EngineInterface, kind: string): Promise<boolean> {
  const now = await $.clock.now()
  if (kind !== introKind) {
    introKind = kind
    introAt = now
    introFresh = true
    $.clock.after(INTRO_MS + 100, () => $.ui.invalidate('ui.render'))
  }
  introElapsed = now - introAt
  return introElapsed < INTRO_MS
}
/** The entrance layer (INTRO_SVG) in a band's own colours, or nothing once the entrance is over. */
// The mark beside a card's title, sized to one line of text.
const TITLE_MARK_SIZE = 16

/** A card's title with the effortless mark where the ✦ stood; the ✦ stays where the surface draws no images. */
function markTitle(els: { Box: unknown; Text: unknown; Svg?: unknown }, key: string, color: string, title: string, mark = MARK_SVG) {
  const { Box: B, Text: T, Svg: S } = els as unknown as { Box: (p: Record<string, unknown>) => unknown; Text: (p: Record<string, unknown>) => unknown; Svg?: (p: Record<string, unknown>) => unknown }
  if (!S) return <T key={key} color={color} bold wrap="truncate">{title}</T>
  return (
    <B key={key} flexDirection="row" alignItems="center" flexShrink={1} minWidth={0}>
      <B flexShrink={0} marginRight={1} alignItems="center">
        <S source={mark} alt="effortless" width={TITLE_MARK_SIZE} height={TITLE_MARK_SIZE} />
      </B>
      <T color={color} bold wrap="truncate">{title.replace(/^✦ /, '')}</T>
    </B>
  )
}

function introLayer(els: { Box: unknown; Svg?: unknown }, key: string, show: boolean, wash = '#8b6cff', light = '#b9a7ff') {
  if (!els.Svg || !show) return null
  const { Box: B, Svg: S } = els as unknown as { Box: (p: Record<string, unknown>) => unknown; Svg: (p: Record<string, unknown>) => unknown }
  return (
    <B key={`${key}-intro`} position="absolute" top={-1} left={0} right={0} bottom={-1}>
      <S source={inPhase(INTRO_SVG.replace('#8b6cff', wash).replace('#b9a7ff', light), introElapsed)} alt="" width={1600} height={240} />
    </B>
  )
}

// A lower verdict for a message typed mid-turn, applied when that turn ends (see prompt.submit).
let heldPick: Pick | null = null
// Counts the changes the person makes by hand to the pick or to Auto. A judge compares it before and after: a change made
// while it ran drops its verdict. Module state like heldPick: a read in the judge's own hook still gave the values from
// before a click that the band (another hook) had already drawn.
let handChanges = 0

// The band's words when effortless kept the effort because the judge was unsure.
const UNSURE = 'unsure, keeping'

let askTypesafeFile: EnvAsk | undefined
// A key was saved from the settings panel into ~/.config/jev/.env: that file wins over an older key in the settings.
let keyFromFile = false
/**
 * The TypeSafe key for typesafe/ decision models: the settings, else TYPESAFE_API_KEY, else ~/.config/jev/.env. The file
 * is only opened when the two above are empty, and only by a caller that needs a key.
 */
async function typesafeKey($: EngineInterface): Promise<string | undefined> {
  if (config.typesafeKey && !keyFromFile) return config.typesafeKey
  const fromEnv = await envTypesafeKey($)
  if (fromEnv) return fromEnv
  askTypesafeFile =
    askTypesafeFile ??
    (async () => {
      const home = (await envUserProfile($)) ?? (await envHome($))
      if (!home) return undefined
      const text = await $.fs.read(`${home}/.config/jev/.env`).catch(() => '')
      return parseTypesafeKey(typeof text === 'string' ? text : '')
    })()
  return askTypesafeFile
}

const warned = new Set<string>()
/** Tells the person once per session and reason that their judge failed and Haiku stands in. */
function warnJudge($: EngineInterface, reason: string) {
  // A test from the settings panel takes the reason for its own line, with no toast and no judge-down band.
  if (judgeTesting) {
    judgeTesting.reason = reason
    return
  }
  void proof($, `judge fallback: ${reason}`)
  void update($, judgeDown, () => reason).then(() => $.ui.invalidate('ui.render'))
  if (warned.has(reason)) return
  warned.add(reason)
  $.ui.toast(`effortless: ${reason}. Haiku judges for now.`)
}

// What the app passed to register, so settings kept in the store can be laid over it at session start.
let pluginOptions: Record<string, unknown> = {}

/**
 * Haiku always judges; decision models are the optional quick ones, asked first unless the setting is haiku. Haiku makes
 * the call when they fail, are slow, or are unsure of (or silent on) the effort for `target`, the model the answer is
 * for. With no target (a helper, whose model is not known yet) the answer is taken as it is and each request checks its
 * own model's entry. Never throws.
 */
async function judge($: EngineInterface, prompt: string, target: JudgedModel | null): Promise<Judged> {
  const context = await recentContext($).catch(() => '')
  if (config.judge === 'haiku' || !config.decisionModels.length) return haikuJudges($, prompt, context, { kind: 'only', said: 'only judge' })
  const chain = await askChain($, prompt, context)
  const first = chain.judged
  if (!first?.verdict) return haikuJudges($, prompt, context, { kind: 'chain', said: `chain: ${chain.reason}` })
  if (target && (!first.verdict.efforts[target] || isUnsure(first.verdict.by, first.verdict.efforts[target]))) return haikuAfter($, first, prompt, context, target)
  return first
}

/** Haiku as the judge: its verdict is counted under `why`. With no answer there is no verdict, so nothing is counted. */
async function haikuJudges($: EngineInterface, prompt: string, context: string, why: HaikuWhy): Promise<Judged> {
  const haiku = await askHaiku($, prompt, context)
  return haiku.verdict ? { ...haiku, haikuWhy: why } : haiku
}

/** A decision model was unsure of, or silent on, the model in use: Haiku makes the call, and both judges' tokens count.
 * Without Haiku's answer the decision model's answer is returned as it is, for the caller to keep the effort in force. */
async function haikuAfter($: EngineInterface, decided: Judged, prompt: string, context: string, target: JudgedModel): Promise<Judged> {
  const haiku = await askHaiku($, prompt, context)
  const answer = decided.verdict?.efforts[target]
  const said = answer ? `unsure ${(answer.sure ?? 0).toFixed(2)}` : `no answer for ${target}`
  const tokens = haiku.tokens + decided.tokens
  return haiku.verdict
    ? { verdict: haiku.verdict, tokens, haikuWhy: { kind: 'unsure', said } }
    : { verdict: decided.verdict, tokens, haikuMissed: `${said}, Haiku gave no answer` }
}

/** The key a decision model needs: none on Zen, the OpenRouter key, or the TypeSafe key for typesafe/ models. */
async function routeKey($: EngineInterface, route: DecisionRoute): Promise<string | undefined> {
  if (route.provider === 'zen') return undefined
  if (route.provider === 'openrouter') {
    // A key pasted in the panel went to the file: it wins over an older one in the settings.
    if (orKeyFromFile) return (await openRouterFileKey($)) || config.openrouterKey || (await envOpenRouterKey($)) || undefined
    return config.openrouterKey || (await envOpenRouterKey($)) || (await openRouterFileKey($)) || undefined
  }
  return typesafeKey($).catch(() => undefined)
}

/** Where a pasted OpenRouter key is kept: the app's secret settings cannot be written by a plugin. */
const OPENROUTER_FILE = '.config/openrouter/effortless.env'
let askOpenRouterFile: EnvAsk | undefined
// An OpenRouter key was saved from the panel or the guide into OPENROUTER_FILE.
let orKeyFromFile = false
/** The key in OPENROUTER_FILE. Only read once an openrouter/ model is asked for or the person opens the panel. */
async function openRouterFileKey($: EngineInterface): Promise<string | undefined> {
  askOpenRouterFile =
    askOpenRouterFile ??
    (async () => {
      const home = (await envUserProfile($)) ?? (await envHome($))
      if (!home) return undefined
      const text = await $.fs.read(`${home}/${OPENROUTER_FILE}`).catch(() => '')
      return parseEnvLine(typeof text === 'string' ? text : '', 'OPENROUTER_API_KEY')
    })()
  return askOpenRouterFile
}

/** Whether an OpenRouter key is anywhere the openrouter/ models would find it. */
async function hasOpenRouterKey($: EngineInterface): Promise<boolean> {
  return Boolean(config.openrouterKey || (await envOpenRouterKey($)) || (await openRouterFileKey($).catch(() => undefined)))
}

// The decision model that answered the last prompt, and how fast: for /effortless debug.
let lastChainAnswer = ''
// The last verdict as the judge gave it, before effortless's settings, and what was applied: for /effortless debug.
let lastVerdictLine = ''

/**
 * Fork: the decision models in the order set, each until one answers. A failed one passes to the next; a model with
 * no key is skipped without a request. An unsure answer still ends the chain (Haiku may decide). The person hears only
 * when none answered, once, with the last reason. Never throws.
 */
async function askChain(
  $: EngineInterface,
  prompt: string,
  context: string,
  // The panel's Test passes its draft: the models and keys not saved yet.
  routes: readonly DecisionRoute[] = config.decisionModels,
  draftKeys: { openrouter?: string; typesafe?: string } = {},
): Promise<{ judged?: Judged; name: string; misses: string[]; reason: string }> {
  const start = await $.clock.now()
  let failed: string | undefined
  let skipped: string | undefined
  // What happened to each model before the one that answered, in the settings' words: for the panel's Test line.
  const misses: string[] = []
  for (const route of routes) {
    const name = routeName(route)
    const draft = route.provider !== 'zen' ? draftKeys[route.provider]?.trim() : undefined
    // A pasted TYPESAFE_API_KEY=… line counts as its value, as when it is saved.
    const key = (route.provider === 'typesafe' && draft ? typedTypesafeKey(draft) : draft) || (await routeKey($, route))
    if (route.provider !== 'zen' && !key) {
      skipped = skipped ?? `${name} has no key`
      misses.push(`${routeLabel(route)}: no key`)
      continue
    }
    const timeoutMs = hopTimeout(start, await $.clock.now(), config.judgeTimeoutMs, config.judgeBudgetMs)
    if (timeoutMs === undefined) {
      failed = 'the decision models ran out of time'
      break
    }
    const url = route.provider === 'zen' ? ZEN_URL : route.provider === 'openrouter' ? OPENROUTER_URL : ((await envTypesafeUrl($)) ?? TYPESAFE_URL)
    const askedAt = await $.clock.now()
    const asked = await askDecision($, { name, url, model: route.model, key, timeoutMs, label: routeShortName(route) }, prompt, context)
    if ('judged' in asked) {
      const took = (((await $.clock.now()) - askedAt) / 1000).toFixed(1)
      lastChainAnswer = `${routeLabel(route)} ${took} s`
      void proof($, `judge: ${name} answered`)
      return { judged: asked.judged, name: routeLabel(route), misses, reason: '' }
    }
    void proof($, `judge: ${asked.reason}, next`)
    failed = asked.reason
    misses.push(`${routeLabel(route)}: ${asked.reason.replace(`${name} `, '')}`)
  }
  lastChainAnswer = 'none answered, Haiku judged'
  const reason = failed ?? skipped ?? 'no decision model answered'
  warnJudge($, reason)
  return { name: '', misses, reason }
}

/** One decision model, asked once: its verdict, or why not (quiet when it answered in a shape that is not a verdict). */
async function askDecision(
  $: EngineInterface,
  ask: { name: string; url: string; model: string; key?: string; timeoutMs: number; label?: string },
  prompt: string,
  context: string,
): Promise<{ judged: Judged } | { reason: string; quiet?: true }> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    // Zen's free models take no key; a stray one would go to a server that never asked for it.
    if (ask.key) headers.authorization = `Bearer ${ask.key}`
    if (ask.url === OPENROUTER_URL) Object.assign(headers, OPENROUTER_APP_HEADERS)
    // A stalled endpoint must not hold the prompt: after the timeout the judge falls through to the next.
    const res = await Promise.race([
      $.http.fetch(ask.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: ask.model,
          // Neither the model in use nor the effort in force: the same message gets the same question.
          state: { task: DECISION_TASK, recent_conversation: context, next_message: prompt.slice(0, 4000) },
          questions: DECISION_QUESTIONS,
        }),
      }),
      $.clock.sleep(ask.timeoutMs).then(() => {
        throw new Error('decision model timeout')
      }),
    ])
    if (!res.ok) return { reason: judgeFailure(ask.name, res.status) }
    const verdict = parseDecisionAnswer(res.text)
    if (verdict) {
      let used = 0
      try {
        const usage = (JSON.parse(res.text) as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
        used = (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)
      } catch {
        // No usage in the reply: counted as 0.
      }
      if (await read($, judgeDown)) await update($, judgeDown, () => null)
      return { judged: { verdict: { ...verdict, ...(ask.label ? { judgeName: ask.label } : {}) }, tokens: used } }
    }
    return { reason: `${ask.name} gave no usable answer`, quiet: true }
  } catch (error) {
    // Down or slow: the caller falls through to the next judge, and says so.
    return { reason: String(error).includes('timeout') ? judgeFailure(ask.name, 'timeout') : `${ask.name} could not be reached` }
  }
}

// Set while the settings panel tests a judge: warnJudge leaves its reason here instead of warning.
let judgeTesting: { reason?: string } | null = null
/** The prompt a judge test sends: small and plain, so any working judge answers it. */
const JUDGE_TEST_PROMPT = 'rename one variable in a single file'

/** Asks the judge picked in the panel (its unsaved keys and models included) one sample prompt, and says in a line
 * whether it answered, with what and how fast, or why not. With decision models set, they are walked as a prompt would
 * walk them; with none, Haiku answers. */
async function testJudge($: EngineInterface, judgeKind: string, draftChain = chainIds(config.decisionModels), draftKeys: { openrouter?: string; typesafe?: string } = {}): Promise<{ ok: boolean; text: string }> {
  const start = await $.clock.now()
  const took = async () => `${(((await $.clock.now()) - start) / 1000).toFixed(1)} s`
  const said = (name: string, j: Judged | undefined) => `${name} answered: ${j?.verdict ? answersText(j.verdict) : 'nothing'}`
  judgeTesting = {}
  try {
    // Fork: with decision models set, the test walks them as a prompt would and names the one that answered.
    const routes = parseDecisionModels(draftChain)
    if (judgeKind !== 'haiku' && routes.length) {
      const chained = await askChain($, JUDGE_TEST_PROMPT, '', routes, draftKeys)
      const before = chained.misses.length ? ` · ${chained.misses.join(' · ')}` : ''
      if (chained.judged) return { ok: true, text: `${said(chained.name, chained.judged)} in ${await took()}${before}` }
      return { ok: false, text: judgeTesting.reason ?? 'No decision model gave a usable answer' }
    }
    const h = await askHaiku($, JUDGE_TEST_PROMPT, '')
    return h.verdict ? { ok: true, text: `${said('Haiku', h)} in ${await took()}` } : { ok: false, text: 'Haiku gave no answer' }
  } catch (error) {
    return { ok: false, text: String(error).slice(0, 80) }
  } finally {
    judgeTesting = null
  }
}

/** Haiku through the session's own login: the judge that needs no key, and the fallback for the others. */
async function askHaiku($: EngineInterface, prompt: string, context: string): Promise<Judged> {
  const used = lastContext && lastContext.window ? `Context used: ${Math.round(lastContext.percent)}% of the window` : ''
  const asked = [judgeQuestion(prompt, context), used].filter(Boolean).join('\n\n')
  const ask = (model: string) => $.model.complete({ model, system: JUDGE_SYSTEM, prompt: asked, maxTokens: 160, effort: 'low', timeoutMs: 6000 })
  // Haiku by its pinned id: Claude Code builds that predate it map the plain alias to an older, ten-times-pricier Haiku.
  // Where the pinned id does not answer, the alias stands in.
  let r = await ask(HAIKU_MODEL)
  if (!r.isAnswered) r = await ask('haiku')
  const verdict = r.isAnswered ? parseVerdict(r.text) : undefined
  const tokens = r.isAnswered && r.usage ? r.usage.input_tokens + r.usage.output_tokens : 0
  return { verdict, tokens }
}

// Whether a fresh chat would now serve better than carrying on: Haiku's call, whatever judge picks the effort. It runs
// from HANDOFF_CHECK_FROM percent of context, every HANDOFF_CHECK_EVERY messages, so it costs a cent now and then. It
// reads more than the effort judge: what the chat was for, the trail of topics, the last turns, the context and the cache.
const HANDOFF_CHECK_FROM = 30
const HANDOFF_CHECK_EVERY = 2

let promptsSinceHandoffCheck = 0
/** Called with each message the person sends. Sets or clears the advice; never throws, never holds the message. */
async function checkHandoff($: EngineInterface, next: string) {
  const percent = lastContext?.percent ?? 0
  if (percent < HANDOFF_CHECK_FROM) {
    promptsSinceHandoffCheck = 0
    if ((await read($, handoffAdvice)) !== null) {
      await update($, handoffAdvice, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  promptsSinceHandoffCheck++
  if (promptsSinceHandoffCheck < HANDOFF_CHECK_EVERY) return
  promptsSinceHandoffCheck = 0
  try {
    const evidence = handoffEvidence(await $.session.messages(), next, percent, (await cacheMinutes($)) === 0 && cacheExpires > 0)
    const ask = (model: string) => $.model.complete({ model, system: HANDOFF_SYSTEM, prompt: evidence, maxTokens: 60, effort: 'low', timeoutMs: 8000 })
    let r = await ask(HAIKU_MODEL)
    if (!r.isAnswered) r = await ask('haiku')
    if (!r.isAnswered) return
    const reason = parseHandoffAnswer(r.text)
    void proof($, `handoff check at ${Math.round(percent)}%: ${reason ?? 'no'}`)
    if (reason !== (await read($, handoffAdvice))) {
      await update($, handoffAdvice, () => reason)
      $.ui.invalidate('ui.render')
    }
  } catch {
    // A failed check changes nothing.
  }
}

function keyOf(id: string): ModelKey | undefined {
  return MODELS.find(m => id.includes(m.key))?.key
}

/** Records the model the session now runs; the pick follows it, so the band never shows a stale one. */
async function modelIs($: EngineInterface, id: string) {
  const pause = !cacheSafe(id)
  if (pause !== (await read($, paused))) await update($, paused, () => pause)
  const key = keyOf(id)
  if (!key || key === (await read($, model))) return
  await update($, model, () => key)
  // The engine's effort can differ per model, so a change across a switch is not the person's doing.
  engineEffort = undefined
  const current = await read($, pick)
  if (current && current.model !== key) {
    // A judged pick takes the new model's own answer, through the person's settings; a level they set or named stays.
    // Also with Auto off, so turning it back on never brings the old model's answer. A decision model's why is how sure
    // it was, so that is said anew; Haiku's holds for every model.
    const answer = current.judged?.[key]
    const why = current.by === 'decision' || current.why === UNSURE ? (answer ? sureWords(answer) : '') : current.why
    // No sure answer for the new model (and not the person's own level): the level is kept, and the band says so.
    const own = answer && !isUnsure(current.by, answer) ? { ...(await settledPick($, answer, why)), sure: answer.sure } : current.judged ? { why: UNSURE } : {}
    await choose($, { ...current, model: key, ...own })
  }
}

/** A judge's answer for the chat's model within the person's slider, Min and Max and save mode, and the band's why. */
async function settledPick($: EngineInterface, answer: ModelAnswer, why: string): Promise<{ effort: Effort; why: string }> {
  const saving = (await read($, saveUntil)) !== null
  const leaned = bounded(tipped(answer.effort, answer.sure, config.bias), config.floor, config.ceiling)
  const effort = capped(leaned, saving)
  return { effort, why: effort !== leaned ? 'save mode' : leaned !== answer.effort ? 'your settings' : why }
}

/**
 * The stored pick settled again under the current Min, Max, Lean and save mode: at save mode's switch, and at session
 * start after a saved setting reloaded the plugin. A judge's answer is taken again from its answers; a kept effort is
 * only held within the limits; the person's own pick and a named level stay.
 */
async function resettle($: EngineInterface) {
  const p = await read($, pick)
  if (!p || p.by === 'manual' || p.by === 'named') return
  const saving = (await read($, saveUntil)) !== null
  const answer = p.judged?.[p.model]
  const next =
    answer && !isUnsure(p.by, answer)
      ? { ...p, ...(await settledPick($, answer, p.by === 'decision' || ['save mode', 'your settings'].includes(p.why) ? sureWords(answer) : p.why)) }
      : { ...p, effort: capped(bounded(p.effort, config.floor, config.ceiling), saving) }
  if (next.effort !== p.effort || next.why !== p.why) await choose($, next)
}

async function sessionModel($: EngineInterface): Promise<ModelKey> {
  const id = await $.session.model()
  return MODELS.find(m => id.includes(m.key))?.key ?? 'sonnet'
}

// The effort the engine itself last asked for on the main loop (the app's setting; this mod only
// rewrites the request, never the setting). It changing means the person set it (the app's Effort
// control, their own /effort): that wins and Auto goes off.
let engineEffort: string | undefined
// The pick was carried over from the last chat (the store), not made in this one: the app's effort may overrule it.
let pickCarried = false
// The last main-chat request, for /effortless debug: what the app asked for and what the mod sent instead, if anything.
let lastRequest: { index: number; appModel: string; appEffort: unknown; model: string; effort: unknown; at: number } | null = null
// The slash command this mod last typed into the prompt box.
let lastTyped = ''
// The toast about pressing Enter is shown once; on every click it is only noise.
let toldAboutEnter = false

/**
 * Types a slash command into the prompt box for the person to send with Enter. A command the person
 * sends is read by the app itself, so its own Model and Effort controls follow; one the mod runs
 * inside the engine is not. Never overwrites a draft: returns false when the box is not empty.
 */
async function typeCommand($: EngineInterface, text: string): Promise<boolean> {
  try {
    const draft = (await $.prompt.read()).text.trim()
    // A draft of your own is never overwritten; the mod's own earlier command is replaced.
    if (draft !== '' && draft !== lastTyped) return false
    const filled = await $.prompt.fill({ text })
    if (filled.isFilled) lastTyped = text
    if (filled.isFilled && !toldAboutEnter) {
      toldAboutEnter = true
      $.ui.toast(`Press Enter to send ${text} so the app's own control follows`)
    }
    return filled.isFilled
  } catch {
    return false
  }
}

/** Adds one request Auto steered: every kind of token it used, under the effort it ran at. */
async function tally(
  $: EngineInterface,
  effort: Effort,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null },
) {
  const cached = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const cost = usage.input_tokens * WEIGHT.input + write * WEIGHT.write + cached * WEIGHT.read + usage.output_tokens * WEIGHT.out
  await update($, saved, old => {
    const t = asSpent(old)
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return {
      ...t,
      requests: t.requests + 1,
      input: t.input + usage.input_tokens,
      write: t.write + write,
      read: t.read + cached,
      out: t.out + usage.output_tokens,
      byEffort: { ...t.byEffort, [effort]: { ...bucket, cost: bucket.cost + cost } },
    }
  })
}

/** Counts one prompt Auto judged: under its effort, by which judge (and for Haiku, why it was asked), and what the judge took.
 * No judge (no kind): nothing is counted for the judge, its time included, so the average is per counted prompt. */
async function countPrompt($: EngineInterface, effort: Effort | undefined, kind: 'decision' | HaikuWhy['kind'] | undefined, ms: number, judgeTokens: number) {
  await update($, saved, old => {
    const t = asSpent(old)
    const judged = {
      decision: t.judge.decision + (kind === 'decision' ? 1 : 0),
      haikuUnsure: t.judge.haikuUnsure + (kind === 'unsure' ? 1 : 0),
      haikuNoAnswer: t.judge.haikuNoAnswer + (kind === 'chain' ? 1 : 0),
      haikuOnly: t.judge.haikuOnly + (kind === 'only' ? 1 : 0),
      ms: t.judge.ms + (kind ? ms : 0),
      tokens: t.judge.tokens + (kind ? judgeTokens : 0),
    }
    if (!effort) return { ...t, judge: judged }
    const bucket = t.byEffort[effort] ?? { prompts: 0, cost: 0 }
    return { ...t, judge: judged, prompts: t.prompts + 1, byEffort: { ...t.byEffort, [effort]: { ...bucket, prompts: bucket.prompts + 1 } } }
  })
}

/** Save mode on or off: Auto stays at medium or below until the limit resets. The hot band's button and
 *  /effortless save. Says what it did. */
async function toggleSave($: EngineInterface): Promise<string> {
  const saving = (await read($, saveUntil)) !== null
  const heat = await read($, hot)
  const until = heat?.resetsAt ? new Date(heat.resetsAt).getTime() : (await $.clock.now()) + 5 * 3600_000
  await update($, saveUntil, () => (saving ? null : until))
  await resettle($)
  return saving ? 'save mode off' : 'save mode on, Auto stays at medium or below until the limit resets'
}

/** Below this a cold cache costs too little to warn about: the next message rereads the chat at full price once. */
const COLD_MIN_TOKENS = 400_000

/** The context's tokens when the cold band is worth showing: the cache is cold, the band not closed, and the chat big
 * enough that rereading it matters. Null otherwise, and while the size is not known yet. */
async function coldWorth($: EngineInterface): Promise<number | null> {
  if ((await read($, cacheLeft)) !== 0 || config.hide.includes('cold') || (await read($, isColdHidden))) return null
  const tokens = lastContext?.tokens
  if (coldForced) return tokens ?? 0
  return tokens !== undefined && tokens >= COLD_MIN_TOKENS ? tokens : null
}

let cacheTtl: keyof typeof CACHE_TTL = '1h'
let cacheExpires = 0
/** The countdown's variables live in the module, and a reload (an update, a plugin switch) starts the module over: the
 * chat's cache did not go cold for that, so the countdown is read back from the session's state before the band draws
 * (it showed "Cold" after every reload). */
let cacheRestored = false
async function restoreCache($: EngineInterface) {
  if (cacheRestored) return
  cacheRestored = true
  const memo = await read($, cacheMemo)
  if (!memo || cacheExpires !== 0 || memo.expires <= 0) {
    // Nothing to go on: a "Cold" left in the shared state by the copy before is not this chat's cache. restoreCache runs
    // from the draw, which may not write state: it is cleared just after.
    if (cacheExpires === 0 && !coldForced && (await read($, cacheLeft)) === 0) {
      $.clock.after(0, () => {
        if (cacheExpires === 0 && !coldForced) void update($, cacheLeft, () => null).then(() => $.ui.invalidate('ui.render')).catch(() => undefined)
      })
    }
    return
  }
  cacheExpires = memo.expires
  cacheTtl = memo.ttl
  lastResponseAt = memo.last
}
const rememberCache = ($: EngineInterface) => update($, cacheMemo, () => ({ expires: cacheExpires, ttl: cacheTtl, last: lastResponseAt }))
/** Writes the minutes left when they changed; the session's one timer (started in session.start) calls it. */
// What /effortless swamp shows as a test: a swamped chat's context.
const SWAMP_TOKENS = 150_000
// Closed, the band stays away until the context has grown this much more.
const SWAMP_REGROW = 50_000

/** Whether the context is swamped, from the status line's figures. Cheap: no counting, no model call. */
// A usage window this full shows the running-hot band.
const HOT_PERCENT = 80

let hotClosedLoaded = false
/** The closed band as the store keeps it, read once per session (a new chat starts with the atom empty). */
async function hotClosedNow($: EngineInterface): Promise<HotClosed | null> {
  if (!hotClosedLoaded) {
    hotClosedLoaded = true
    const kept = (await $.store.get('hotClosed').catch(() => null)) as HotClosed | null
    if (kept && typeof kept.window === 'string') await update($, hotHidden, () => kept)
  }
  return read($, hotHidden)
}

async function closeHot($: EngineInterface, heat: { kind: string; percent: number; resetsAt: string | null }) {
  const closed: HotClosed = { window: hotWindow(heat), percent: heat.percent }
  await update($, hotHidden, () => closed)
  await $.store.set('hotClosed', closed).catch(() => undefined)
}

/** The fullest of the 5-hour and weekly windows, once one passes HOT_PERCENT. Save mode ends with its window. */
async function checkHot($: EngineInterface, limits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]) {
  const windows = limits.filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
  const top = windows.sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const next = top && top.percentUsed >= HOT_PERCENT ? { kind: top.kind, percent: top.percentUsed, resetsAt: top.resetsAt ?? null } : null
  const was = await read($, hot)
  if (JSON.stringify(next) !== JSON.stringify(was)) {
    await update($, hot, () => next)
    $.ui.invalidate('ui.render')
  }
  const until = await read($, saveUntil)
  if (until !== null && (await $.clock.now()) >= until) await update($, saveUntil, () => null)
}

// A main-conversation turn is running: set when a prompt is sent and at each request, cleared when the turn ends (an
// aborted one too). The swamp band and card wait for it: Compact or Handoff mid-turn would cut the reply off. A turn
// with no request for TURN_STALE_MS counts as over, so a missed end never hides the band for good.
let turnBusyAt: number | undefined
const TURN_STALE_MS = 10 * 60_000
function turnBusy(): boolean {
  return turnBusyAt !== undefined && Date.now() - turnBusyAt < TURN_STALE_MS
}
async function setTurnBusy($: EngineInterface, busy: boolean) {
  const was = turnBusyAt !== undefined
  turnBusyAt = busy ? Date.now() : undefined
  if (was !== busy) $.ui.invalidate('ui.render')
}

/** A context share to draw the bars with instead of the real one, from ~/.claude/effortless-preview.json
 * ({"contextPercent": 45}), so how a level looks can be checked on screen without filling a chat. No file, no change. */
async function previewPercent($: EngineInterface): Promise<number | undefined> {
  const home = (await envUserProfile($)) ?? (await envHome($))
  if (!home) return undefined
  const text = await $.fs.read(`${home}/.claude/effortless-preview.json`).catch(() => '')
  if (!text) return undefined
  try {
    const n = Number((JSON.parse(text) as { contextPercent?: unknown }).contextPercent)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined
  } catch {
    return undefined
  }
}

async function checkSwamp($: EngineInterface) {
  const { context, rateLimits } = await $.session.usage()
  const preview = await previewPercent($)
  const tokens = preview === undefined ? (context.tokens ?? 0) : Math.round(((context.window || 200_000) * preview) / 100)
  // The app may leave the percent out (or give 0) while it has the tokens and the window: work it out then.
  const percent = preview ?? (context.percent || (context.window ? (tokens / context.window) * 100 : 0))
  if (preview !== undefined && !context.window) context.window = 200_000
  const wasStep = handoffGlowStep(lastContext?.percent ?? 0)
  lastContext = { tokens, window: context.window ?? 0, percent }
  // The Handoff button turns white and glows harder with the context: redraw the band when it crosses a step.
  if (handoffGlowStep(percent) !== wasStep) $.ui.invalidate('ui.render')
  await checkHot($, rateLimits ?? [])
  const over = percent >= config.swampAt
  const next = over ? tokens : null
  if (next !== (await read($, swamped))) {
    await update($, swamped, () => next)
    $.ui.invalidate('ui.render')
  }
}

// Redraws still owed after a chat was opened again: the app may draw the band before it is ready for one, so the
// session's 1 s timer asks again a few times (see redrawSoon).
let redrawsOwed = 0
// The countdown's minute the band was last redrawn for (see cacheClockSvg).
let clockMinute = -1
// When the redraws were asked for: once the band has been drawn after that, none are owed any more. Each redraw
// rebuilds the band and restarts its animations, so asking blindly 4 more times reset the cold band's spin 4 times.
let redrawAskedAt = 0
// A draw this soon after the ask may come before the app has the band up, so it does not count.
const REDRAW_SETTLE_MS = 500
function redrawSoon(times = 5) {
  redrawsOwed = Math.max(redrawsOwed, times)
  redrawAskedAt = Date.now()
}

async function showCache($: EngineInterface) {
  // No response seen by this copy yet (it loaded mid-chat, after a plugin switch or reload): a 0 left in the shared
  // state by an earlier copy is not this chat's cache, so the countdown goes blank until the next response.
  if (cacheExpires === 0) {
    if (!coldForced && (await read($, cacheLeft)) !== null) {
      await update($, cacheLeft, () => null)
      $.ui.invalidate('ui.render')
    }
    return
  }
  const minutes = await cacheMinutes($)
  const was = await read($, cacheLeft)
  if (minutes === was) return
  await update($, cacheLeft, () => minutes)
  // Going cold or warm adds or removes the band above the prompt; the desktop app redraws that site only when asked.
  if ((minutes === 0) !== (was === 0)) $.ui.invalidate('ui.render')
}

/** Minutes left, rounded up, so "1" means under a minute and 0 means cold. */
async function cacheMinutes($: EngineInterface): Promise<number> {
  const left = cacheExpires - (await $.clock.now())
  return left <= 0 ? 0 : Math.ceil(left / 60_000)
}

/** A response came back: the cache is warm again for its whole lifetime, and the countdown restarts. */
let usageLogged = false
let lastResponseAt: number | undefined
// Main-conversation replies this copy has seen, for /effortless debug.
let repliesSeen = 0
async function cacheTouched($: EngineInterface, usage: unknown) {
  const now = await $.clock.now()
  repliesSeen++
  if (!usageLogged) {
    usageLogged = true
    void proof($, `first response usage: ${JSON.stringify(usage)}`)
  }
  // When the response does not say, the cache tells by itself: read back after more than 5 minutes means 1 hour.
  const ttl = cacheTtlOf(usage) ?? (lastResponseAt !== undefined && now - lastResponseAt > CACHE_TTL['5m'] && mostlyCached(usage) ? '1h' : undefined)
  lastResponseAt = now
  coldForced = false
  // A reply that wrote only a short 5-minute tail still reads the rest from the 1-hour cache: once 1h is seen, a
  // 5m reading never pulls the countdown back down (that showed "Cold" while the cache was warm).
  if (ttl && ttl !== cacheTtl && !(ttl === '5m' && cacheTtl === '1h' && mostlyCached(usage))) {
    cacheTtl = ttl
    void proof($, `cache lifetime ${ttl}`)
  }
  cacheExpires = now + CACHE_TTL[cacheTtl]
  await rememberCache($)
  if (await read($, isColdHidden)) await update($, isColdHidden, () => false)
  await showCache($)
}

/**
 * Compacts the conversation from the footer once the cache has gone cold: the next message would write the whole
 * context to the cache again, so a summary makes it small first. The countdown hides until the next response.
 */
async function compactCold($: EngineInterface, note = '') {
  if (await read($, isCompacting)) return
  await update($, compactAsk, () => false)
  await update($, isCompacting, () => true)
  await setHandoffCard($, 'compacting', false)
  let compacted = false
  try {
    // The app's own /compact, run as if typed: nothing lands in the prompt box, nothing to send. It waits for the
    // session to be idle, where a direct $.session.compact() is refused whenever the app counts a turn as running.
    // A note goes after /compact as the app's own instructions for the summary.
    await $.command.run({ command: 'compact', args: note.trim() })
    cacheExpires = 0
    await rememberCache($)
    await update($, cacheLeft, () => null)
    compacted = true
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    void proof($, `compact failed: ${why}`)
    $.ui.toast(`effortless: compact failed: ${why.slice(0, 140)}`)
  } finally {
    await update($, isCompacting, () => false)
    // Complete, or gone when it failed (the toast says why).
    if (compacted) {
      await setHandoffCard($, 'compacted', false)
      $.clock.after(COMPACT_CARD_MS + 100, () => $.ui.invalidate('ui.render'))
    } else await update($, handoffCard, card => (card?.kind === 'compacting' ? null : card))
  }
}

// The handoff's text once its turn has ended, waiting for the chat to go idle so it can be cleared and resent.
let handoffText: string | undefined
let handoffDriving = false

/** Starts a handoff: asks for it (built-in prompt or the person's own skill); the rest follows when it is written. */
// A handoff asked for and not begun: begun from the session's timer, where a prompt may be sent (a command or a press
// may hold the turn, and the app refuses a prompt sent from there).
let handoffQueued = false
// Quick: a fork with the built-in prompt, seconds. Full: the person's own skill as a turn, which may check and save.
let handoffFull = false
// What follows this handoff once it is written (HandoffAfter).
let handoffThen: HandoffAfter = 'continue'
// What the next session is for, as the person typed it (optional): shapes the handoff and opens the new chat.
let handoffFocus = ''
// The bar's focus field as typed, until Go.
let handoffFocusDraft = ''
// The effort the full handoff's turn runs at: set while that turn runs, past the pick, the judge (which never sees a
// prompt the mod sends) and Auto. The pick itself is left alone, so the next chat goes on at it.
const HANDOFF_FULL_EFFORT: Effort = 'medium'
let handoffEffort: Effort | null = null

async function startHandoff($: EngineInterface, full = false, after: HandoffAfter = config.handoffAfter, focus = '') {
  if ((await read($, handoffStage)) !== null) return
  await update($, handoffStage, () => 'writing')
  handoffFull = full
  handoffThen = after
  handoffFocus = focus.trim()
  handoffQueued = true
  await setHandoffCard($, 'writing', handoffFull)
}

/** The choice the handoff bar opens on: the one made last, else quick and the configured after. */
async function lastHandoffChoice($: EngineInterface): Promise<HandoffChoice> {
  const kept = (await $.store.get('handoffChoice').catch(() => null)) as Partial<HandoffChoice> | null
  const kind = kept?.kind === 'full' ? 'full' : 'quick'
  const after = (['continue', 'confirm', 'copy'] as const).find(a => a === kept?.after) ?? config.handoffAfter
  return { kind, after }
}

/** Opens the handoff bar above the prompt: the footer's ⇥ and the swamp band's Handoff. */
async function openHandoffBar($: EngineInterface) {
  if ((await read($, handoffStage)) !== null) return
  const choice = await lastHandoffChoice($)
  handoffFocusDraft = ''
  await update($, handoffPick, () => choice)
  $.ui.invalidate('ui.render')
}
/** The compact bar's Compact: a white pill like the app's primary buttons, GO_CELLS wide. */
// The narrowest bar (in cells) that still has room for a Compact button beside Auto and Handoff.
const COMPACT_BUTTON_MIN_COLUMNS = 80
/** Compact pressed: on desktop a bar asks for an optional note first; the terminal compacts at once. */
async function openCompact($: EngineInterface, e: { surface: string }) {
  if (e.surface === 'terminal') return compactCold($)
  compactNote = ''
  compactOpenedAt = await $.clock.now()
  await update($, compactAsk, () => true)
}
async function closeHandoffBar($: EngineInterface) {
  await update($, handoffPick, () => null)
  $.ui.invalidate('ui.render')
}

/** Go in the handoff bar: keeps the choice for next time and starts the handoff. */
async function goHandoff($: EngineInterface, choice: HandoffChoice) {
  await $.store.set('handoffChoice', choice).catch(() => undefined)
  await closeHandoffBar($)
  await startHandoff($, choice.kind === 'full', choice.after, handoffFocusDraft)
  handoffFocusDraft = ''
}

/** Writes the handoff: quick by a fork with the built-in prompt, full by the person's own skill as a turn. Runs from the timer. */
async function writeHandoff($: EngineInterface) {
  if (!handoffQueued) return
  handoffQueued = false
  try {
    if (handoffFull) {
      // The person's skill, or the built-in full prompt as a turn: either way its reply is the handoff. Its turn runs
      // at medium (see handoffEffort), until it ends.
      handoffEffort = HANDOFF_FULL_EFFORT
      if (config.handoffSkill) await $.command.run({ command: config.handoffSkill, args: handoffFocus })
      else await $.prompt.submit({ text: withFocus(HANDOFF_FULL_PROMPT, handoffFocus) })
      return
    }
    // A cold cache: a fork would reread the whole chat at full price and write it to the cache again (one handoff took
    // 8% of a person's 5-hour limit). Haiku writes it from the transcript instead, at a fraction of the price.
    const now = await $.clock.now().catch(() => Date.now())
    if ((await read($, cacheLeft)) === 0 || (cacheExpires > 0 && now >= cacheExpires)) {
      const messages = await $.session.messages().catch(() => [])
      const got = messages.length ? await haikuHandoff($, messages, handoffFocus).catch(() => null) : null
      await $.store.set('lastFork', { at: Date.now(), outcome: got ? 'cold cache: written by Haiku' : 'cold cache: Haiku failed, forked' }).catch(() => undefined)
      if (got) {
        handoffText = got
        return
      }
    }
    // The built-in handoff is written by a fork: the same model over this chat as it stands, its start read from the
    // prompt cache, no tools and no turn in the chat. Much quicker than a turn that may go exploring first.
    const startedAt = Date.now()
    const forked = await $.model.fork({ prompt: withFocus(HANDOFF_PROMPT, handoffFocus) }).catch((error: unknown) => error)
    const outcome = forkOutcome(forked, Date.now() - startedAt)
    // Kept in the store: before a chat's first message the mod's session may start afresh, and its variables with it.
    await $.store.set('lastFork', { at: Date.now(), outcome }).catch(() => undefined)
    const answered = forked as ModelForkResult
    if (answered?.isAnswered && answered.text.trim()) {
      handoffText = answered.text
      return
    }
    // Nothing to fork (no reply yet) or the fork failed: write it as a turn, as before, and say why.
    if (!outcome.startsWith('nothing-to-fork')) $.ui.toast(`effortless: the fork wrote no handoff (${outcome}); writing it as a turn`)
    await $.prompt.submit({ text: withFocus(HANDOFF_PROMPT, handoffFocus) })
  } catch (error) {
    handoffEffort = null
    await update($, handoffStage, () => null)
    $.ui.toast(`effortless: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`)
  }
}

/** Clears the chat and sends the written handoff into it. Runs from the session's timer, when nothing waits on it. */
export async function finishHandoff($: EngineInterface) {
  await writeHandoff($)
  if (handoffText === undefined || handoffDriving) return
  handoffDriving = true
  const text = handoffText
  handoffText = undefined
  try {
    if (handoffThen === 'copy') {
      // The chat stays: the handoff goes to the clipboard, ready to paste into another chat. Should the clipboard
      // refuse, it goes in the prompt box instead, to cut from there.
      const message = handoffMessage(text, 'continue', handoffFull ? config.handoffSkill : undefined, handoffFocus)
      const copied = await $.ui.copy({ text: message }).catch(() => ({ isCopied: false as const }))
      // Under the reply already there, so the next reply takes it away.
      await setHandoffCard($, 'copied', handoffFull, true)
      if (copied.isCopied) $.ui.toast('effortless: handoff copied. Paste it into a new chat.')
      else {
        await $.prompt.fill({ text: message, mode: 'replace' })
        $.ui.toast('effortless: the clipboard refused, so the handoff is in the prompt box')
      }
      return
    }
    await update($, handoffStage, () => 'clearing')
    await $.command.run({ command: 'clear', args: '' })
    // Under the first reply of the cleared chat, gone with the one after it.
    await setHandoffCard($, 'done', handoffFull)
    await $.prompt.submit({ text: handoffMessage(text, handoffThen, handoffFull ? config.handoffSkill : undefined, handoffFocus) })
  } catch (error) {
    await update($, handoffCard, () => null)
    $.ui.toast(`effortless: handoff failed: ${(error instanceof Error ? error.message : String(error)).slice(0, 140)}`)
  } finally {
    handoffDriving = false
    await update($, handoffStage, () => null)
  }
}

/** The user and plugin skills, for the handoff picker in the settings and the setup guide. */
async function loadInstalledSkills($: EngineInterface) {
  // Read here, once, not while drawing: a slow or refused lookup must not cost the panel.
  const installed = await $.command.list().catch(() => [])
  // At most 25, handoff-like ones first: a picker with hundreds of options is more than the slot takes.
  const names = [...new Set(installed.filter(c => c.source === 'user' || c.source === 'plugin').map(c => c.name))]
    .filter(name => !name.startsWith('effortless'))
    .sort((a, b) => Number(!/handoff/i.test(a)) - Number(!/handoff/i.test(b)) || a.localeCompare(b))
    .slice(0, 25)
  await update($, installedSkills, () => names)
}

/** Opens the effortless settings panel above the prompt: the app does not let a plugin open its /plugin dialog. */
/** Opens the panel a load before this one was asked to open (see openPluginSettings). From a timer the draw sets. */
async function openSettingsPanel($: EngineInterface) {
  await update($, settingsOpen, () => true)
  $.ui.invalidate('ui.render')
}

async function openPluginSettings($: EngineInterface) {
  await loadInstalledSkills($)
  await update($, settingsOpen, () => true)
  // Before a chat's first message the app may start the mod's session afresh for each command, and the state with
  // it: the request also goes to the store, which outlives that, and the next drawing picks it up.
  // The store is shared by every chat, so the request names this one: another chat must not open its panel too.
  await $.store.set('openSettingsAt', { at: Date.now(), session: await $.session.id().catch(() => '') })
  $.ui.invalidate('ui.render')
}

/** The settings rows the panel changes, by field: saved as the plugin's own setting and used at once. */
// Small purple marks beside the settings rows' titles: text glyphs, which draw wherever text does (an Svg there did not).
const ICON_EFFORT = '◔'
const ICON_JUDGE = '⚖︎'
const ICON_HANDOFF = '⇥'
const ICON_SHOW = '◉'
const SETTING_FIELDS = {
  judge: 'judge',
  bias: 'effortBias',
  floor: 'effortFloor',
  ceiling: 'effortCeiling',
  handoffAfter: 'handoffAfter',
  handoffSkill: 'handoffSkill',
  hide: 'hide',
  swampAt: 'swampAt',
  layout: 'layout',
  compactWith: 'compactWith',
  handoffButton: 'handoffButton',
  helpers: 'helpers',
  theme: 'theme',
  appearance: 'appearance',
  decisionModels: 'decisionModels',
  judgeTimeoutMs: 'judgeTimeoutMs',
  judgeBudgetMs: 'judgeBudgetMs',
} as const

async function saveSetting($: EngineInterface, field: keyof typeof SETTING_FIELDS, value: string) {
  const { deny } = await $.config
    .set({ key: `effortless.${SETTING_FIELDS[field]}`, value })
    .catch((error: unknown) => ({ deny: error instanceof Error ? error.message : String(error) }))
  // Some Claude Code builds have no /config row for a plugin's settings and refuse the write: the choice is kept in
  // the mod's own store then, and read back at the next session start. A write that lands clears that copy.
  const kept = ((await $.store.get('savedSettings').catch(() => null)) ?? {}) as Record<string, string>
  const { [SETTING_FIELDS[field]]: _old, ...others } = kept
  const stored = await $.store
    .set('savedSettings', deny ? { ...kept, [SETTING_FIELDS[field]]: value } : others)
    .then(() => true)
    .catch(() => false)
  if (deny && !stored) $.ui.toast(`effortless: could not save ${field}: ${String(deny).slice(0, 120)}`)
  const raw: Record<string, unknown> = {
    judge: config.judge,
    effortBias: String(config.bias),
    effortFloor: config.floor,
    effortCeiling: config.ceiling,
    handoffAfter: config.handoffAfter,
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(','),
    swampAt: String(config.swampAt),
    layout: config.layout,
    compactWith: config.compactWith,
    handoffButton: config.handoffButton,
    helpers: config.helpers,
    theme: config.theme,
    appearance: config.appearance,
    decisionModels: chainIds(config.decisionModels),
    judgeTimeoutMs: String(config.judgeTimeoutMs),
    judgeBudgetMs: String(config.judgeBudgetMs),
    [SETTING_FIELDS[field]]: value,
  }
  // The keys are the app's secrets: never in raw, kept as they were.
  setConfig({ ...readConfig(raw), typesafeKey: config.typesafeKey, openrouterKey: config.openrouterKey })
  await resettle($)
  applyTheme()
  $.ui.invalidate('ui.render')
}

/** How long the "Settings saved" card stays above the prompt. */
const SAVED_CARD_MS = 2500
/** The card after Save: the bar's own colours, one line, nothing moving. */
function savedCardTree($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box key="saved" flexDirection="row" alignItems="center" gap={1} paddingX={1} backgroundColor={DASH_BG} borderStyle="round" borderColor={DASH_EDGE}>
      <Text color={ACCENT}>✓</Text>
      <Text bold>Settings saved</Text>
    </Box>
  )
}

/** Saves every change in the panel's draft, then closes the panel. Nothing changed applies before this. */
async function saveDraft($: EngineInterface) {
  const draft = await read($, settingsDraft)
  const { key, openrouterKey, modelOther: _typing, ...rest } = draft
  // The keys go to their files first; the settings then go through the store queue, since each one reloads the plugin.
  if (key?.trim()) await saveTypesafeKey($, key)
  if (openrouterKey?.trim()) await saveOpenRouterKey($, openrouterKey)
  const changes: Record<string, string> = {}
  for (const field of Object.keys(SETTING_FIELDS) as (keyof typeof SETTING_FIELDS)[]) {
    const value = rest[field]
    if (value !== undefined) changes[field] = value
  }
  // Models added while Haiku judges alone would never be asked: adding them is asking for them.
  if (changes.decisionModels && parseDecisionModels(changes.decisionModels).length && (changes.judge ?? config.judge) === 'haiku') changes.judge = 'auto'
  await update($, settingsDraft, () => ({}))
  await update($, settingsOpen, () => false)
  // Said by a card above the prompt, not a toast. Kept in the store: each setting written reloads the plugin.
  await $.store.set('settingsSavedAt', await $.clock.now().catch(() => Date.now()))
  $.ui.invalidate('ui.render')
  await $.store.set('setupSave', changes)
  await drainSetupSave($)
}

/**
 * Fork: an OpenRouter key pasted in the panel or the guide goes to ~/.config/openrouter/effortless.env, readable by its owner
 * only. From then on that file wins over an older key in the settings. Says whether it was saved.
 */
async function saveOpenRouterKey($: EngineInterface, key: string): Promise<boolean> {
  const clean = key.trim()
  if (!clean) return false
  const home = (await envUserProfile($)) ?? (await envHome($))
  if (!home) {
    $.ui.toast('effortless: no home folder found to save the key in.')
    return false
  }
  const path = `${home}/${OPENROUTER_FILE}`
  const before = await $.fs.read(path).catch(() => '')
  try {
    await $.fs.write(path, withEnvLine(typeof before === 'string' ? before : '', 'OPENROUTER_API_KEY', clean))
  } catch (error) {
    $.ui.toast(`effortless: could not save the key: ${(error instanceof Error ? error.message : String(error)).slice(0, 120)}`)
    return false
  }
  // No chmod on Windows: there the file keeps the folder's own access rules.
  await $.process.run(['chmod', '600', path], { timeoutMs: 5000 }).catch(() => null)
  await $.store.set('orKeyFromFile', true)
  orKeyFromFile = true
  askOpenRouterFile = undefined
  await update($, judgeDown, () => null)
  warned.clear()
  $.ui.toast('effortless: OpenRouter key saved.')
  $.ui.invalidate('ui.render')
  return true
}

/**
 * A key pasted in the panel goes to ~/.config/jev/.env: a plugin cannot write the app's secret settings. From then on
 * that file wins over an older key in the settings.
 */
async function saveTypesafeKey($: EngineInterface, key: string): Promise<boolean> {
  const clean = typedTypesafeKey(key)?.trim()
  if (!clean) return false
  const home = (await envUserProfile($)) ?? (await envHome($))
  if (!home) {
    $.ui.toast('effortless: no home folder found to save the key in.')
    return false
  }
  const path = `${home}/.config/jev/.env`
  const before = await $.fs.read(path).catch(() => '')
  try {
    await $.fs.write(path, withTypesafeKey(typeof before === 'string' ? before : '', clean))
  } catch (error) {
    $.ui.toast(`effortless: could not save the key: ${(error instanceof Error ? error.message : String(error)).slice(0, 120)}`)
    return false
  }
  await $.store.set('keyFromFile', true)
  keyFromFile = true
  askTypesafeFile = undefined
  await update($, judgeDown, () => null)
  warned.clear()
  $.ui.toast('effortless: TypeSafe key saved. Decision models use it from the next message.')
  $.ui.invalidate('ui.render')
  return true
}

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

/** Shows a step of the guide; the handoff step needs the installed skills to pick from. */
async function goSetup($: EngineInterface, step: SetupStep | null) {
  if (step === 'handoff') await loadInstalledSkills($)
  await update($, setupStep, () => step)
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

/** Saves what the guide changed, only the fields that differ, then empties its draft. */
async function flushSetup($: EngineInterface) {
  const draft = await read($, setupDraft)
  await update($, setupDraft, () => ({}))
  const saved: Record<string, string> = {
    judge: config.judge,
    bias: String(config.bias),
    handoffSkill: config.handoffSkill,
    hide: config.hide.join(','),
    appearance: config.appearance,
    decisionModels: chainIds(config.decisionModels),
  }
  const changes: Record<string, string> = {}
  for (const field of ['hide', 'judge', 'bias', 'handoffSkill', 'appearance', 'decisionModels'] as const) {
    const value = draft[field]
    if (value !== undefined && value.trim() !== saved[field]) changes[field] = value.trim()
  }
  await $.store.set('setupSave', changes)
  await drainSetupSave($)
}

let drainingSetup = false

/**
 * Saves the setup's changes one at a time from the store. Each saved setting reloads the plugin, which cuts off a loop
 * here, so a field leaves the store before it is saved and the reloaded plugin carries on with the rest.
 */
async function drainSetupSave($: EngineInterface) {
  if (drainingSetup) return
  drainingSetup = true
  try {
    for (;;) {
      const queue = ((await $.store.get('setupSave').catch(() => null)) ?? {}) as Record<string, string>
      const [field] = Object.keys(queue)
      if (!field) return
      const { [field]: value, ...rest } = queue
      await $.store.set('setupSave', Object.keys(rest).length ? rest : null)
      if (field in SETTING_FIELDS) await saveSetting($, field as keyof typeof SETTING_FIELDS, value)
    }
  } finally {
    drainingSetup = false
  }
}

/** The judge is settled (picked or skipped): the guide does not open by itself again, and the footer shows ⚙. */
async function markSetupDone($: EngineInterface) {
  await Promise.all([update($, setupPending, () => false), $.store.set('setupDone', true)])
}

/** Closes the guide at its last step, saving what was picked. */
async function finishSetup($: EngineInterface) {
  await markSetupDone($)
  await goSetup($, null)
  await flushSetup($)
}

/** The ✕: closes the guide; what was picked so far is kept. */
async function closeSetup($: EngineInterface) {
  await goSetup($, null)
  await flushSetup($)
}

/** The decision model a TypeSafe key is used by: TypeSafe's Jev. */
const TYPESAFE_ROUTE = 'typesafe/jev-latest'
/** The draft's decision models (or the saved ones) with the TypeSafe route added. */
const withTypesafeRoute = (raw?: string) => withRoute(raw ?? chainIds(config.decisionModels), TYPESAFE_ROUTE)

/** The person picked a judge in the guide: Haiku alone, or a decision model (its key or the next step). Saved at the end. */
async function pickJudge($: EngineInterface, choice: 'haiku' | 'decision') {
  // Auto either way: with no decision model listed, Auto is Haiku alone.
  await update($, setupDraft, d => ({ ...d, judge: 'auto' }))
  await markSetupDone($)
  if (choice === 'haiku') {
    $.ui.toast('effortless: Haiku judges, no key needed. Add a decision model later for faster answers.')
    return goSetup($, 'lean')
  }
  if (await typesafeKey($)) {
    await update($, setupDraft, d => ({ ...d, decisionModels: withTypesafeRoute(d.decisionModels) }))
    $.ui.toast(`effortless: TypeSafe key found. ${TYPESAFE_ROUTE} is a decision model now.`)
    return goSetup($, 'lean')
  }
  await goSetup($, choice)
}

/** You picked an effort (terminal rows): Auto for effort goes off and the requests follow; Enter on /effort moves the app. */
async function pickEffort($: EngineInterface, level: Effort) {
  const t0 = Date.now()
  handChanges++
  const inUse = (await read($, model)) ?? (await sessionModel($))
  const t1 = Date.now()
  // Together, so the app redraws once for the click and not once per write.
  await Promise.all([
    update($, isAuto, () => false),
    $.store.set('isAuto', false),
    choose($, { model: inUse, effort: level, why: 'your pick', by: 'manual' }),
  ])
  const t2 = Date.now()
  // The app's own /effort, run as if the person typed it, so the app's effort follows the pick. Where the run is refused,
  // the command goes into the prompt box for the person to send, as before.
  const ran = await $.command.run({ command: 'effort', args: level }).then(() => true, () => false)
  if (ran) {
    // The app now runs at the pick: its effort is the one effortless has seen, so the next request does not read it as
    // the person's own choice (turn.step) and overwrite the pick.
    engineEffort = level
    await update($, appEffort, () => level)
  } else await typeCommand($, `/effort ${level}`)
  const t3 = Date.now()
  void proof($, `click ${level}: ${t3 - t0} ms (read ${t1 - t0}, state ${t2 - t1}, ${ran ? 'command run' : 'command typed'} ${t3 - t2})`)
}

async function toggleAutoEffort($: EngineInterface) {
  handChanges++
  const turnOn = !(await read($, isAuto))
  await update($, isAuto, () => turnOn)
  await $.store.set('isAuto', turnOn)
}

async function choose($: EngineInterface, next: Pick | null) {
  pickCarried = false
  const before = await read($, pick)
  await Promise.all([update($, pick, () => next), $.store.set('pick', next)])
  // A change Auto made is shown as "Low → High" for a moment, so the switch is seen.
  if (next && next.by !== 'manual' && before && before.effort !== next.effort) {
    const change = { from: before.effort, to: next.effort }
    await update($, switched, () => change)
    $.clock.after(SWITCHED_MS, () => void update($, switched, () => null))
  }
}

/** Everything a redraw needs, read together: the reads go out at once instead of one after the other. */
// The context figures from the last usage check, for the cache tooltip.
let lastContext: { tokens: number; window: number; percent: number } | null = null

async function snap($: EngineInterface) {
  const [auto, current, judging, shownByApp, modelNow, switchedNow, pausedNow, cacheNow, compacting] = await Promise.all([
    read($, isAuto),
    read($, pick),
    read($, isJudging),
    read($, appEffort),
    read($, model),
    read($, switched),
    read($, paused),
    read($, cacheLeft),
    read($, isCompacting),
  ])
  return { auto, current, judging, shownByApp, modelNow, switchedNow, pausedNow, cacheNow, compacting }
}
type Snap = Awaited<ReturnType<typeof snap>>

/** The hover cards' text: what Auto did and why, and what the cache countdown means with the context it guards. */
function hoverTips(v: Snap): { effort: string; cache: string } {
  const effortTip = !v.auto
    ? 'Auto is off: the effort stays as you set it. The power button turns Auto on.'
    : v.pausedNow
      ? 'Auto waits on this model: an effort change would rewrite its prompt cache.'
      : !effortOf(v)
        ? 'This model runs without an effort level, so Auto has nothing to set.'
      : [
          v.current ? `Auto picked ${EFFORT_LABELS[v.current.effort]}${v.current.by !== 'manual' ? ` (${v.current.judgeName ?? v.current.by})` : ''}` : 'Auto picks the effort for each message',
          v.current?.why ? `Why: ${v.current.why}` : '',
          `Lean: ${['much cheaper', 'cheaper', 'as the judge says', 'smarter', 'much smarter'][config.bias + 2]} · range ${config.floor} to ${config.ceiling}`,
        ]
          .filter(Boolean)
          .join(' · ')
  const ctx = lastContext && lastContext.window ? ` · Context ${lastContext.percent}% · ${kTokens(lastContext.tokens)}/${kTokens(lastContext.window)}` : ''
  const cacheTip =
    v.cacheNow === 0
      ? `Prompt cache cold: the next message reads the whole chat again at full price. Compact first to save.${ctx}`
      : `Prompt cache warm for ${cacheLabel(v.cacheNow ?? 0)} more: the next message reads the chat from cache, cheap and fast.${ctx}`
  return { effort: effortTip, cache: cacheTip }
}

/** The effort to show: yours or the judge's, else what the app itself runs with. */
function effortOf(v: Snap): Effort | undefined {
  if (v.current) return v.current.effort
  return EFFORTS.includes(v.shownByApp as Effort) ? (v.shownByApp as Effort) : undefined
}

/** How the level in force was picked, as the bands word it: by the person, or kept from the last prompt (a kept level
 * only while Auto is on, as the dashboard's word has it). */
function pickedHow(p: Pick | null, auto: boolean): 'manual' | 'kept' | undefined {
  return p?.by === 'manual' ? 'manual' : p?.why === UNSURE && auto ? 'kept' : undefined
}

// For /effortless debug: how often the app asked for the band, when, and the last error drawing it.
// /effortless probe N: 1 a bare box, 2 the panel's frame and header only, 3 the panel without pickers or fields.
let probeLevel = 0
let renderCalls = 0
let lastRenderProps = ''
let lastRenderBranch = ''
let lastRenderAt = 0
// When this module loaded, for the render log's "first draw" line.
let loadedAt = Date.now()
let firstDrawLogged = false
let drawsTimed = 0
let lastRenderError = ''
let sessionStarted = 0
// When the app's SessionStart came and what it said, for /effortless debug: a cold band that shows late is either a
// late signal or a redraw the app did not take.
let classicStart: { at: number; said: string } | null = null
// /effortless cold shows the band whatever the chat's size, until the next response (a test of the band itself).
let coldForced = false
let handoffTimer: { cancel: () => void } | undefined
const HANDOFF_POLL_MS = 1000
// When Haiku last wrote a compaction (for /effortless debug).
let lastHaikuCompact = 0

// The moving art's timer: one at a time, blitting the next frame to the band that drew it. A blit the surface refuses
// (the band went away, another drew instead) ends it, so nothing has to stop it from outside.
let artTimer: { cancel(): void } | null = null
let artShown: { requestId: string; kind: ArtKind } | null = null
let artFrameCount = 0

/** A band's art on the terminal: a Raster on the right, moving for alert kinds; null where it has no room. */
function bandArt($: EngineInterface, e: RenderInput<'AbovePrompt'>, kind: ArtKind) {
  const els = themedEls($.ui.resolve(e))
  const columns = typeof e.props.bodyColumns === 'number' ? e.props.bodyColumns : 0
  if (e.surface !== 'terminal' || !('Raster' in els) || columns < ART_MIN_WIDTH) return null
  // The still sparkles (the resting dashboard, the guide) are 16 by 4 pixels: in a terminal they read as noise, not
  // art. Only the art that says something stays: the alerts, compacting and the done tick.
  if (kind === 'calm' || kind === 'brand') return null
  const { Box, Raster } = els
  artShown = { requestId: e.requestId, kind }
  if (MOVING.has(kind) && !artTimer) {
    artTimer = $.clock.every(ART_FRAME_MS, () => {
      const shown = artShown
      if (!shown || !MOVING.has(shown.kind)) {
        artTimer?.cancel()
        artTimer = null
        return
      }
      artFrameCount++
      void $.ui
        .blit({ requestId: shown.requestId, key: 'art', cells: artFrame(shown.kind, artFrameCount) })
        .then(r => {
          if ('deny' in r && r.deny) {
            artTimer?.cancel()
            artTimer = null
          }
        })
        .catch(() => undefined)
    })
  }
  return (
    <Box key="art-box" flexShrink={0}>
      <Raster key="art" columns={ART_COLUMNS} rows={ART_ROWS} cells={artFrame(kind, artFrameCount)} />
    </Box>
  )
}

/** A bar on the terminal (setup, handoff): the title and words on the left with the brand's still art beside them,
 * the controls on a row of their own that wraps, so nothing is cut at 80 columns. */
function terminalPanel($: EngineInterface, e: RenderInput<'AbovePrompt'>, key: string, title: string, words: unknown, controls: unknown[]) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  return (
    <Box key={key} flexDirection="column" paddingX={1} backgroundColor={BRAND_BG} borderStyle="round" borderColor={BRAND_EDGE}>
      <Box flexDirection="row" gap={1} alignItems="center">
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={ACCENT} bold wrap="truncate">{title}</Text>
          {typeof words === 'string' ? <Text key={`${key}-what`} dimColor wrap="truncate">{words}</Text> : words}
        </Box>
        {bandArt($, e, 'brand')}
      </Box>
      <Box key={`${key}-actions`} flexDirection="row" flexWrap="wrap" justifyContent="flex-end" columnGap={1} alignItems="center">
        {controls}
      </Box>
    </Box>
  )
}

type TerminalBand = { key: string; kind: ArtKind; color: string; bg: string; edge: string; title: string; detail: string; buttons: unknown[]; autoInBar?: boolean; word?: { text: string; color: string; rest: string } }

/** An alert band on the terminal: title and buttons, the detail on a line of its own, art on the right, and the effort
 * row under it, so effort stays in sight while a band shows. */
async function terminalBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, b: TerminalBand) {
  const { Box, Text } = themedEls($.ui.resolve(e))
  const rows = await effortRows($, e, { auto: !b.autoInBar })
  return (
    <Box key={`${b.key}-col`} flexDirection="column">
      <Box key={b.key} flexDirection="row" gap={1} alignItems="center" paddingX={1} backgroundColor={b.bg} borderStyle="round" borderColor={b.edge}>
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Box flexShrink={0}>
              {b.word ? (
                <Box flexDirection="row">
                  <Text color={b.color} bold>{'✦ '}</Text>
                  <Text key={`${b.key}-word`} color={b.word.color} bold>{b.word.text}</Text>
                  <Text color={b.color} bold>{b.word.rest}</Text>
                </Box>
              ) : (
                <Text color={b.color} bold>{`✦ ${b.title}`}</Text>
              )}
            </Box>
            <Box flexGrow={1} />
            {b.buttons}
          </Box>
          <Text dimColor wrap="truncate">{b.detail}</Text>
        </Box>
        {bandArt($, e, b.kind)}
      </Box>
      {rows}
    </Box>
  )
}
// The word the dashboard last showed and when it last changed, so a new effort glows and fades. Not while the judge
// decides: the word it lands on is compared with the one before.
let flashWord: string | null = null
let flashAt: number | null = null

async function effortFlash($: EngineInterface, what: string, judging: boolean, entering = false, quiet = false): Promise<string> {
  const now = await $.clock.now()
  // The dashboard coming back (after Handoff, settings or an alert) takes the word as it is: a change made while it was
  // away is not a switch to point at.
  if (entering && !judging) {
    flashWord = what
    flashAt = null
  }
  if (!judging) {
    // Auto switched off or on, a level picked by hand and a kept level are not a new verdict: the word changes without
    // the flash (quiet).
    if (flashWord !== null && flashWord !== what) flashAt = quiet || what === 'Off' || flashWord === 'Off' ? null : now
    flashWord = what
  }
  const since = flashAt === null ? null : now - flashAt
  if (since === 0) {
    // One redraw at each step of the fade and one at its end, not a tick: see FLASH_STEPS.
    for (const at of [...FLASH_STEPS.map(([t]) => t), FLASH_MS]) $.clock.after(at + 20, () => $.ui.invalidate('ui.render'))
  }
  return flashColor(since)
}


// Uninstall's first press arms it; a second within UNINSTALL_ARM_MS uninstalls. Then the plugins reload and the mod is
// gone from this chat; its settings stay in settings.json, so a reinstall picks them up.
const UNINSTALL_ARM_MS = 4000
let uninstallArmedAt = 0
let uninstalling = false
const UNINSTALL_RED = '#ff6b6b'
/** The fork's repo: bug reports go here (the fork has no site of its own). */
const REPO_URL = 'https://github.com/capyBearista/effortless'
function uninstallButton($: EngineInterface, els: ReturnType<EngineInterface['ui']['resolve']>) {
  const { Box, Text, Button, Svg } = els
  const armed = Date.now() - uninstallArmedAt < UNINSTALL_ARM_MS
  const press = async () => {
    if (uninstalling) return
    if (!armed) {
      uninstallArmedAt = Date.now()
      $.ui.invalidate('ui.render')
      $.clock.after(UNINSTALL_ARM_MS + 50, () => $.ui.invalidate('ui.render'))
      return
    }
    uninstalling = true
    $.ui.invalidate('ui.render')
    const r = await runClaude($, ['plugin', 'uninstall', pluginId($)], { timeoutMs: 120_000 }).catch(error => ({ exitCode: 1, stdout: '', stderr: String(error) }))
    uninstalling = false
    if (r.exitCode !== 0) {
      const why = (r.stderr || r.stdout).trim().split('\n').pop() ?? ''
      $.ui.toast(`effortless: uninstall failed: ${noClaudeHint(why, await homeDir($)) ?? why}`)
      $.ui.invalidate('ui.render')
      return
    }
    $.ui.toast('effortless is uninstalled. Thanks for trying it.')
    const reloaded = await $.command.run({ command: 'reload-plugins', args: RELOAD_ARGS } as never).then(() => true, () => false)
    if (!reloaded) await typeCommand($, `/reload-plugins ${RELOAD_ARGS}`)
  }
  const label = uninstalling ? 'Uninstalling…' : armed ? 'Press again to uninstall' : 'Uninstall'
  if (!Svg) return <Button key="settings-uninstall" plain dimColor={!armed} label={label} onPress={press} />
  // A bin and the word, grey; red under the pointer, and red while armed (the red bin is laid over the grey one, since
  // a hover can only reveal). A blank button over both takes the press.
  const red = armed || uninstalling
  return (
    <Box key="settings-uninstall-box" position="relative" flexDirection="row" alignItems="center" flexShrink={0}>
      <Box position="relative" width={2} height={1} alignItems="center">
        <Box position="absolute" top={0} left={0}>
          <Svg source={binSvg(DASH_DIM)} alt="bin" width={14} height={14} />
        </Box>
        <Box position="absolute" top={0} left={0} display={red ? 'flex' : 'none'} hover={red ? undefined : { scope: 'uninstall', display: 'flex' }}>
          <Svg source={binSvg(UNINSTALL_RED)} alt="bin" width={14} height={14} />
        </Box>
      </Box>
      <Text color={red ? UNINSTALL_RED : DASH_DIM} hover={{ scope: 'uninstall', color: UNINSTALL_RED }}>{label}</Text>
      <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
        <Button key="settings-uninstall" plain hover={{ scope: 'uninstall', backgroundColor: '#00000000' }} label={' '.repeat(label.length + 3)} onPress={press} />
      </Box>
    </Box>
  )
}

/** The handoff or compact card: words, the moving art while it runs, green with a check once it has landed. `above` is
 * what sits over it (the reply it hangs under), or nothing for the band above the prompt. */
function handoffCardTree($: EngineInterface, e: RenderInput<'AssistantMessage'> | RenderInput<'AbovePrompt'>, fresh: HandoffCard, above: unknown, onDismiss?: () => unknown) {
  const { Box, Text, Svg, Button } = themedEls($.ui.resolve(e))
  const by = fresh.full ? 'Full' : 'Quick'
  const words = {
    writing: ['✦ Handing off…', `${by} handoff being written. ${fresh.full ? 'Your skill takes a little while.' : 'A few seconds.'}`],
    done: ['✦ Handoff complete', 'Carried on from the last chat. The old one is cleared.'],
    copied: ['✦ Handoff copied', 'Paste it into a new chat. This one stays.'],
    compacting: ['✦ Compacting…', 'The chat is being summed up. Takes a minute or so.'],
    compacted: ['✦ Compact complete', 'The chat is summed up; the next message reads far less.'],
  }[fresh.kind]
  // Compacting is a wait in the background, not a result: one quiet line over the band's calm art, not the loud glow.
  const quiet = fresh.kind === 'compacting'
  const card = (
    <Box key="reply-handoff" position="relative" flexDirection="row" alignItems="center" paddingX={1} overflow="hidden"
      backgroundColor={cardLanded(fresh.kind) ? DONE_BG : BRAND_BG} borderStyle="round" borderColor={cardLanded(fresh.kind) ? DONE_EDGE : BRAND_EDGE}>
      <Box key="reply-handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
        {quiet ? (
          <Svg source={DASH_SVG} alt="compacting" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : cardRunning(fresh.kind) ? (
          <Svg source={HANDOFF_SVG} alt="handing off" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        ) : (
          <Svg source={cardLanded(fresh.kind) ? DONE_SVG : BRAND_SVG} alt="effortless" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
        )}
      </Box>
      <Box key="reply-handoff-words" position="relative" flexDirection={quiet ? 'row' : 'column'} gap={quiet ? 1 : 0} flexShrink={1} minWidth={0}>
        {markTitle({ Box, Text, Svg }, 'reply-handoff-title', cardLanded(fresh.kind) ? DONE_ACCENT : ACCENT, words[0], cardLanded(fresh.kind) ? DONE_MARK_SVG : MARK_SVG)}
        <Text wrap="truncate">{words[1]}</Text>
      </Box>
      {onDismiss ? (
        <Box key="reply-handoff-close" position="relative" flexGrow={1} flexDirection="row" justifyContent="flex-end">
          <Box position="absolute" top={0} left={0} />
          {/* A box just the ✕'s size: in the wide one its hover lit up anywhere on the card's right half. */}
          <Box key="card-close-box" position="relative" flexShrink={0}>
            <Box position="absolute" top={0} left={0} />
            <Button key="card-close" plain role="dismiss" label="✕" hover={{ backgroundColor: CARD_CLOSE_HOVER }} onPress={onDismiss} />
          </Box>
        </Box>
      ) : null}
    </Box>
  )
  if (above === undefined) return card
  return (
    <Box key="reply" flexDirection="column" gap={1}>
      {above as never}
      {card}
    </Box>
  )
}

/** Where a bug is reported: a new issue on the fork, the version filled in. */
const REPORT_BUG_URL = `${REPO_URL}/issues/new`
/** This install's version, read from its plugin.json at session start: the bug report fills it in. */
let ownVersion = ''
async function installedVersion($: EngineInterface): Promise<string | undefined> {
  const text = await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).catch(() => '')
  try {
    const v = (JSON.parse(typeof text === 'string' ? text : '') as { version?: unknown }).version
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}
/** The session's timers. A reload starts the module over, maybe with no session start (the countdown froze on "Cold"),
 * so the band's first draw starts them too. A session start always starts them: a timer started inside a request may
 * end with it. */
let timersFrom: 'start' | 'draw' | null = null
function startTimers($: EngineInterface, from: 'start' | 'draw') {
  if (timersFrom === 'start' || (timersFrom === 'draw' && from === 'draw')) return
  timersFrom = from
  // The cache countdown's clock. A timer started inside a request ends with that request, so it lives here.
  $.clock.every(CACHE_TICK_MS, () => void showCache($).catch(() => undefined))
  $.clock.every(CACHE_TICK_MS, () => void checkSwamp($).catch(() => undefined))
  // Read the usage at once too, so the context ring is there from the start rather than a tick later.
  void checkSwamp($).then(() => $.ui.invalidate('ui.render')).catch(() => undefined)
  // A written handoff is cleared and resent from here: a hook the turn waits on may not run commands.
  handoffTimer?.cancel()
  handoffTimer = $.clock.every(HANDOFF_POLL_MS, () => {
    void agentWaits($).catch(() => undefined)
    if (redrawsOwed > 0) {
      // Drawn since the ask: the band is up to date, so a redraw would only restart its animations.
      if (lastRenderAt > redrawAskedAt + REDRAW_SETTLE_MS) redrawsOwed = 0
      else {
        redrawsOwed--
        $.ui.invalidate('ui.render')
      }
    }
    // Right after a start the app may not have the usage yet: ask each second until it has, so the ring shows.
    if (!lastContext || !lastContext.window) void checkSwamp($).then(() => lastContext?.window && $.ui.invalidate('ui.render')).catch(() => undefined)
    // The dashboard's countdown ticks inside its own image; the band is redrawn once a minute to start the next one.
    if (cacheExpires > 0 && !config.hide.includes('timer'))
      void $.clock.now().then(now => {
        const minute = Math.floor((cacheExpires - now) / 60_000)
        if (now < cacheExpires + HANDOFF_POLL_MS && minute !== clockMinute) {
          clockMinute = minute
          $.ui.invalidate('ui.render')
        }
      })
    void writeRenderLog($).catch(() => undefined)
    void finishHandoff($).catch(() => undefined)
  })
}

// /reload-plugins loads the module again without a session start, so the band's first draw runs afterLoad too.
let loadChecked = false
/** Once per load: this load's version, and the timers. */
async function afterLoad($: EngineInterface) {
  if (loadChecked) return
  loadChecked = true
  // A reload has no session start, so this load reads its own version here too.
  ownVersion = (await installedVersion($)) ?? ownVersion
  startTimers($, 'draw')
}
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
const homeDir = async ($: EngineInterface) => ((await envUserProfile($)) ?? (await envHome($))) || undefined
/** `claude <args>`, from the next place it may be when one will not start. */
async function runClaude($: EngineInterface, args: string[], opts: Parameters<EngineInterface['process']['run']>[1]) {
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
/** How long "Compact complete" stays above the prompt when nothing else clears it. */
const COMPACT_CARD_MS = 20_000
/** A settings part's body on desktop is as tall as the overview's row of cards, so the panel keeps its height going in
 * and out of a part. In lines (a Box height is a number of lines or a percentage) at the app's 19 px line: 56 px makes
 * the band 121.5 px tall in every part, as with the cards, measured on tools/render-band. */
const SETTINGS_BODY_H = 56 / 19
/** The card ✕'s hover: the app's ghost fill is lost on the green and violet cards, so a darker wash of the card itself. */
const CARD_CLOSE_HOVER = '#00000040'
/** A handoff's or compact's card for the band above the prompt: while it runs, and once landed until the next message
 * is sent, the ✕ is pressed or its time has passed (COMPACT_CARD_MS, HANDOFF_CARD_MS). */
async function compactCard($: EngineInterface, working = false) {
  const card = await read($, handoffCard)
  if (!card || cardRunning(card.kind)) return card
  const keep = card.kind === 'compacted' ? COMPACT_CARD_MS : HANDOFF_CARD_MS
  if (working || (card.kind === 'compacted' && card.seen) || (await $.clock.now()) - card.at >= keep) return null
  return card
}

/** The glow behind the white Handoff button. Check a change on tools/render-band before shipping: an earlier glow looked
 * tight in a preview but far bigger and blurrier in the app. */
const HANDOFF_GLOW = true
// Handoff is calm until Haiku says a fresh chat would suit now (handoffAdvice); then it is the white box with a glow.
// What the band last read from handoffAdvice, so the drawing helpers need no await.
let adviceNow: string | null = null
const HANDOFF_ADVICE_LEVEL = 50
// "Always" (the Handoff button setting) keeps the slot as Handoff, calm in a grey box, and loud only once advised.
const handoffLevel = () => (adviceNow ? HANDOFF_ADVICE_LEVEL : config.handoffButton === 'always' ? HANDOFF_BOX_AT : 0)
const handoffLoud = () => adviceNow !== null
const handoffSlot = () => handoffLoud() || config.handoffButton === 'always'
/** The handoff bar's Quick | Full switch: a dark track with both words in it and a light knob under the picked one,
 * as tall as Go (20 px, 5 px radius, measured on tools/render-band) so the row's controls line up,
 * KIND_CELLS wide each half (the words are app Text laid over it; an image would draw them in another font). */
const KIND_CELLS = 9
/** One cell of the desktop band in CSS px (`1ch` of its font, measured on tools/render-band). */
const CELL_PX = 7.9
const KIND_W = Math.round(KIND_CELLS * 2 * CELL_PX)
const KIND_H = 20
/** The track and the knob under `kind`; `slideMs` slides the knob over from the other half, for the redraw right
 * after a click only (every redraw replays an image's animation). */
export function kindSwitchSvg(kind: 'quick' | 'full', slideMs: number | null = null): string {
  const half = KIND_W / 2
  const at = (k: 'quick' | 'full') => (k === 'full' ? half + 0.5 : 2)
  const slide = slideMs !== null && slideMs < KIND_SLIDE_DELAY_MS + KIND_SLIDE_MS
  // It starts a beat after the click: the click redraws the whole bar, its large art included, and a slide in those
  // same frames stuttered. SMIL, not CSS: it moves the knob's own x, held at the old side until it begins.
  const from = at(kind === 'full' ? 'quick' : 'full')
  const begin = slideMs === null ? 0 : KIND_SLIDE_DELAY_MS - slideMs
  const move = slide
    ? `<animate attributeName="x" from="${from}" to="${at(kind)}" begin="${(begin / 1000).toFixed(3)}s" dur="${KIND_SLIDE_MS / 1000}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 .7 .2 1"/>`
    : ''
  // The track is the app's Select (white at 5%, a 1 px inset edge of white at 10%, 6 px corners), so the row reads as
  // one set; the knob sits 2 px inside it.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KIND_W}" height="${KIND_H}" viewBox="0 0 ${KIND_W} ${KIND_H}"><rect x=".5" y=".5" width="${KIND_W - 1}" height="${KIND_H - 1}" rx="5.5" fill="#ffffff" fill-opacity=".05" stroke="#ffffff" stroke-opacity=".1"/><rect x="${slide ? from : at(kind)}" y="2" width="${half - 2.5}" height="${KIND_H - 4}" rx="4" data-keep="1" fill="#ececf0">${move}</rect>${slide ? `<!--${kindFlipAt}-->` : ''}</svg>`
}
const KIND_SLIDE_MS = 300
const KIND_SLIDE_DELAY_MS = 70
// When the handoff bar's Quick | Full last changed, for the knob's slide. Stamped into the slide's image too: going
// back and forth drew the same image twice, and the app reused it without playing the slide again.
let kindFlipAt = 0
/** This install's id: effortless@capybearista for this fork. Read off the
 * cache path (…/plugins/cache/<marketplace>/effortless/<version>). */
const pluginId = ($: EngineInterface) => `effortless@${$.plugin.root.match(/cache[\\/]([^\\/]+)[\\/]/)?.[1] ?? 'effortless'}`
/** Redraws the band every JUDGE_STEP_MS from `from` ms over `span` ms, so each piece of the rise or fade is drawn in turn. */
function drawGlowSteps($: EngineInterface, from: number, span: number) {
  for (let at = Math.max(0, from); at <= from + span + JUDGE_STEP_MS; at += JUDGE_STEP_MS) $.clock.after(at + 5, () => $.ui.invalidate('ui.render'))
}
// The glow's clock is read as late as the draw allows, and set ahead by how long the rest of a draw takes (measured,
// smoothed): a fade placed where it was when the draw began showed up that much behind, a little brighter at every
// redraw, which read as lag and as a second glow.
let glowReadAt: number | null = null
let drawLead = 20
// When the judge started, and when it gave its verdict (null while it decides).
let judgeStartedAt = 0
let judgeEndedAt: number | null = 0
/** The verdict is in: the rim starts fading now, together with the effort word's flash, not after the effort and model
 * are applied (that came a beat later and read as a second glow). Redraws when the fade swaps in and once it is over. */
async function endJudgeGlow($: EngineInterface, why: string) {
  if (judgeEndedAt !== null) return
  judgeEndedAt = await $.clock.now().catch(() => Date.now())
  const fadeAt = Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS) - judgeEndedAt
  renderLog.push(`${new Date().toISOString()} ${loadedSession} glow: ${why} ${judgeEndedAt - judgeStartedAt} ms after start, fade in ${fadeAt} ms`)
  drawGlowSteps($, fadeAt, JUDGE_FADE_MS)
  $.ui.invalidate('ui.render')
}
// When the bar last saw Auto off or on, when Auto came on (for the edge glow), and when it last changed (for the slide).
let autoSeen: boolean | undefined
let autoOnAt = -Infinity
let autoFlipAt = 0
let helpersSeen: string | undefined
let helpersFlipAt = 0

/** The dashboard: what effortless is doing, and Auto, Handoff and settings. The slot above the prompt at rest. */
async function dashboardBand($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const els = themedEls($.ui.resolve(e))
  const { Box, Text, Button } = els
  const v = await snap($)
  adviceNow = (await read($, handoffAdvice)) ?? null
  await introShows($, 'dash')
  // The first draw since another band stood here.
  const entering = introFresh
  introFresh = false
  const nowMs = await $.clock.now()
  if (autoSeen !== undefined && autoSeen !== v.auto) {
    autoFlipAt = nowMs
    // No redraw to end the slide or the glow: both finish inside their images (the glow fades to nothing), and every
    // redraw rebuilds the buttons under a resting pointer, which flickers their hover.
    autoOnAt = nowMs
  }
  autoSeen = v.auto
  const effortNow = effortOf(v)
  const by = v.current?.by
  const reason = v.current
    ? `${by === 'manual' || by === 'named' ? 'You' : by === 'decision' ? (v.current.judgeName ?? 'Decision model') : 'Haiku'}: ${v.current.why}`
    : v.auto
      ? 'Auto picks the effort at the next prompt'
      : 'You pick the effort'
  // Desktop draws the cache after the context ring, grey, with a hover that explains both; the terminal says it inline.
  const drawn = e.surface !== 'terminal' && 'Svg' in els
  // A cold cache is the cold band's to say; the resting bar shows the countdown only while there is one.
  const cacheShown = config.hide.includes('timer') || (v.cacheNow !== null && v.cacheNow <= 0) ? null : v.cacheNow
  const how = pickedHow(v.current, v.auto)
  const manual = how === 'manual'
  const kept = how === 'kept'
  const { head, what, rest, detail } = dashboardLines({
    auto: v.auto,
    paused: Boolean(v.pausedNow),
    judging: Boolean(v.judging),
    effort: effortNow,
    manual,
    kept,
    cacheNow: drawn ? null : cacheShown,
    // Desktop draws the context as a ring and a figure (as the swamp band does); the terminal says it in words.
    contextPercent: e.surface === 'terminal' && lastContext && lastContext.window ? lastContext.percent : null,
    // A prompt on a cheaper model names it in the judge's line ("On Sonnet · Haiku: a small fix"), not beside the effort word.
    reason: adviceNow ? `Handoff would suit: ${adviceNow}` : config.hide.includes('reason') ? '' : reason,
    // The last reply's cost is left out of the bar: it was noise there. lastTurn still records it.
    last: null,
  })
  const toggleSettings = async () => {
    if (await read($, settingsOpen)) {
      await update($, settingsDraft, () => ({}))
      await update($, settingsOpen, () => false)
      $.ui.invalidate('ui.render')
    } else await openPluginSettings($)
  }
  // The desktop's effort word is text and cannot be pressed: the five levels beside it are buttons, the one in force
  // lit as in the terminal's effort row. Hidden while the judge decides, so a press cannot race its verdict.
  const levelButtons =
    drawn && !v.judging ? (
      <Box key="dash-levels" flexShrink={0} flexDirection="row" gap={1} alignItems="center">
        {EFFORTS.map(level =>
          level === effortNow ? (
            <Button key={`dash-e-${level}`} variant="primary" label={EFFORT_LABELS[level]} onPress={() => pickEffort($, level)} />
          ) : (
            <Button key={`dash-e-${level}`} plain dimColor label={EFFORT_LABELS[level]} onPress={() => pickEffort($, level)} />
          ),
        )}
      </Box>
    ) : null
  const buttons = [
    // Auto sits in the bar on both: in the terminal the effort row under the band drops its own (autoInBar), since
    // there it was cut off at the window's foot. The hotkey only in the terminal; the app draws it faint on grey.
    e.surface === 'terminal' ? (
      <Button key="dash-auto" hotkey="a" variant={v.auto ? 'primary' : undefined} label={v.auto ? 'Auto on' : 'Auto off'} onPress={() => toggleAutoEffort($)} />
    ) : (
      <Button key="dash-auto" variant="secondary" dimColor={!v.auto} label={v.auto ? 'Auto on' : 'Auto off'} onPress={() => toggleAutoEffort($)} />
    ),
    // Once the slot is Handoff (advised, or the setting says always), Compact stays beside it as quiet text, so both are
    // a press away. Desktop only, where there is room for it; the terminal compacts in one press from its own rows.
    ...(e.surface !== 'terminal' && 'Svg' in els && !config.hide.includes('handoff') && handoffSlot() && (typeof e.props.bodyColumns !== 'number' || e.props.bodyColumns >= COMPACT_BUTTON_MIN_COLUMNS)
      ? [<Button key="dash-compact" plain dimColor label="Compact" onPress={() => openCompact($, e)} />]
      : []),
    ...(config.hide.includes('handoff')
      ? []
      : [
          // One button in one place: Compact until Haiku says a fresh chat would suit, then Handoff, loud. Pressing it opens
          // the matching card, which can switch to the other. Desktop draws it: no box on a fresh chat, then a
          // step a percent of context to a white box at HANDOFF_FULL_AT (handoffLook), the label as Text over the box and
          // a blank button over both to take the click. The terminal keeps the plain buttons: grey, white from
          // HANDOFF_LOUD_AT.
          'Svg' in els && e.surface !== 'terminal' ? (
            <Box key="dash-handoff-wrap" flexShrink={0} flexDirection="row">
              {/* No glow while a reply runs: the band redraws then, and each redraw restarted the glow, so it flickered. */}
              {HANDOFF_GLOW && handoffLoud() && !e.props.isWorking ? (
                <Box key="dash-glow" position="absolute" top={0} bottom={0} left={-2} right={-2} alignItems="center" justifyContent="center">
                  <els.Svg source={handoffGlowSvg(handoffGlowStep(handoffLevel()), nowMs)} alt="handoff glow" width={GLOW_W} height={GLOW_H} />
                </Box>
              ) : null}
              {/* The H key, once Handoff is loud: on a button of its own, clipped away, since a blank button with a
                  hotkey draws its letter over the label. */}
              {handoffLoud() ? (
                <Box key="dash-handoff-key" width={0} height={1} overflow="hidden">
                  <Button key="dash-handoff-h" plain hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
                </Box>
              ) : null}
              {/* Its width is a spacer in the flow, not the image: the app can lay an image out at no width, and the
                  label (centred over it) then ran into Auto. */}
              <Box key="dash-handoff-box" flexShrink={0} flexDirection="row" alignItems="center">
                <Box width={9} height={1} flexShrink={0} />
                <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                  <els.Svg source={handoffPillSvg(handoffLevel())} alt="Handoff box" width={HANDOFF_PILL_W} height={HANDOFF_PILL_H} />
                </Box>
                {/* Its hover: a lighter pill shown over the box, not the app's ghost fill, which is sized to the blank
                    label and sat off the drawn box. */}
                <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center"
                  display="none" hover={{ scope: 'handoff', display: 'flex' }}>
                  <els.Svg source={handoffPillSvg(handoffLevel(), true)} alt="Handoff box" width={HANDOFF_PILL_W} height={HANDOFF_PILL_H} />
                </Box>
                <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                  <Text color={handoffLook(handoffLevel()).label} hover={{ scope: 'handoff', color: handoffLook(handoffLevel(), true).label }}>{handoffSlot() ? 'Handoff' : 'Compact'}</Text>
                </Box>
                <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                  <Button key="dash-handoff" plain label={' '.repeat(14)} hover={{ scope: 'handoff', backgroundColor: '#00000000' }} onPress={() => (handoffSlot() ? openHandoffBar($) : openCompact($, e))} />
                </Box>
              </Box>
            </Box>
          ) : handoffLoud() ? (
            <Button key="dash-handoff" variant="primary" hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />
          ) : (
            <Button key="dash-handoff" variant="secondary" label="Handoff" onPress={() => openHandoffBar($)} />
          ),
        ]),
    // The terminal says it in a word; the desktop draws an icon, with this button laid blank over it to take the click.
    // No-break spaces, not braille blanks: some fonts draw U+2800 as a dot.
    <Button key="dash-settings" plain label={'Svg' in els && e.surface !== 'terminal' ? '   ' : 'Settings'} onPress={toggleSettings} />,
  ].filter(Boolean)
  // The terminal flashes the effort word as the desktop does: violet on a change, fading back to white.
  if (e.surface === 'terminal')
    return terminalBand($, e, { key: 'dash', kind: 'calm', color: DASH_TEXT, bg: DASH_BG, edge: DASH_EDGE, title: head.replace(/^✦ /, ''), detail, buttons, autoInBar: true,
      word: { text: what, color: await effortFlash($, what, Boolean(v.judging), entering, manual || kept), rest } })
  const Svg = 'Svg' in els ? els.Svg : undefined
  const wordColor = await effortFlash($, what, Boolean(v.judging), entering, manual || kept)
  glowReadAt = Date.now()
  const glowNow = (await $.clock.now().catch(() => nowMs)) + drawLead
  const glowSource = Svg ? judgeGlowAt(judgeStartedAt, judgeEndedAt, glowNow) : null
  if (glowSource && judgeEndedAt !== null) renderLog.push(`${new Date().toISOString()} ${loadedSession} glow: fade drawn at +${Math.round(glowNow - Math.max(judgeEndedAt, judgeStartedAt + JUDGE_RISE_MS))} ms, lead ${Math.round(drawLead)} ms, ${Math.round(glowNow - drawLead - nowMs)} ms after the draw began`)
  return (
    <Box key="dash" position="relative" flexDirection="row" alignItems="center" paddingX={1} overflow="hidden"
      backgroundColor={DASH_BG} borderStyle="round" borderColor={DASH_EDGE}>
      {Svg ? (
        // Auto off: the art goes, so the bar reads as resting, not working.
        v.auto ? (
          <Box key="dash-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={DASH_SVG} alt="effortless" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
        ) : null
      ) : null}
      {Svg && v.auto && nowMs - autoOnAt < AUTO_GLOW_MS && renderLog.push(`glow ${v.auto ? 'on' : 'off'} at ${nowMs - autoOnAt} ms`) ? (
        <Box key="dash-auto-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg source={inPhase(autoGlowSvg(v.auto), nowMs - autoOnAt)} alt="auto glow" width={AUTO_GLOW_W} height={AUTO_GLOW_H} />
        </Box>
      ) : null}
      {/* The judge decides: the violet rim lights up, holds, and fades from full once the verdict is in. */}
      {Svg && glowSource ? (
        <Box key="dash-judge-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
          <Svg source={glowSource} alt="deciding glow" width={AUTO_GLOW_W} height={AUTO_GLOW_H} />
        </Box>
      ) : null}
      {/* One row: the effort word, the context ring, the cache, then the reason and the last reply, dim. The word never shrinks;
          when room runs out the reason goes first (it shrinks a hundred times faster), then the cache, and the row clips
          rather than run under the buttons. Siblings, not nested: a shrunk parent let the word spill under the ring. */}
      <Box key="dash-words" position="relative" flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
        <Box flexShrink={0} flexDirection="row">
          {Svg ? (
            // The mark, as it is, where the ✦ stood; faded while Auto is off.
            <Box key="dash-mark" flexShrink={0} marginRight={1} alignItems="center">
              <Svg source={v.auto ? MARK_SVG : DASH_MARK_OFF} alt="effortless" width={DASH_MARK_SIZE} height={DASH_MARK_SIZE} />
            </Box>
          ) : <Text color={v.auto ? ACCENT : DASH_DIM} bold>✦ </Text>}
          {/* A new effort shows in violet, then white (effortFlash): plain text in the app's font. An animated image of the
              word looked cheap: another font, a late start and a jump back to the text. */}
          <Text key="dash-level" color={wordColor} bold>{v.judging && Svg ? 'Deciding' : what}</Text>
          {/* The model this prompt runs on, dim, after the effort: the judge's routing to a cheaper model shows as it happens. */}
          {!v.judging && v.auto && MODELS.find(m => m.key === v.modelNow) ? (
            <Text key="dash-model" color={DASH_DIM}>{` · ${MODELS.find(m => m.key === v.modelNow)!.label}`}</Text>
          ) : null}
          {levelButtons}
          {/* While the judge decides: the progress bar's thinking dots, as a plain image (its CSS still runs, and a
              redraw does not restart it the way an interactive frame does). */}
          {v.judging && Svg ? (
            <Box key="dash-thinking" flexShrink={0} marginLeft={1} alignItems="center">
              <Svg source={thinkingSvg('planning')} alt="deciding" width={THINK_W} height={PILL_H} />
            </Box>
          ) : null}
        </Box>
        {rest ? (
          <Box flexShrink={detail ? 0 : 1} minWidth={0}>
            <Text color={DASH_TEXT} bold wrap="truncate">{rest}</Text>
          </Box>
        ) : null}
        {/* What shows when room runs out, most needed first: the effort and the context never shrink; the cache shrinks
            next and goes; the reason (dim, after it) goes first of all. Hovering the ring or the cache swaps the reason
            for what they mean. */}
        {Svg && lastContext && lastContext.window ? (
          <Box key="dash-ring" flexShrink={0} marginLeft={2} flexDirection="row" gap={1} alignItems="center"
            hover={{ scope: 'dash-cache', backgroundColor: HOVER_BOX }}>
            <Svg source={ringSvg(lastContext.percent, DASH_TEXT)} alt={`${Math.round(lastContext.percent)}% of context`} width={16} height={16} />
            <Text color={DASH_TEXT}>{`${Math.round(lastContext.percent)}%`}</Text>
          </Box>
        ) : null}
        {/* The tail: the cache, then the judge's reason, on one wrapping row one line high. The reason has no width of
            its own (it only takes what is left, truncated), so it always fits the first row and goes first; the cache
            keeps its fixed width (the ticking seconds never shift the row) and, once it no longer fits, wraps to the
            hidden second row whole, taking the reason with it. */}
        {Svg && (cacheShown !== null || detail) ? (
          <Box key="dash-tail" flexGrow={1} flexShrink={1} minWidth={0} height={1} overflow="hidden" flexDirection="row" flexWrap="wrap" marginLeft={2}>
            <Box width={0} height={1} />
            {cacheShown !== null ? (
              <Box key="dash-cache-time" width={11} flexShrink={0} hover={{ scope: 'dash-cache', backgroundColor: HOVER_BOX }}>
                <Svg source={cacheClockSvg(cacheExpires - (await $.clock.now()), cacheShown === 0 ? ICE : (cacheColor(cacheShown) ?? DASH_DIM))}
                  alt={`cache ${cacheClock(cacheExpires - (await $.clock.now()))}`} width={84} height={17} />
              </Box>
            ) : null}
            {detail ? (
              // Over the reason, shown only while the ring or cache is hovered, what they mean: a hover can only
              // reveal, so the tip is a layer on the band's colour that covers the reason.
              <Box key="dash-detail" position="relative" width={0} flexGrow={1} flexShrink={1} minWidth={10} marginLeft={cacheShown !== null ? 2 : 0}>
                <Text dimColor wrap="truncate">{detail}</Text>
                <Box key="dash-cache-tip" position="absolute" top={0} left={0} right={0} bottom={0} backgroundColor={DASH_BG}
                  display="none" hover={{ scope: 'dash-cache', display: 'flex' }}>
                  <Text dimColor wrap="truncate">{hoverTips(v).cache.replace(/^Prompt cache/, 'Cache')}</Text>
                </Box>
              </Box>
            ) : null}
          </Box>
        ) : detail ? (
          <Box key="dash-detail" flexShrink={1000} minWidth={0} marginLeft={2}>
            <Text dimColor wrap="truncate">{detail}</Text>
          </Box>
        ) : null}
      </Box>
      {/* The buttons in the flow, their real width and no more, so the words get all the rest. An empty absolute child
          makes the box positioned, which paints it over the art (a plain flow box sits under it and loses clicks). */}
      <Box minWidth={1} />
      <Box key="dash-actions" flexShrink={0} flexDirection="row" gap={1} alignItems="center" marginLeft={1}>
        <Box position="absolute" top={0} left={0} />
        {Svg ? (
          // Auto as a switch, drawn, with a blank button laid over it to take the click (the cog's pattern).
          <Box key="dash-auto-switch" position="relative" flexDirection="row" alignItems="center" gap={1} paddingX={1}>
            <Svg source={autoSwitchSvg(v.auto, nowMs - autoFlipAt)} alt={v.auto ? 'Auto on' : 'Auto off'} width={26} height={15} />
            <Text color={v.auto ? DASH_TEXT : DASH_DIM}>Auto</Text>
            <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
              <Button key="dash-auto" plain label={' '.repeat(24)} onPress={() => toggleAutoEffort($)} />
            </Box>
          </Box>
        ) : null}
        {Svg ? buttons.slice(1, -1) : buttons}
        {Svg ? (
          // The cog sits in the flow and the button in an absolute layer after it: an absolute layer paints over plain
          // ones, and the desktop ignores position="relative" on a Box without absolute children. A Button is at most as
          // wide as its box, so the box keeps a cell of padding each side of the cog for the hover box.
          <Box key="dash-settings-icon" position="relative" alignItems="center" justifyContent="center" paddingX={1}>
            <Svg source={settingsSvg(DASH_TEXT)} alt="Settings" width={14} height={14} />
            <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
              {buttons[buttons.length - 1]}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

/** The terminal's rows above the prompt: the Effort steps, Auto and who picked. They also sit under an alert band, so
 * effort never goes away. */
async function effortRows($: EngineInterface, e: RenderInput<'AbovePrompt'>, opts: { auto?: boolean } = {}) {
  const { Box, Text, Button } = themedEls($.ui.resolve(e))
  const v = await snap($)
  const { auto, current, judging, shownByApp } = v
  const effortNow = effortOf(v)
  const setEffort = (level: Effort) => () => pickEffort($, level)
  if (e.surface !== 'terminal') return null

  const notAligned = current && shownByApp && shownByApp !== current.effort
  const note = judging
    ? 'Deciding…'
    : notAligned
      ? `/effort shows ${EFFORT_LABELS[shownByApp as Effort] ?? shownByApp}`
      : current
        ? `${current.by === 'manual' ? 'You' : current.by === 'decision' ? (current.judgeName ?? 'Decision model') : 'Haiku'}: ${current.why}`
        : auto
          ? 'Picks the effort at the next prompt'
          : 'Pick an effort'
  // The lit level says how it was picked, as the dashboard's word does (nothing while the judge decides). The label is
  // longer than the bare level; the row has no measured widths, and the note at the end is the part that gives way.
  const how = judging ? undefined : pickedHow(current, auto)
  const rows = (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1} alignItems="center">
        {/* The word never breaks: the note at the end gives way first. */}
        <Box flexShrink={0}>
          <Text dimColor>Effort</Text>
        </Box>
        {EFFORTS.map(level =>
          level === effortNow ? (
            <Button key={`e-${level}`} variant="primary" label={how ? `${level} · ${how}` : level} onPress={setEffort(level)} />
          ) : (
            <Button key={`e-${level}`} plain dimColor label={level} onPress={setEffort(level)} />
          ),
        )}
        <Box flexGrow={1} />
        {opts.auto === false ? null : (
          <Button
            key="auto"
            hotkey="a"
            variant={auto ? 'primary' : undefined}
            label={auto ? 'Auto on' : 'Auto off'}
            onPress={() => toggleAutoEffort($)}
          />
        )}
        <Box flexShrink={1} minWidth={0}>
          <Text dimColor wrap="truncate-end">
            {note}
          </Text>
        </Box>
      </Box>
    </Box>
  )
  return rows
}

// --- The agent panel (hooks/agents.tsx): the $ side, kept short ------------------------------------------------------

/** Changes one agent's record, if the panel knows it. */
async function agentSet($: EngineInterface, id: string, fn: (a: AgentRec) => AgentRec) {
  await update($, agentsState, list => (list.some(a => a.id === id) ? list.map(a => (a.id === id ? fn(a) : a)) : list))
}

/** An agent's loop ended: done when it answered, failed otherwise. */
async function agentEnded($: EngineInterface, id: string, reason: string) {
  const now = await $.clock.now()
  await agentSet($, id, a => ({ ...a, state: reason === 'answer' ? 'done' : 'failed', endedAt: now, toolSince: undefined, now: undefined }))
}

/** Adds a request's weighted tokens to its agent. */
async function agentCost($: EngineInterface, id: string, cost: number) {
  await agentSet($, id, a => ({ ...a, cost: (a.cost ?? 0) + cost }))
}

// Effort for helpers: the judge's verdict for each subagent's task, by its id; each request takes the answer for the
// model it runs on. A subagent's first request can come before its spawn resolves with the id (seen 2026-10-10), so a
// verdict waits under the spawn's description and type until a request from an unknown subagent claims it through
// $.agent.list().
const helperPicks = new Map<string, Verdict>()
let helperWaiting: { description: string; type: string; parentId?: string; verdict: Verdict }[] = []

/** The judge's verdict on a subagent's task, or null. Its model is not known yet, so no answer is checked here. */
async function helperEffort($: EngineInterface, prompt: string, type: string): Promise<Verdict | null> {
  return (await judge($, helperQuestion(prompt, type), null)).verdict ?? null
}

/** A helper's effort on the model it runs on, within the person's slider, Min and Max and save mode; null when the
 * verdict has no sure answer for that model (the helper then runs as it would without one). */
async function helperSettled($: EngineInterface, verdict: Verdict, modelId: string): Promise<{ effort: Effort; why: string } | null> {
  const key = keyOf(modelId)
  const answer = key ? verdict.efforts[key] : undefined
  if (!answer || isUnsure(verdict.by, answer)) return null
  const saving = (await read($, saveUntil)) !== null
  const leaned = tipped(answer.effort, answer.sure, config.bias)
  const effort = capped(bounded(leaned, helperFloor(config.floor, config.ceiling), config.ceiling), saving)
  const why = verdict.why || sureWords(answer)
  return { effort, why: effort !== leaned && EFFORTS.indexOf(leaned) < EFFORTS.indexOf(effort) ? `${why} (helpers start at medium)` : why }
}

/** The verdict for this subagent, claiming a waiting one the first time its id is seen. */
async function helperEffortOf($: EngineInterface, id: string): Promise<Verdict | undefined> {
  const known = helperPicks.get(id)
  if (known || helperWaiting.length === 0) return known
  const info = (await $.agent.list().catch(() => [])).find(a => a.id === id)
  if (!info) return undefined
  const match = helperWaiting.find(w => w.description === info.description && w.type === info.type && w.parentId === info.parentId)
  if (!match) return undefined
  helperWaiting = helperWaiting.filter(w => w !== match)
  helperPicks.set(id, match.verdict)
  return match.verdict
}

/** Counts one request of a helper the judge steered, for /effortless stats. */
async function helperTally($: EngineInterface, usage: Parameters<typeof weighted>[0]) {
  await update($, saved, old => {
    const t = asSpent(old)
    return { ...t, helpers: { ...t.helpers, requests: t.helpers.requests + 1, cost: t.helpers.cost + weighted(usage) } }
  })
}

/** A file read or changed by the main chat or an agent: added to the map, its imports read the first time. */
async function fileTouched($: EngineInterface, path: string, edited: boolean, by: string) {
  const rel = relPath(path, await $.session.root())
  if (!rel) return
  const now = await $.clock.now()
  const known = (await read($, agentFiles)).find(f => f.path === rel)
  let imports: string[] | undefined
  if (!known || edited) imports = importsOf(rel, await $.fs.read(path).then(t => t.slice(0, 512_000), () => ''))
  await update($, agentFiles, list => withTouch(list, rel, edited, by, now, imports))
}

/** From the 1 s timer: an agent long in one tool call turns to waiting. Writes only when one changes. */
async function agentWaits($: EngineInterface) {
  const list = await read($, agentsState)
  if (!list.length) return
  const next = withWaits(list, await $.clock.now())
  if (next) await update($, agentsState, () => next)
}

export const register: Register = (on, options) => {
  loadedAt = Date.now()
  firstDrawLogged = false
  drawsTimed = 0
  setConfig(readConfig(options))
  applyTheme()
  pluginOptions = options
  on('session.compact', async ($, e, next) => {
    // A subagent's own compaction, the session's model by choice: Claude Code's own.
    if (e.agentId !== undefined || config.compactWith !== 'haiku') return next(e)
    // Ahead-of-time summaries would be written by the chat's model and then not used: none.
    if (e.trigger === 'precompute') return { skip: 'effortless compacts with Haiku when it is time' }
    // The transcript comes with the event; read it if not (a test's engine hands none).
    const messages = Array.isArray(e.messages) && e.messages.length ? e.messages : await $.session.messages().catch(() => [])
    const got = await haikuCompaction($, messages, e.instructions).catch((error: unknown) => ({ fail: String(error).slice(0, 80) }))
    if ('fail' in got) {
      $.ui.toast(`effortless: Haiku could not compact (${got.fail}). The chat's own model does it.`)
      return next(e)
    }
    lastHaikuCompact = Date.now()
    return {
      messages: [
        {
          role: 'user' as const,
          text: `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation, written by Haiku for effortless.\n\n${got.text}\n\nContinue the conversation from where it left off without asking the user any further questions.`,
          toolUses: [],
        },
      ],
    }
  })
  on('session.start', async ($, e, next) => {
    sessionStarted = Date.now()
    // Everything the first draw needs, asked for at once: one after the other they held the start (and with it the
    // band) for a second or more. What the draw does not need runs after, unawaited.
    const [sid, kept, kff, orKff, storedAuto, storedPick, setupDone] = await Promise.all([
      $.session.id().catch(() => '?'),
      $.store.get('savedSettings').catch(() => null),
      $.store.get('keyFromFile').catch(() => null),
      $.store.get('orKeyFromFile').catch(() => null),
      $.store.get('isAuto').catch(() => null),
      $.store.get('pick').catch(() => null) as Promise<Pick | null>,
      $.store.get('setupDone').catch(() => null),
    ])
    // Which chat this load serves, and when it started: each chat has its own render log.
    setLoadedSession(String(sid).slice(0, 8))
    // Settings the app had no /config row for (see saveSetting), over the ones it passed in.
    if (kept && typeof kept === 'object' && Object.keys(kept).length) {
      setConfig(readConfig({ ...pluginOptions, ...kept }))
      applyTheme()
    }
    keyFromFile = kff === true
    orKeyFromFile = orKff === true
    for (const w of timingWarnings(pluginOptions)) $.ui.toast(`effortless: ${w}`)
    await Promise.all([
      typeof storedAuto === 'boolean' ? update($, isAuto, () => storedAuto) : null,
      // Auto off means the effort you chose should still be the one in force.
      storedAuto === false && storedPick && EFFORTS.includes(storedPick.effort) ? update($, pick, () => storedPick).then(() => { pickCarried = true }) : null,
      // The first time the mod runs, the setup guide opens above the prompt.
      setupDone !== true ? update($, setupStep, () => 'pick').then(() => update($, setupPending, () => true)) : null,
    ])
    // A saved setting reloads the plugin: the pick kept in this chat is settled again under the new Min, Max and Lean.
    await resettle($)
    // The command file lists /effortless before the session starts; registering it here makes plain /effortless the
    // mod's own command afterwards, instead of the file run as a skill.
    void $.command.register({ name: 'effortless', description: 'effortless: settings, debug, handoff, setup, auto, stats.' }).catch(() => undefined)
    void $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`).then(t => { ownVersion = String(JSON.parse(String(t)).version ?? '') }).catch(() => undefined)
    void afterLoad($).catch(() => undefined)
    void drainSetupSave($).catch(() => undefined)
    startTimers($, 'start')
    // Clear the status entry older versions set.
    $.ui.status(undefined)
    void $.session.model().then(m => modelIs($, m)).catch(() => undefined)
    renderLog.push(`${new Date().toISOString()} ${loadedSession} session.start (${e.surface ?? '?'}), ready in ${Date.now() - sessionStarted} ms`)
    void writeRenderLog($).catch(() => undefined)
    return next(e)
  })

  // A chat opened again later (resume, fork): the mod starts afresh and has seen no response, so the countdown would
  // stay blank on a cache long cold. The app says how long ago the last response was, and whether the cache has
  // likely lapsed: the countdown starts from there.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const r = e as { source?: string; seconds_since_last_response?: number; prompt_cache_likely_expired?: boolean }
    classicStart = { at: Date.now(), said: `${r.source ?? '?'}, ${r.seconds_since_last_response ?? '?'}s since reply, expired ${r.prompt_cache_likely_expired ?? '?'}` }
    if ((r.source === 'resume' || r.source === 'fork') && typeof r.seconds_since_last_response === 'number' && cacheExpires === 0) {
      const now = await $.clock.now()
      lastResponseAt = now - r.seconds_since_last_response * 1000
      const left = lastResponseAt + CACHE_TTL[cacheTtl]
      cacheExpires = r.prompt_cache_likely_expired || left <= now ? now - 1 : left
      await rememberCache($)
      await checkSwamp($).catch(() => undefined)
      await showCache($).catch(() => undefined)
      // The app opens the chat and draws its band while this runs; a redraw asked now can land before the band is
      // there, and the next came only with the 15 s cache tick. Ask again over the next seconds.
      $.ui.invalidate('ui.render')
      redrawSoon()
    }
    return result
  })

  // The handoff turn ended: keep its text; the session's timer clears the chat and sends it.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) await agentEnded($, e.agentId, e.reason)
    if (!e.agentId) await setTurnBusy($, false)
    // A lower verdict for a message typed during the turn takes over now, if Auto is still on.
    if (!e.agentId && heldPick) {
      const held = heldPick
      heldPick = null
      if (await read($, isAuto)) await choose($, held)
    }
    // The newest reply's text: its last block carries the warning card (see AssistantMessage).
    if (!e.agentId && e.reason === 'answer') await update($, lastAnswer, () => e.answer.trim())
    if (!e.agentId && turnCost > 0) await update($, lastTurn, () => ({ cost: turnCost, ms: e.durationMs ?? 0 }))
    // A landed handoff card stays under the first reply after it, and goes with the next.
    if (!e.agentId) {
      await update($, handoffCard, card => (!card || cardRunning(card.kind) ? card : card.seen ? null : { ...card, seen: true }))
    }
    if (!e.agentId && (await read($, handoffStage)) === 'writing') {
      // The handoff's own turn is over: later turns go back to the pick.
      handoffEffort = null
      if (e.reason === 'answer' && e.answer.trim()) handoffText = e.answer
      else {
        await update($, handoffStage, () => null)
        $.ui.toast('effortless: the handoff was not written, nothing was cleared')
      }
    }
    return result
  })

  // /effortless is a command file in the plugin (commands/effortless.md), so the app lists it before the session has
  // started; this hook answers it, and the file's text never reaches the model. Both spellings the app may use.
  on('command.run', async ($, e, next) => {
    if (e.command !== 'effortless' && e.command !== 'effortless:effortless') return next(e)
    const arg = e.args.trim().toLowerCase()
    if (arg === 'agents' || arg === 'agents demo') {
      if (arg === 'agents demo') {
        const now = await $.clock.now()
        await update($, agentsState, () => demoAgents(now))
        await update($, agentFiles, () => demoFiles(now))
        await update($, agentSteps, () => demoSteps())
      }
      await $.ui.open({ id: 'effortless-agents', title: 'Agents' })
      return { text: arg === 'agents demo' ? 'The agent panel shows sample agents (a preview).' : 'The agent panel is open.' }
    }
    if (arg === 'auto') {
      await toggleAutoEffort($)
      return { text: (await read($, isAuto)) ? 'Auto on: effort is picked for every prompt.' : 'Auto off: the effort is yours.' }
    }
    // A test aid: marks the cache cold now, so the Compact button can be tried without waiting out the hour.
    if (arg === 'hot') {
      // Shows the running-hot band now, to try it: the next check puts back the real figures.
      await update($, hotHidden, () => null)
      await $.store.set('hotClosed', null).catch(() => undefined)
      await update($, hot, () => ({ kind: 'five_hour', percent: 82, resetsAt: new Date(Date.now() + 2 * 3600_000).toISOString() }))
      $.ui.invalidate('ui.render')
      return { text: 'The running-hot band is showing now (a test). It goes away at the next check unless a limit really is close.' }
    }
    if (arg === 'down') {
      await update($, judgeDownHidden, () => null)
      await update($, judgeDown, () => 'A decision model is out of credits (402)')
      $.ui.invalidate('ui.render')
      return { text: 'The judge-down band is showing now (a test). It goes away once the judge answers again.' }
    }
    if (arg === 'swamp') {
      // Shows the swamp band now, to try it: the next check puts back the real figure.
      await update($, swampHiddenAt, () => null)
      await update($, swamped, () => SWAMP_TOKENS)
      $.ui.invalidate('ui.render')
      return { text: 'The swamp band is showing now (a test). It goes away at the next check unless the chat really is swamped.' }
    }
    if (arg === 'save') return { text: await toggleSave($) }
    // /effortless handoff [full] [what the next session is for]: the focus as typed, case kept.
    if (arg === 'handoff' || arg.startsWith('handoff ')) {
      const { full, focus } = handoffArgs(e.args)
      const { after } = await lastHandoffChoice($)
      await startHandoff($, full, after, focus)
      const what = handoffWhat({ kind: full ? 'full' : 'quick', after }, config.handoffSkill)
      return { text: `Writing the ${full ? 'full' : 'quick'} handoff${focus ? ` for: ${focus}` : ''}. ${what.by}. ${what.then}` }
    }
    if (arg.startsWith('probe')) {
      probeLevel = Number(arg.slice(5).trim()) || 0
      await update($, settingsOpen, () => true)
      $.ui.invalidate('ui.render')
      return { text: `Probe ${probeLevel} drawn above the prompt (0 is the real panel). Tell me if you see it.` }
    }
    if (arg === 'debug') {
      const ago = (t: number) => (t ? `${Math.round((Date.now() - t) / 1000)}s ago` : 'never')
      const lastFork = (await $.store.get('lastFork').catch(() => null)) as { at: number; outcome: string } | null
      return {
        text: [
          `session.start ${ago(sessionStarted)}`,
          `app SessionStart: ${classicStart ? `${ago(classicStart.at)} (${classicStart.said})` : 'never'}`,
          `cache: ${cacheExpires === 0 ? 'not started' : `${await cacheMinutes($)} min left`}, shown ${await read($, cacheLeft)}, ttl ${cacheTtl}, last reply ${lastResponseAt ? ago(lastResponseAt) : 'none seen'}, replies seen ${repliesSeen}, forced ${coldForced}`,
          `band asked for ${renderCalls} times, last ${ago(lastRenderAt)}`,
          `band error: ${lastRenderError || 'none'}`,
          `last draw: ${lastRenderBranch || 'none'}`,
          `app sent: ${lastRenderProps || 'nothing'}`,
          `settings open: ${await read($, settingsOpen)}`,
          `judge: ${config.judge} · models: ${config.decisionModels.length ? `${config.decisionModels.map(routeLabel).join(' → ')} → Haiku` : 'none'} · last answer: ${lastChainAnswer || 'none yet'}${timingWarnings(pluginOptions).map(w => ` · ${w}`).join('')}`,
          `last verdict: ${lastVerdictLine || 'none yet'}`,
          `setup step: ${await read($, setupStep)}`,
          `handoff: ${await read($, handoffStage)}`,
          `last fork: ${lastFork ? `${lastFork.outcome}, ${ago(lastFork.at)}` : 'none'}`,
          `hidden: ${config.hide.join(',') || 'nothing'}`,
          lastRequest
            ? `last request: app asked ${lastRequest.appModel} at ${lastRequest.appEffort ?? 'none'}, sent ${lastRequest.model} at ${lastRequest.effort ?? 'none'}${lastRequest.model === lastRequest.appModel && lastRequest.effort === lastRequest.appEffort ? ' (unchanged)' : ' (changed by effortless)'}, ${ago(lastRequest.at)}`
            : 'last request: none yet',
          `compact with: ${config.compactWith}${lastHaikuCompact ? `, last by Haiku ${ago(lastHaikuCompact)}` : ''}`,
          `full handoff: ${HANDOFF_FULL_EFFORT}${handoffEffort ? ', running now' : ''}`,
        ].join(' | ') +
          // On its own line, easy to find: the model and effort the last request actually ran on.
          `
model used: ${lastRequest ? `${lastRequest.model} at ${lastRequest.effort ?? 'none'}` : 'none yet'}`,
      }
    }
    if (arg === 'settings') {
      await openPluginSettings($)
      return { text: 'The effortless settings are open above the prompt.' }
    }
    if (arg === 'setup') {
      await update($, setupStep, () => 'pick')
      $.ui.invalidate('ui.render')
      return { text: 'The effortless setup is open above the prompt.' }
    }
    if (arg === 'cold') {
      coldForced = true
      cacheExpires = await $.clock.now()
      await update($, cacheLeft, () => 0)
      $.ui.invalidate('ui.render')
      return { text: 'The cache shows as cold now (a test). Compact is in the footer. The next response restarts the countdown.' }
    }
    if (arg === 'stats' || arg === 'saved') return { text: `Auto, this session:\n${savedText(await read($, saved))}` }
    return { text: 'Try /effortless settings, debug, handoff [full], setup, auto, stats, save, cold, swamp, hot or down.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await setTurnBusy($, true)
    turnCost = 0
    // A landed handoff's card goes once the next message is sent.
    const card = await read($, handoffCard)
    if (card && (card.kind === 'done' || card.kind === 'copied')) await update($, handoffCard, () => null)
    const byPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge' || e.origin.kind === 'sdk'
    // The handoff check runs for every message the person types, whatever the effort judge is doing (or whether Auto is on).
    if (byPerson && !e.text.trim().startsWith('/') && !isFollowUp(e.text)) void checkHandoff($, e.text).catch(() => undefined)
    const wantsEffort = await read($, isAuto)
    // A typed slash command is judged only when it is a skill or a custom command (what the person added); the app's own
    // (/compact, /clear, /model) and effortless's never are. The judge is told what the command is, since its name alone says little.
    const slash = e.text.trim().startsWith('/')
    const skill = slash && byPerson ? await typedSkill($, e.text) : undefined
    if (!byPerson || (slash && !skill) || !wantsEffort) return next(e)
    // On a model where an effort change rewrites the cache, Auto waits instead of judging.
    const modelId = await $.session.model()
    await modelIs($, modelId)
    if (!cacheSafe(modelId)) return next(e)
    // "go", "ok", "yes" between two steps of work keep the effort Auto already chose; no judge is asked.
    const before = await read($, pick)
    // A message with an image is never a bare follow-up: "fix this" plus a screenshot is new work.
    // Typed while a turn ran (e.turnId), it often steers that task: the judge is told, and a lower verdict waits (heldPick).
    const midTurn = e.turnId !== undefined && before !== null
    const said = skill ? `${e.text}

[This is a slash command that runs a skill: ${skill.description || skill.name}. Judge the work the skill will do.]` : e.text
    const shown = midTurn ? withMidTurn(withAttachments(said, e.attachments)) : withAttachments(said, e.attachments)
    if (wantsEffort && before && before.by !== 'manual' && !e.attachments?.length && !slash && isFollowUp(e.text) && keepsEffort(e.text, await recentContext($).catch(() => ''))) {
      await countPrompt($, before.effort, undefined, 0, 0)
      void proof($, `follow-up "${e.text.trim()}": keeping ${before.effort}`)
      return next(e)
    }
    // "max effort", "effort: low": the person said the level, so it runs, past Min, Max and save mode, and no judge is asked.
    const named = wantsEffort && !slash ? namedEffort(e.text) : undefined
    if (named) {
      const inUse = await sessionModel($)
      const applied: Pick = { model: inUse, effort: named, why: 'you asked for it', by: 'named' }
      const running = await read($, pick)
      if (midTurn && running && EFFORTS.indexOf(named) < EFFORTS.indexOf(running.effort)) heldPick = applied
      else {
        heldPick = null
        await choose($, applied)
      }
      await countPrompt($, named, undefined, 0, 0)
      void proof($, `named level ${named} in "${e.text.slice(0, 50)}": no judge`)
      $.ui.invalidate('ui.render')
      return next(e)
    }

    judgeStartedAt = await $.clock.now().catch(() => Date.now())
    judgeEndedAt = null
    renderLog.push(`${new Date().toISOString()} ${loadedSession} glow: start`)
    drawGlowSteps($, 0, JUDGE_RISE_MS)
    // The band is drawn again as the judge starts, so the rise is placed by the clock from the first frame.
    $.ui.invalidate('ui.render')
    await update($, isJudging, () => true)
    try {
      const inUse = await sessionModel($)
      const startedAt = Date.now()
      const handsBefore = handChanges
      const judged = await judge($, shown, inUse)
      const { verdict, tokens: judgeTokens } = judged
      await endJudgeGlow($, 'verdict')
      const ms = Date.now() - startedAt
      const running = await read($, pick)
      // The person changed the pick or Auto by hand while the judge ran: the verdict is dropped. A manual pick made before
      // the prompt (Auto turned back on since) is not a change now, so its verdict still applies.
      const pickedMeanwhile = handChanges !== handsBefore
      const answer = verdict?.efforts[inUse]
      let applied: Pick | null = null
      if (verdict && answer && !isUnsure(verdict.by, answer)) {
        const why = verdict.why || sureWords(answer)
        applied = { model: inUse, ...(await settledPick($, answer, why)), by: verdict.by, ...(verdict.judgeName ? { judgeName: verdict.judgeName } : {}), ...(answer.sure !== undefined ? { sure: answer.sure } : {}), judged: verdict.efforts }
      } else if (verdict) {
        // Unsure even after Haiku's look (or no answer for this model): effortless keeps the effort in force (its pick,
        // else the app's own), still within Min, Max and save mode.
        const appNow = await read($, appEffort)
        const kept = running?.effort ?? (EFFORTS.includes(appNow as Effort) ? (appNow as Effort) : 'medium')
        const saving = (await read($, saveUntil)) !== null
        applied = { model: inUse, effort: capped(bounded(kept, config.floor, config.ceiling), saving), why: UNSURE, by: verdict.by, ...(verdict.judgeName ? { judgeName: verdict.judgeName } : {}), judged: verdict.efforts }
      }
      const via = judged.haikuWhy ? `haiku (${judged.haikuWhy.said})` : (verdict?.judgeName ?? 'decision')
      const missed = judged.haikuMissed ? ` (${judged.haikuMissed})` : ''
      const outcome = pickedMeanwhile ? 'manual pick during judging: verdict dropped' : `${applied?.effort} on ${inUse} (${applied?.why})`
      lastVerdictLine = verdict ? `${via}: ${answersText(verdict)}${missed} -> ${outcome}` : 'no verdict'
      // No verdict counts for nothing. A verdict dropped for a hand pick counts for the judge only: Auto did not steer it.
      await countPrompt($, pickedMeanwhile ? undefined : applied?.effort, verdict ? (judged.haikuWhy?.kind ?? 'decision') : undefined, ms, judgeTokens)
      void proof($, `judged in ${ms} ms: ${lastVerdictLine} for "${e.text.slice(0, 50)}"`)
      $.ui.invalidate('ui.render')
      // A click during the awaits above also keeps its pick (the stats and the proof line above still count the verdict).
      if (applied && handChanges === handsBefore) {
        // Mid-turn, a lower verdict would cut the running task's effort for its remaining steps: it waits for the
        // turn to end (the queued message may run as a turn of its own). A higher one helps the task, so it applies.
        if (midTurn && running && EFFORTS.indexOf(applied.effort) < EFFORTS.indexOf(running.effort)) {
          heldPick = applied
          void proof($, `typed mid-turn: ${applied.effort} waits, the running turn keeps ${running.effort}`)
        } else {
          heldPick = null
          await choose($, applied)
        }
      }
    } finally {
      // A judge that failed or threw ends the glow here.
      await endJudgeGlow($, 'end')
      await update($, isJudging, () => false)
    }
    return next(e)
  })

  // A switch from anywhere (the app's picker, /model, a fallback) moves the pick at once.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    await modelIs($, e.to_model)
    return result
  })

  on('turn.step', async function* ($, e, next) {
    // Every main-conversation response, whatever its effort, keeps the cache warm for its lifetime from now.
    const send = async function* (request: typeof e) {
      if (e.agentId === undefined) lastRequest = { index: e.index, appModel: e.model, appEffort: e.effort, model: request.model, effort: request.effort, at: Date.now() }
      const answer = yield* next(request)
      // Inside the hook ($ calls after it returns are refused), and never allowed to break the request.
      if (e.agentId === undefined && answer?.usage) await cacheTouched($, answer.usage).catch(() => undefined)
      if (e.agentId === undefined && answer?.usage) turnCost += weighted(answer.usage)
      if (e.agentId !== undefined && answer?.usage) await agentCost($, e.agentId, weighted(answer.usage)).catch(() => undefined)
      return answer
    }
    if (e.agentId === undefined) await setTurnBusy($, true)
    if (e.agentId === undefined) await modelIs($, e.model)
    if (e.agentId === undefined && typeof e.effort === 'string') {
      const seen = e.effort
      const isFirst = engineEffort === undefined
      const isByPerson = !isFirst && seen !== engineEffort
      engineEffort = seen
      // The first effort seen is the app's setting; a change the mod did not make is the person's.
      if (isFirst || isByPerson) await update($, appEffort, () => seen)
      // A new chat with Auto off starts from the pick kept from the last chat; the effort the app is on now is the
      // person's (they may have set it before this first prompt), so it wins. A pick made in this chat stays.
      const takesApp = isFirst && pickCarried && !(await read($, isAuto)) && (await read($, pick))?.effort !== seen
      if (isByPerson || takesApp) {
        handChanges++
        await update($, isAuto, () => false)
        await $.store.set('isAuto', false)
        await choose($, { model: await sessionModel($), effort: seen, why: 'your pick in the app', by: 'manual' })
        void proof($, `request ${e.index}: you set effort ${seen} yourself, Auto off`)
        // The app has no event for its effort picker: this is the first request after the pick, so say it plainly.
        $.ui.toast(`effortless: Auto is off. You picked ${EFFORT_LABELS[seen as Effort] ?? seen}; turn Auto on to hand it back.`)
        return yield* send(e)
      }
    }
    // The full handoff's turn: the chat's own model at medium, whatever the last prompt was judged, Auto on or off. Not
    // on a model where an effort change rewrites the cache: on a big chat that costs more than medium saves.
    if (e.agentId === undefined && handoffEffort) {
      if (typeof e.effort !== 'string') return yield* send(e)
      if (!cacheSafe(e.model)) {
        if (e.index === 0) void proof($, `full handoff: stays at ${e.effort}, an effort change on ${e.model} rewrites the cache`)
        return yield* send(e)
      }
      if (e.index === 0) void proof($, `full handoff: request ${e.index} (${e.model}) at ${handoffEffort}, was ${e.effort}`)
      return yield* send({ ...e, effort: handoffEffort })
    }
    // A helper the judge read at its spawn runs every request at the answer for the model it runs on. A model that takes no
    // effort (an older Haiku) sends none.
    if (e.agentId !== undefined && config.helpers === 'on' && typeof e.effort === 'string') {
      const verdict = await helperEffortOf($, e.agentId)
      const effort = verdict ? (await helperSettled($, verdict, e.model))?.effort : undefined
      if (effort) {
        if (e.index === 0) void proof($, `helper ${e.agentId} request 0 (${e.model}): effort ${e.effort} -> ${effort}`)
        const result = yield* send({ ...e, effort })
        if (result.usage) await helperTally($, result.usage).catch(() => undefined)
        return result
      }
    }
    const p = await read($, pick)
    // Only where an effort change keeps the cache: decided by the model this request names, never by a stored pick.
    if (!p || !cacheSafe(e.model)) return yield* send(e)
    // Auto off: the app's own effort goes out. A pick the judge made while Auto was on is not the person's choice, and
    // with the app already on the effort they want, the mod would never see a change to give way to.
    if (p.by !== 'manual' && !(await read($, isAuto))) return yield* send(e)
    // A subagent of a turn Auto picked for (Helpers off, or no answer for it) runs as Claude Code runs it: on the chat's
    // model at the chat's effort, here the turn's, no extra judge call, but never below medium: a helper's answer goes
    // back unchecked (see helperFloor). On another model Claude Code's own effort stands (its definition's, or that
    // model's default). A subagent whose definition sets its own effort cannot be told apart from one that inherits it,
    // so on the chat's model it follows the turn too.
    if (e.agentId !== undefined) {
      if (p.by === 'manual' || keyOf(e.model) !== p.model) return yield* send(e)
      const floor = helperFloor(config.floor, config.ceiling)
      const effort = EFFORTS.indexOf(p.effort) < EFFORTS.indexOf(floor) ? floor : p.effort
      if (e.index === 0) void proof($, `subagent ${e.agentId} (${e.model}): effort ${e.effort ?? 'none'} -> ${effort}, the turn's`)
      return yield* send({ ...e, effort })
    }
    if (e.agentId === undefined) void proof($, `request ${e.index} (${e.model}): effort ${e.effort ?? 'none'} -> ${p.effort}`)
    const result = yield* send({ ...e, effort: p.effort })
    // Only requests Auto steered count.
    if (e.agentId === undefined && p.by !== 'manual' && result.usage) {
      await tally($, p.effort, result.usage)
      void proof(
        $,
        `response ${e.index} at ${p.effort}: ${result.usage.output_tokens} out, ${result.usage.cache_read_input_tokens ?? 0} cache read, ${result.usage.cache_creation_input_tokens ?? 0} cache write`,
      )
    }
    return result
  })

  // The only desktop UI: the effort in use, as purple text in the prompt footer, under the chat box, and a small
  // button that switches Auto off and on. A Button cannot be coloured and the footer draws no outline or tint, so
  // plain Text is what is purple. While the judge decides it says "Deciding…", for a moment after Auto switches the level it says
  // "Low → High", and while Auto is off it says "Off" in the dim colour. Auto is switched with /effortless auto.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // The dashboard look keeps all of this in the band above the prompt; the app's own footer shows.
    if (e.surface !== 'desktop' || config.layout === 'default') return next(e)
    // The footer sits on the app's own surface, not on a panel of the mod's: it follows the app whatever the appearance.
    const { Box, Text, Button } = themedEls($.ui.resolve(e), { onApp: true })
    const v = await snap($)
    const handoffNow = (await read($, handoffStage)) !== null
    const needsSetup = await read($, setupPending)
    const effortNow = effortOf(v)
    // Save mode paints the level in the running-hot band's ember until the limit resets.
    const saving = (await read($, saveUntil)) !== null
    const label = v.judging
      ? 'Deciding…'
      : v.switchedNow
        ? `${EFFORT_LABELS[v.switchedNow.from]} → ${EFFORT_LABELS[v.switchedNow.to]}`
        : effortNow
          ? EFFORT_LABELS[effortNow]
          : 'Auto'
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        {e.props.modes.length > 0 ? <Text dimColor>{e.props.modes.join(' & ')}</Text> : null}
        {/* Hovering the level puts a box behind it, like the app's own effort pill. The spaces are its padding:
            Text has no padding of its own. */}
        {v.auto && v.pausedNow ? (
          // Older models: an effort change rewrites the cache there, so Auto waits.
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Paused '}
          </Text>
        ) : v.auto ? (
          <Text color={saving ? EMBER : ACCENT} bold hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {` ${label} `}
          </Text>
        ) : (
          <Text dimColor hover={{ scope: 'effort', backgroundColor: HOVER_BOX }}>
            {' Off '}
          </Text>
        )}
        {/* The one thing to click: it switches Auto off and on. Text cannot be clicked, so it is a small button. */}
        <Button key="auto" plain dimColor label=" ⏻ " hover={{ scope: 'power', backgroundColor: HOVER_BOX }} onPress={() => toggleAutoEffort($)} />
        {/* Until a judge is picked the footer offers the setup; after that the same place opens the settings panel. */}
        {needsSetup ? (
          <Button
            key="setup"
            plain
            label=" Setup "
            hover={{ scope: 'setup', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              await update($, setupStep, () => 'pick')
              $.ui.invalidate('ui.render')
            }}
          />
        ) : (
          <Button
            key="settings"
            plain
            dimColor
            label=" ⚙︎ "
            hover={{ scope: 'settings', backgroundColor: HOVER_BOX }}
            onPress={async () => {
              if (await read($, settingsOpen)) {
                await update($, settingsDraft, () => ({}))
                await update($, settingsOpen, () => false)
                $.ui.invalidate('ui.render')
              } else await openPluginSettings($)
            }}
          />
        )}
        {/* Hand off: opens the handoff bar above the prompt (quick or full, then what follows). One symbol, so it takes
            little room; pressed again it closes the bar. */}
        {config.hide.includes('handoff') ? null : (
          <Button
            key="handoff"
            plain
            dimColor
            label={handoffNow ? ' … ' : ' ⇥ '}
            hover={{ scope: 'handoff', backgroundColor: HOVER_BOX }}
            onPress={async () => ((await read($, handoffPick)) ? closeHandoffBar($) : openHandoffBar($))}
          />
        )}
        {/* How long the prompt cache stays warm: grey, yellow from 20 minutes, red from 5, then "cold" (the next message
            writes the whole context again). Nothing before the first response. */}
        {/* Cold: the band above the prompt says it and holds Compact; the footer only shows the state, in ice blue. */}
        {/* Hovering it reveals a card above the prompt (the cache scope); see the hover cards in AbovePrompt. */}
        {config.hide.includes('timer') ? null : v.cacheNow === 0 ? (
          <Text color={ICE} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>{cacheLabel(0)}</Text>
        ) : v.cacheNow === null ? null : cacheColor(v.cacheNow) ? (
          <Text color={cacheColor(v.cacheNow)} hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>{cacheLabel(v.cacheNow)}</Text>
        ) : (
          <Text dimColor hover={{ scope: 'cache', backgroundColor: HOVER_BOX }}>{cacheLabel(v.cacheNow)}</Text>
        )}
      </Box>
    )
  })

  // The terminal's line under each reply ("Baked 3s") in the brand's colours, with the effort and the cache. The
  // desktop draws no such line; the bands above the prompt warn there (a card under the reply repeated them, removed).
  // The agent panel. Each subagent the chat sends off gets a record: spawned, what it does now, its own steps, how it
  // ended. Teammates and workflow agents are left out for now.
  on('agent.spawn', async ($, e, next) => {
    // Effort for helpers: the judge reads the subagent's task before it starts (a fork shares the chat's context and
    // keeps its effort). Without a verdict it runs at the chat's effort, as with the setting off.
    const helper = config.helpers === 'on' && !e.fork && !e.isTeammate && !e.workflow
      ? await helperEffort($, e.prompt, e.subagentType).catch(() => null)
      : null
    const waiting = helper ? { description: e.description, type: e.subagentType, parentId: e.parentAgentId, verdict: helper } : null
    if (waiting) helperWaiting = [...helperWaiting, waiting].slice(-20)
    const result = await next(e)
    // Now its model is known: the effort it runs at, for the pane and the stats.
    const runsOn = ('model' in result && result.model) || e.model || e.parentModel
    const settled = helper && 'agentId' in result && result.agentId && runsOn ? await helperSettled($, helper, runsOn) : null
    if (waiting) {
      helperWaiting = helperWaiting.filter(w => w !== waiting)
      if ('agentId' in result && result.agentId && !helperPicks.has(result.agentId)) helperPicks.set(result.agentId, waiting.verdict)
      void proof($, `helper ${e.subagentType} "${e.description}": ${answersText(waiting.verdict)}${settled ? ` -> ${settled.effort} (${settled.why})` : ', none applies'}`)
      if (settled) {
        await update($, saved, old => {
          const t = asSpent(old)
          return { ...t, helpers: { ...t.helpers, runs: { ...t.helpers.runs, [settled.effort]: (t.helpers.runs[settled.effort] ?? 0) + 1 } } }
        }).catch(() => undefined)
      }
    }
    if (e.isTeammate || e.workflow || !('agentId' in result) || !result.agentId) return result
    const id = result.agentId
    const now = await $.clock.now()
    const rec: AgentRec = { id, type: e.fork ? 'fork' : e.subagentType, task: e.description, state: 'running', startedAt: now, model: result.model }
    if (settled) {
      rec.effort = EFFORT_LABELS[settled.effort]
      rec.why = settled.why
    }
    if (e.parentAgentId) rec.parentId = e.parentAgentId
    await update($, agentsState, list => [...list.filter(a => a.id !== id), rec].slice(-40))
    return result
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    const input = e as unknown as Record<string, unknown>
    const touch = touchOf(e.tool, input)
    const isList = e.tool === 'TodoWrite' || e.tool === 'TaskCreate' || e.tool === 'TaskUpdate'
    const known = id !== undefined && (await read($, agentsState)).some(a => a.id === id)
    if (!touch && !known && !(id === undefined && isList)) return next(e)
    if (known && id !== undefined) {
      const now = await $.clock.now()
      const file = touch ? (relPath(touch.path, await $.session.root()) ?? undefined) : undefined
      await agentSet($, id, a => ({ ...a, now: toolLine(e.tool, input), toolSince: now, file }))
    }
    const result = await next(e)
    const ok = !('deny' in result && result.deny) && !result.isError
    if (ok && touch) await fileTouched($, touch.path, touch.edited, id ?? 'main').catch(() => undefined)
    if (ok && id === undefined && isList) {
      if (e.tool === 'TodoWrite') await update($, agentSteps, () => stepsFromTodos(e.todos))
      else if (e.tool === 'TaskCreate') {
        const taskId = (result.result as { task?: { id?: string } } | undefined)?.task?.id
        if (taskId) await update($, agentSteps, steps => withTaskCreated(steps ?? [], taskId, e))
      } else await update($, agentSteps, steps => (steps ? withTaskUpdated(steps, e) : steps))
    }
    if (known && id !== undefined) {
      const steps = ok && e.tool === 'TodoWrite' ? stepsFromTodos(e.todos) : undefined
      await agentSet($, id, a => ({ ...a, toolSince: undefined, file: undefined, state: a.state === 'waiting' ? 'running' : a.state, ...(steps ? { steps } : {}) }))
    }
    return result
  })

  on('ui.render', { component: 'Pane', requestId: 'effortless-agents' }, async ($, e) => {
    const els = themedEls($.ui.resolve(e))
    const agents = await read($, agentsState)
    const open = await read($, agentsOpen)
    const rows = Math.max(12, e.props.scroll.bodyRows)
    return agentsPane(
      {
        ...els,
        rows,
        nowMs: await $.clock.now(),
        title: 'This chat',
        open,
        ringSvg,
        cardArt: { source: DASH_SVG, width: FROST_WIDTH * 2, height: FROST_HEIGHT * 2 },
        onOpen: (id: string) => update($, agentsOpen, cur => (cur === id ? null : id)),
        files: await read($, agentFiles),
        steps: await read($, agentSteps),
        module: await read($, agentsModule),
        onModule: (key: string) => update($, agentsModule, cur => (cur === key ? null : key)),
      },
      agents,
    )
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (config.hide.includes('line')) return next(e)
    const { Box, Text } = themedEls($.ui.resolve(e))
    const v = await snap($)
    const effortNow = effortOf(v)
    const took = Math.max(1, Math.round(e.props.durationMs / 1000))
    return (
      <Box key="turn-line" flexDirection="row" gap={1}>
        <Text dimColor>{`${e.props.word} ${took < 60 ? `${took}s` : `${Math.floor(took / 60)}m ${took % 60}s`}`}</Text>
        <Text color={ACCENT}>{`✦ ${effortNow ? EFFORT_LABELS[effortNow] : 'Auto'}`}</Text>
        {v.cacheNow === null ? null : (
          <Text dimColor={cacheColor(v.cacheNow) === undefined} color={cacheColor(v.cacheNow)}>{`· ${v.cacheNow <= 0 ? 'cache cold' : `cache ${cacheLabel(v.cacheNow)}`}`}</Text>
        )}
      </Box>
    )
  })

  // Above the prompt: the terminal's rows (effort steps, Auto, and the model row when it is switched on).
  // On desktop nothing is drawn here, except the question when the judge suggests another model.
  // Draws the bands and the settings panel. Counted and guarded so /effortless debug can say whether the app asks
  // for it at all and whether drawing failed: an error here otherwise only leaves the slot empty.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Setup changes a reload cut off are saved from here: the reloaded plugin draws before anything else runs.
    void drainSetupSave($).catch(() => undefined)
    void afterLoad($).catch(() => undefined)
    await restoreCache($).catch(() => undefined)
    renderCalls++
    lastRenderAt = Date.now()
    void refreshAppearance($).catch(() => undefined)
    lastRenderProps = JSON.stringify(e.props).slice(0, 200)
    renderLog.push(`${new Date(lastRenderAt).toISOString()} ${loadedSession} ${lastRenderProps}`)
    if (!firstDrawLogged) {
      firstDrawLogged = true
      renderLog.push(`${new Date().toISOString()} ${loadedSession} first draw asked ${lastRenderAt - loadedAt} ms after load`)
      void writeRenderLog($).catch(() => undefined)
    }
    try {
    // The error shown in /effortless debug is the last draw's, not one from long ago.
    lastRenderError = ''
    if (e.props.hasSurvey) {
      lastRenderBranch = 'stepped aside: the app has a survey in this spot'
      return next(e)
    }
    const asked = await $.store.get('openSettingsAt')
    const askedHere =
      asked && typeof asked === 'object' && (asked as { session?: string }).session === (await $.session.id().catch(() => ''))
        ? (asked as { at: number }).at
        : null
    if (typeof askedHere === 'number') {
      await $.store.set('openSettingsAt', null)
      // Drawing may not change state (the store is not state): the panel opens just after this draw.
      if (Date.now() - askedHere < 60_000 && !(await read($, settingsOpen))) $.clock.after(0, () => void openSettingsPanel($).catch(() => undefined))
    }
    lastRenderBranch = (await read($, settingsOpen)) ? 'drew the settings panel' : 'drew a band or nothing'
    const { Box, Text, Button, Svg, Link } = themedEls($.ui.resolve(e))
    // The settings panel: a branded header bar, then one compact row per setting, a dim hint at the end of each row.
    if (await read($, settingsOpen)) {
      // The app gives this slot maxRows rows and drops a taller tree whole, without a word. With gaps the panel is 12
      // rows (2 border, 2 header, 4 settings, 4 gaps); without, 7.
      const roomy = (typeof e.props.maxRows === 'number' ? e.props.maxRows : 12) >= 12
      const { Input, Select } = themedEls($.ui.resolve(e))
      const opts = (values: readonly string[]) => values.map(value => ({ value, label: value }))
      // The skills and commands installed here, to pick the handoff writer from: no typing, no file paths. A plugin
      // cannot open a file dialog, and a skill is run by its name anyway.
      const skillNames = await read($, installedSkills)
      // A plain button with its own handler: a dismiss-role button may be taken by the app before onPress runs.
      const close = async () => {
        await update($, settingsDraft, () => ({}))
        await update($, judgeTest, () => null)
        await update($, settingsCard, () => null)
        await update($, settingsOpen, () => false)
        $.ui.invalidate('ui.render')
      }
      // The panel shows the draft over the saved settings; every control writes to the draft only.
      const draft = await read($, settingsDraft)
      const tested = await read($, judgeTest)
      const card = await read($, settingsCard)
      const openCard = (to: SettingsCard | null) => async () => {
        await update($, settingsCard, () => to)
        $.ui.invalidate('ui.render')
      }
      const set = (field: keyof SettingsDraft) => async (value: string) => {
        await update($, settingsDraft, d => ({ ...d, [field]: value }))
        $.ui.invalidate('ui.render')
      }
      const shown = {
        bias: draft.bias !== undefined ? Number(draft.bias) : config.bias,
        floor: (draft.floor ?? config.floor) as Effort,
        ceiling: (draft.ceiling ?? config.ceiling) as Effort,
        judge: (draft.judge ?? config.judge) as JudgeConfig['judge'],
        handoffAfter: draft.handoffAfter ?? config.handoffAfter,
        handoffSkill: draft.handoffSkill ?? config.handoffSkill,
        swampAt: draft.swampAt ?? String(config.swampAt),
        layout: draft.layout ?? config.layout,
        compactWith: draft.compactWith ?? config.compactWith,
        handoffButton: draft.handoffButton ?? config.handoffButton,
        helpers: draft.helpers ?? config.helpers,
        theme: draft.theme ?? config.theme,
        appearance: draft.appearance ?? config.appearance,
        decisionModels: draft.decisionModels ?? chainIds(config.decisionModels),
        judgeTimeoutMs: draft.judgeTimeoutMs ?? String(config.judgeTimeoutMs),
        judgeBudgetMs: draft.judgeBudgetMs ?? String(config.judgeBudgetMs),
      }
      // Fork: the decision models as the draft has them, and which keys they need.
      const chain = parseDecisionModels(shown.decisionModels)
      const needsOpenRouter = chain.some(r => r.provider === 'openrouter')
      const needsTypesafe = chain.some(r => r.provider === 'typesafe')
      // The TypeSafe key file is only opened for a typesafe/ model the panel lists.
      const hasKey = needsTypesafe && Boolean(await typesafeKey($).catch(() => undefined))
      // The OpenRouter key file is only opened once an openrouter/ model is listed.
      const hasOrKey = needsOpenRouter ? await hasOpenRouterKey($).catch(() => false) : false
      // The Helpers switch slides like Auto's: the time it flipped, seen by the draw after the click.
      const helpersNow = await $.clock.now()
      if (helpersSeen !== undefined && helpersSeen !== shown.helpers) helpersFlipAt = helpersNow
      helpersSeen = shown.helpers
      // Dirty only while the draft differs from what is saved: a control set back to its saved value is no change.
      const sameSet = (a: string, b: string) => a.split(',').filter(Boolean).sort().join() === b.split(',').filter(Boolean).sort().join()
      const dirty = Object.entries(draft).some(([field, value]) =>
        value === undefined ? false
        : field === 'key' || field === 'openrouterKey' ? Boolean(value.trim())
        : field === 'modelOther' ? false
        : field === 'hide' ? !sameSet(value, config.hide.join(','))
        : field === 'decisionModels' ? value !== chainIds(config.decisionModels)
        : value !== String(config[field as Exclude<keyof SettingsDraft, 'key' | 'hide' | 'openrouterKey' | 'modelOther' | 'decisionModels'>] ?? ''))
      const hidden = (draft.hide ?? config.hide.join(',')).split(',').filter(Boolean)
      const judgeName = shown.judge === 'haiku' || !chain.length ? 'Haiku' : `Haiku + ${chain.length} model${chain.length === 1 ? '' : 's'}`
      const summaries: Record<SettingsCard, string> = {
        effort: `${BIAS_WORDS[shown.bias + 2]} · ${shown.floor} to ${shown.ceiling}${shown.helpers === 'on' ? ' · helpers' : ''}`,
        judge: tested && tested.ok !== null ? `${judgeName} · ${tested.ok ? 'working' : 'failing'}` : judgeName,
        models: chain.map(routeLabel).join(' → ') || 'None',
        handoff: `${shown.handoffSkill ? `/${shown.handoffSkill}` : 'Built in'} · compact alert at ${shown.swampAt}%`,
        show: `${shown.layout === 'minimal' ? 'Minimal' : 'Dashboard'} · ${2 - ['timer', 'reason'].filter(h => hidden.includes(h)).length} of 2 on`,
      }
      // The cache timer, the judge's line (who picked and how sure) and the three alerts can be switched off here (an
      // alert's ✕ only closes it for now); the rest is the mod itself. A ticked box in plain text, dim when off: lighter than a row of white buttons.
      const box = ([part, label]: readonly [Hideable, string]) => {
        const off = hidden.includes(part)
        const after = off ? hidden.filter(h => h !== part) : [...hidden, part]
        return (
          <Button key={`show-box-${part}`} plain dimColor={off} label={`${off ? '☐' : '☑'}︎ ${label}`}
            onPress={() => set('hide')(after.join(','))} />
        )
      }
      const toggles = ([['timer', 'Cache timer'], ['reason', 'Judge line']] as const).map(box)
      // The alerts sit in the Handoff card, next to the share of context the context alert waits for.
      const alertToggles = ([['swamp', 'Context alert'], ['hot', 'Running low alert'], ['cold', 'Cold cache alert']] as const).map(box)
      // The slider: five stops, the marker on the one in force. No animation, a click moves it.
      const track: unknown[] = []
      for (const n of [-2, -1, 0, 1, 2]) {
        if (n > -2) track.push(<Text key={`t${n}`} dimColor>─</Text>)
        track.push(<Button key={`bias${n + 2}`} plain label={n === shown.bias ? '◉' : '○'} onPress={() => set('bias')(String(n))} />)
      }
      // The terminal has no art and few rows: no gaps, one row under the title.
      const term = e.surface === 'terminal'
      const iconKind = { [ICON_EFFORT]: 'effort', [ICON_JUDGE]: 'judge', [ICON_HANDOFF]: 'handoff', [ICON_SHOW]: 'show' } as const
      const row = (key: string, label: string, icon: string, children: unknown[]) => (
        <Box key={key} flexDirection="row" gap={1} alignItems="center">
          <Box width={13} flexShrink={0} flexDirection="row" gap={1} alignItems="center">
            <Box flexShrink={0} width={2} alignItems="center">
              {Svg && !term ? (
                <Svg source={rowIconSvg(iconKind[icon as keyof typeof iconKind], DASH_DIM)} alt={label} width={14} height={14} />
              ) : (
                <Text color={ACCENT}>{icon}</Text>
              )}
            </Box>
            <Text dimColor>{label}</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center" flexShrink={1}>
            {children}
          </Box>
        </Box>
      )
      // The terminal's dropdown opens its list inside the wrapping row, which jumps the layout and is hard to click.
      // There a short list is a row of buttons, the picked one boxed; a long one (the skills) stays a dropdown.
      type Pick = { key: string; label?: string; value: string; options: { value: string; label: string }[]; onSelect: (v: string) => unknown }
      const pick = (p: Pick) => term && p.options.length <= 5 ? (
        <Box key={p.key} width="100%" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
          {p.label ? <Text key={`${p.key}-label`} dimColor>{p.label}</Text> : null}
          {p.options.map(o => o.value === p.value ? (
            <Button key={`${p.key}-${o.value}`} variant="secondary" label={o.label} onPress={() => p.onSelect(o.value)} />
          ) : (
            <Button key={`${p.key}-${o.value}`} plain dimColor label={o.label} onPress={() => p.onSelect(o.value)} />
          ))}
        </Box>
      ) : (
        <Select key={p.key} label={p.label} value={p.value} options={p.options} onSelect={p.onSelect} />
      )
      const field = (key: string, input: unknown, width: number) => (
        <Box key={key} width={width} flexShrink={1}>
          {input}
        </Box>
      )
      // One column, a row per setting, its hint at the end. The header is three absolute layers, drawn in order (bar and
      // art, then the title, then the buttons): an absolute layer covers whatever is in the flow, so nothing of the
      // header is in the flow but a spacer that keeps its row free.
      if (probeLevel === 1) {
        return (
          <Box key="probe" borderStyle="round" borderColor={BRAND_EDGE} paddingX={1}>
            <Text>effortless probe 1: a bare box</Text>
          </Box>
        )
      }
      // Probe 2 keeps only the frame and header; probe 3 keeps the rows of buttons and text, no pickers or fields.
      const frameOnly = probeLevel === 2
      const bare = probeLevel === 3
      // Desktop keeps title and buttons as absolute layers straight under the panel; the terminal gets a wrapping row.
      const headRow = (kids: unknown[]) => term
        ? <Box key="settings-head" flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap={2}>{kids}</Box>
        : kids
      const bugUrl = ownVersion ? `${REPORT_BUG_URL}?body=${encodeURIComponent(`effortless ${ownVersion}`)}` : REPORT_BUG_URL
      return (
        // The dashboard's look: the neutral band and its quiet edge, purple only on the star, no art behind the rows (it
        // made them busy). The entrance
        // sweep plays once, behind everything, as the panel opens.
        <Box key="settings" position="relative" flexDirection="column" gap={roomy && !term ? 1 : 0} paddingX={term ? 1 : 2} overflow="hidden"
          backgroundColor={DASH_BG} borderStyle="round" borderColor={DASH_EDGE}>
          {term ? null : introLayer({ Box, Svg }, 'settings', await introShows($, 'settings'))}
          {/* The top bar: barely a shade lighter than the band, holding the title, Save and the cross. */}
          {!term ? (
            <Box key="settings-bar" position="absolute" top={-1} left={0} right={0} height={3.5} overflow="hidden" backgroundColor={DASH_HEAD}>
              {/* The mark, big, tilted and cut off by the bar's edges, in the gap between the title and the buttons: behind
                  the buttons it made them hard to read. */}
              <Box key="settings-bar-mark" position="absolute" top={-2} right={48} marginTop={1}>
                <Svg source={SETTINGS_MARK} alt="effortless mark" width={140} height={140} />
              </Box>
              {/* A hairline along the bar's bottom: a one-pixel image stretched across (a Box cannot draw one pixel). */}
              <Box key="settings-rule" position="absolute" bottom={0} left={0} right={0} height={1} alignItems="flex-end">
                <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1" viewBox="0 0 1600 1" preserveAspectRatio="none"><rect width="1600" height="1" fill="${DASH_EDGE}"/></svg>`} alt="rule" width={1600} height={1} />
              </Box>
            </Box>
          ) : null}
          {/* Title and buttons are centred in the whole bar (it reaches from the border to the line under it), so the
              space above them equals the space below. The terminal has no bar: both sit in the flow on one row that
              wraps, since two absolute layers drew over each other in a narrow window. */}
          {headRow([
          <Box key="settings-title" {...(term ? { flexShrink: 0 } : { position: 'absolute', top: 0, left: 2, height: 2.5 })} flexDirection="row" alignItems="center" gap={1}>
            {term ? <Text color={ACCENT} bold>✦</Text> : null}
            {Svg && !term ? <Svg source={SETTINGS_TITLE} alt="effortless" width={92} height={28} /> : <Text color={DASH_TEXT} bold>effortless</Text>}
            {ownVersion ? <Text color="#6b6b73">v{ownVersion}</Text> : null}
            {/* Inside a part: Back to the cards, then the part's name. */}
            {card === null ? (
              <Text dimColor>Settings</Text>
            ) : (
              <Box key="settings-trail" flexDirection="row" alignItems="center" gap={1}>
                {/* A real button: a dim "Settings" in a trail did not read as a way back. */}
                <Button key="settings-back" variant="secondary" label="← Back" onPress={openCard(card === 'models' ? 'judge' : null)} />
                {card === 'models' ? <Text dimColor>{'Judge ›'}</Text> : null}
                <Text color={DASH_TEXT} bold>{partOf(card)?.title}</Text>
              </Box>
            )}
            {dirty ? <Text dimColor> · unsaved changes</Text> : null}
          </Box>,
          <Box key="settings-actions" {...(term ? { flexShrink: 1, flexWrap: 'wrap', columnGap: 2 } : { position: 'absolute', top: 0, right: 2, height: 2.5, gap: 2 })} flexDirection="row" alignItems="center">
            {/* A terminal without link support prints the whole address after the label, so there it copies instead. */}
            {term ? (
              <Button key="settings-bug" plain dimColor label="Report a bug" onPress={async () => {
                const r = await $.ui.copy({ text: bugUrl, surface: e.surface }).catch(() => ({ isCopied: false as const }))
                $.ui.toast(r.isCopied ? `Bug report link copied: ${bugUrl}` : `effortless: report a bug at ${bugUrl}`)
              }} />
            ) : (
              <Text color="#9a9aa3"><Link href={bugUrl} label="Report a bug" /></Text>
            )}
            {/* Grey and inert until something changed: there is nothing to save. */}
            {dirty ? (
              <Button key="settings-save" variant="primary" hotkey="s" label="Save" onPress={() => saveDraft($)} />
            ) : (
              <Button key="settings-save" variant="secondary" dimColor label="Save" onPress={() => {}} />
            )}
            <Button key="settings-close" plain label="✕" onPress={close} />
          </Box>,
          ])}
          {term ? null : <Box key="settings-spacer" height={roomy ? 2 : 1} />}
          {frameOnly ? null : card === null ? (
            // The overview: a card per part, what it is set to in a few words. A card opens that part alone.
            <Box key="settings-cards" flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={term ? 0 : 1}>
              <Box position="absolute" top={0} left={0} />
              {CARDS.map(c => (
                <Box key={`card-${c.id}`} position="relative" flexDirection="column" flexGrow={1} width={0} minWidth={18}
                  paddingX={1} borderStyle="round" borderColor={DASH_EDGE} hover={{ backgroundColor: CARD_HOVER, borderColor: CARD_HOVER_EDGE }}>
                  <Box flexDirection="row" gap={1} alignItems="center">
                    {Svg && !term ? <Svg source={rowIconSvg(c.id, DASH_TEXT)} alt={c.title} width={14} height={14} /> : null}
                    {/* The terminal draws the blank buttons below as real spaces over the card's text, so there the
                        title itself is the button. (Full-width padded buttons per row looked worse: a big lit block.) */}
                    {term ? (
                      <Button key={`settings-card-${c.id}`} plain label={`${c.title} ›`} onPress={openCard(c.id)} />
                    ) : (
                      <Text color={DASH_TEXT} bold hover={{ color: '#ffffff' }}>{c.title}</Text>
                    )}
                  </Box>
                  <Text dimColor wrap="truncate" hover={{ dimColor: false, color: DASH_TEXT }}>{summaries[c.id]}</Text>
                  {/* The click takes the whole card: a button is one line high and centred in its box, whatever the box,
                      so three blank ones are spread from the top edge to the bottom one and overlap. The card lights as a
                      whole (its own hover); two, spaced around, left its edges and a stripe between the lines dead. */}
                  {term ? null : <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="column" justifyContent="space-between">
                    {/* Each button sits in a clipping box and does not shrink: in a narrow card a shrunk button cut its
                        blank label to "\u2026", three stacked dots on the card. 800 no-break spaces (about 2,000 px: one is ~2.6 px, measured with
                        tools/render-band --hit) cover a card alone on its row edge to edge; the box clips the rest. */}
                    {['', '-2', '-3'].map(n => (
                      <Box key={`settings-card-box-${c.id}${n}`} flexDirection="row" justifyContent="center" overflow="hidden">
                        <Box flexShrink={0}>
                          <Button key={`settings-card-${c.id}${n}`} plain hover={{ backgroundColor: '#00000000' }} label={'\u00a0'.repeat(800)} onPress={openCard(c.id)} />
                        </Box>
                      </Box>
                    ))}
                  </Box>}
                </Box>
              ))}
            </Box>
          ) : (
            // One part: Back, its name and what it does, then its controls.
            <Box key={`settings-${card}`} flexDirection="column" gap={roomy && !term ? 1 : 0} minHeight={term ? undefined : SETTINGS_BODY_H}>
              {/* An empty absolute child makes the box positioned, so its rows paint, and take clicks, over the
                  entrance sweep and the art (absolute layers cover every plain box, and the sweep stays until the next
                  redraw). */}
              <Box position="absolute" top={0} left={0} />
              {/* What the part does; Back and its name are in the top bar's trail. */}
              <Text dimColor wrap="truncate">{partOf(card)?.about}</Text>
              <Box flexDirection="row" flexWrap="wrap" gap={1} alignItems="center">
                {card === 'effort' ? [
            <Text key="cheap" dimColor>Cheaper</Text>,
            <Box key="track" flexDirection="row" alignItems="center">
              {track}
            </Box>,
            <Text key="smart" dimColor>Smarter</Text>,
            ...(bare
              ? []
              : [
                  <Box key="gap" width={2} />,
                  pick({ key: "settings-floor", label: "Min", value: shown.floor, options: opts(EFFORTS), onSelect: set('floor') }),
                  pick({ key: "settings-ceiling", label: "Max", value: shown.ceiling, options: opts(EFFORTS), onSelect: set('ceiling') }),
                  // Effort for helpers on a row of its own: the dashboard's Auto switch exactly (switch, word, slide,
                  // one blank button laid over both), then what it does now.
                  <Box key="settings-helpers-row" width="100%" flexDirection="row" alignItems="center" gap={1}>
                    {Svg && !term ? (
                      <Box key="settings-helpers" position="relative" flexDirection="row" alignItems="center" gap={1} paddingX={1}>
                        <Svg source={autoSwitchSvg(shown.helpers === 'on', helpersNow - helpersFlipAt)} alt={shown.helpers === 'on' ? 'Helpers on' : 'Helpers off'} width={26} height={15} />
                        <Text color={shown.helpers === 'on' ? DASH_TEXT : DASH_DIM}>Helpers</Text>
                        {/* The cards' cover: no-break spaces (plain ones collapse to a dot), wider than the switch and its
                            word, clipped to them, so the click reaches both edges. */}
                        <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center" justifyContent="center" overflow="hidden">
                          <Box flexShrink={0}>
                            <Button key="settings-helpers-switch" plain hover={{ backgroundColor: '#00000000' }} label={'\u00a0'.repeat(40)} onPress={() => set('helpers')(shown.helpers === 'on' ? 'off' : 'on')} />
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Button key="settings-helpers-switch" plain label={`${shown.helpers === 'on' ? '◉' : '○'} Helpers`} onPress={() => set('helpers')(shown.helpers === 'on' ? 'off' : 'on')} />
                    )}
                    <Text dimColor wrap="truncate">{shown.helpers === 'on' ? "The judge picks each subagent's effort, medium or more" : "Subagents run at the chat's effort"}</Text>
                  </Box>,
                ]),
] : card === 'models' ? (bare ? [] : [
            // The models in the order tried, two to a row so eight still fit the band's height: its provider's mark, its
            // place and id (cut short if it must be), then ↑ to try it earlier and ✕. Read across, then down.
            ...(chain.length ? [
              <Box key="model-list" width="100%" flexDirection="row" flexWrap="wrap">
                {chain.map((r, i) => {
                  const mark = providerMark(r)
                  return (
                    <Box key={`model-chip-${r.id}`} width="50%" flexDirection="row" gap={1} alignItems="center" paddingRight={2}>
                      {Svg && !term ? <Box flexShrink={0}><Svg source={mark.source} alt={mark.alt} width={mark.width} height={mark.height} /></Box> : null}
                      <Box flexGrow={1} flexShrink={1} minWidth={0}>
                        <Text color={DASH_TEXT} wrap="truncate">{`${i + 1} ${routeLabel(r)}`}</Text>
                      </Box>
                      {i > 0 ? <Button key={`model-earlier-${r.id}`} plain dimColor label="↑" onPress={() => set('decisionModels')(movedEarlier(shown.decisionModels, r.id))} /> : null}
                      <Button key={`model-remove-${r.id}`} plain dimColor label="✕" onPress={() => set('decisionModels')(withoutRoute(shown.decisionModels, r.id))} />
                    </Box>
                  )
                })}
              </Box>,
            ] : []),
            // Adding and the time limits on the row under the list.
            <Box key="model-controls-break" width="100%" height={0} />,
            ...(chain.length < MAX_ROUTES
              ? [pick({ key: 'settings-model-add', label: 'Add', value: '-', options: [
                    // The terminal draws a short list as buttons, where a placeholder would be one more button.
                    ...(term ? [] : [{ value: '-', label: chain.length ? 'Another model' : 'The first model' }]),
                    ...DECISION_PRESETS.filter(p => !chain.some(r => r.id === p.id)).map(p => ({ value: p.id, label: routeLabel(parseDecisionModels(p.id)[0]!) })),
                    { value: 'other', label: 'Other…' },
                  ], onSelect: (v: string) => v === 'other' ? set('modelOther')(draft.modelOther ?? '') : v !== '-' ? set('decisionModels')(withRoute(shown.decisionModels, v)) : undefined })]
              : []),
            // Any other model by its id, checked as it is typed: added on ok, and the field goes away.
            ...(draft.modelOther !== undefined
              ? [field('model-other-field', <Input key="settings-model-other" placeholder="openrouter/<publisher>/<model>" value={draft.modelOther}
                  submitLabel="Add" onInput={set('modelOther')}
                  onSubmit={async (v: string) => {
                    // Not a model id: kept in the field, with the line saying why.
                    if (parseDecisionModels(v).length !== 1) return set('modelOther')(v)
                    await update($, settingsDraft, d => ({ ...d, decisionModels: withRoute(shown.decisionModels, v), modelOther: undefined }))
                    $.ui.invalidate('ui.render')
                  }} />, 34)]
              : []),
            ...(draft.modelOther?.trim() && parseDecisionModels(draft.modelOther).length !== 1
              ? [<Text key="model-other-error" color="#ff8a80" wrap="truncate">Not a model id: use opencode/…, openrouter/…/… or typesafe/…</Text>]
              : []),
            pick({ key: 'settings-model-each', label: 'Each', value: shown.judgeTimeoutMs, options: ['2000', '3000', '4000', '6000'].map(ms => ({ value: ms, label: `${Number(ms) / 1000} s` })), onSelect: set('judgeTimeoutMs') }),
            pick({ key: 'settings-model-all', label: 'In all', value: shown.judgeBudgetMs, options: ['4000', '6000', '8000', '9000'].map(ms => ({ value: ms, label: `${Number(ms) / 1000} s` })), onSelect: set('judgeBudgetMs') }),
]) : card === 'judge' ? (bare ? [] : [
            pick({ key: "settings-judge-pick", value: shown.judge, options: [{ value: 'auto', label: chain.length ? 'Haiku + decision models' : 'Haiku (decision models if added)' }, { value: 'haiku', label: 'Haiku only' }], onSelect: v => set('judge')(v === 'haiku' ? 'haiku' : 'auto') }),
            ...(shown.judge !== 'haiku'
              ? [
                  // The models in the order tried, Haiku last; their own part edits them.
                  // The chain's text gives way, never the button ("Add models ›" was cut off).
                  <Box key="settings-chain" flexDirection="row" gap={1} alignItems="center" flexShrink={1} minWidth={0}>
                    <Box flexShrink={1} minWidth={0}>
                      <Text dimColor wrap="truncate">{chain.length ? `${chain.map(routeLabel).join(' → ')} → Haiku` : 'No decision models'}</Text>
                    </Box>
                    <Box flexShrink={0}>
                      <Button key="settings-models-open" variant="secondary" label={chain.length ? 'Models ›' : 'Add models ›'} onPress={openCard('models')} />
                    </Box>
                  </Box>,
                ]
              : []),
            // The keys, Test and what it found on a row of their own, under the judge and its models.
            <Box key="judge-test-break" width="100%" height={0} />,
            ...(shown.judge !== 'haiku'
              ? [
                  ...(needsOpenRouter
                    ? [field('or-key-field', <Input key="settings-or-key" placeholder={hasOrKey ? 'OpenRouter key saved. Paste to replace' : 'Paste OpenRouter key'}
                        value={draft.openrouterKey ?? ''} submitLabel="ok" onInput={set('openrouterKey')} onSubmit={set('openrouterKey')} />, 34)]
                    : []),
                  ...(needsTypesafe
                    ? [field('key-field', <Input key="settings-key" placeholder={hasKey ? 'Key saved. Paste to replace' : 'Paste TypeSafe key'}
                        value={draft.key ?? ''} submitLabel="ok" onInput={set('key')} onSubmit={set('key')} />, 30)]
                    : []),
                ]
              : []),
            <Button key="settings-judge-test" variant="secondary" dimColor={tested?.ok === null} label={tested?.ok === null ? 'Testing…' : 'Test'}
              onPress={async () => {
                if (tested?.ok === null) return
                await update($, judgeTest, () => ({ ok: null, text: '' }))
                $.ui.invalidate('ui.render')
                const result = await testJudge($, shown.judge, shown.decisionModels, { openrouter: draft.openrouterKey, typesafe: draft.key })
                await update($, judgeTest, () => result)
                $.ui.invalidate('ui.render')
              }} />,
            ...(tested && tested.ok !== null
              ? [<Text key="settings-judge-result" color={tested.ok ? '#7fd49b' : '#ff8a80'} wrap="truncate">{`${tested.ok ? '✓' : '✗'} ${tested.text}`}</Text>]
              : []),
]) : card === 'handoff' ? (bare ? [] : [
            pick({ key: "settings-skill", label: "Handoff skill", value: shown.handoffSkill || '-', options: [
                { value: '-', label: 'effortless (built in)' },
                ...[...new Set([...(shown.handoffSkill ? [shown.handoffSkill] : []), ...skillNames])].map(name => ({ value: name, label: `/${name}` })),
              ], onSelect: v => set('handoffSkill')(v === '-' ? '' : v) }),
            // Which model writes a compaction's summary.
            pick({ key: "settings-compact-with", label: "Compact with", value: shown.compactWith, options: [{ value: 'haiku', label: 'Haiku' }, { value: 'session', label: "Chat's model" }], onSelect: set('compactWith') }),
            pick({ key: "settings-swamp", label: "Compact alert at", value: shown.swampAt, options: SWAMP_STEPS.map(n => ({ value: String(n), label: `${n}%` })), onSelect: set('swampAt') }),
            pick({ key: "settings-handoff-button", label: "Handoff button", value: shown.handoffButton, options: [{ value: 'advised', label: 'When advised' }, { value: 'always', label: 'Always' }], onSelect: set('handoffButton') }),
            ...alertToggles,
]) : [
            ...(bare
              ? []
              : [
                  pick({ key: "settings-layout", label: "Look", value: shown.layout, options: [{ value: 'default', label: 'Dashboard' }, { value: 'minimal', label: 'Minimal' }], onSelect: set('layout') }),
                  pick({ key: "settings-appearance", label: "Appearance", value: shown.appearance, options: [{ value: 'auto', label: term ? 'Match Claude Code' : 'Match app' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], onSelect: set('appearance') }),
                  pick({ key: "settings-theme", label: "Theme", value: shown.theme, options: [{ value: 'violet', label: 'Violet' }, { value: 'orange', label: 'Claude orange' }, { value: 'rose', label: 'Cherry blossom' }], onSelect: set('theme') }),
                ]),
            ...toggles,
            ...(bare ? [] : [uninstallButton($, themedEls($.ui.resolve(e)))]),
]}
              </Box>
            </Box>
          )}
        </Box>
      )
    }
    // The handoff bar: quick or full, then what follows, and a line saying what that does. Opened by ⇥ or the swamp
    // band's Handoff; Go keeps the choice for next time. Enter presses Go once the bar holds the keyboard.
    // The compact bar: an optional note for the summary, then Compact (or Enter).
    if (e.surface !== 'terminal' && (await read($, compactAsk))) {
      const { Input } = themedEls($.ui.resolve(e))
      const go = () => compactCold($, compactNote)
      const nowCompact = await $.clock.now()
      // One redraw once the fade is over, to drop its layer.
      if (nowCompact - compactOpenedAt < COMPACT_FADE_MS) $.clock.after(COMPACT_FADE_MS + 150 - (nowCompact - compactOpenedAt), () => $.ui.invalidate('ui.render'))
      return (
        <Box key="compact-bar" position="relative" flexDirection="row" alignItems="center" paddingX={1} overflow="hidden"
          backgroundColor={BRAND_BG} borderStyle="round" borderColor={BRAND_EDGE}>
          <Box key="compact-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={BRAND_SVG} alt="effortless" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
          {/* Opening from the swamped band: its green fades out over the violet, then the entrance sweep. */}
          {nowCompact - compactOpenedAt < COMPACT_FADE_MS + 100 ? (
            <Box key="compact-fade" position="absolute" top={-1} left={0} right={0} bottom={-1}>
              <Svg source={compactFadeSvg(nowCompact - compactOpenedAt)} alt="" width={1600} height={240} />
            </Box>
          ) : null}
          {introLayer({ Box, Svg }, 'compact', await introShows($, 'compact'))}
          {/* One line, as tall as the bands: the name, then the field and the buttons on the right. */}
          <Box key="compact-words" position="relative" flexShrink={0}>
            {markTitle({ Box, Text, Svg }, 'compact-title', ACCENT, '✦ Compact')}
            <Box key="compact-switch-box" position="relative" flexShrink={0} marginLeft={1}>
              <Box position="absolute" top={0} left={0} />
              <Button key="compact-to-handoff" plain dimColor label="Handoff instead" onPress={async () => { await update($, compactAsk, () => false); await openHandoffBar($) }} />
            </Box>
          </Box>
          <Box key="compact-controls" position="relative" flexGrow={1} flexShrink={1} minWidth={0} flexDirection="row" justifyContent="flex-end" alignItems="center" gap={1}>
            <Box position="absolute" top={0} left={0} />
            {/* The field shows through a window anchored right: its own Enter hint (a submit button 12 px wide, 6 px
                after the field) is pushed past the window's right edge and clipped, whatever width the app gives the
                field. Three cells out, one cell of padding back: the field ends 2 px inside, the hint starts 4 px out. */}
            {/* The window reaches a row above and below the field (absolutely, so the bar stays one line): one line tall,
                it cut the field's focus ring off at the top and bottom. */}
            {/* It gives way before the Compact button does: in a narrow pane the field shrinks, the button stays. */}
            <Box key="compact-field" position="relative" width={48} minWidth={6} height={1} flexShrink={1}>
              <Box position="absolute" top={-1} bottom={-1} left={0} right={0} overflow="hidden">
                <Box position="absolute" top={0} bottom={0} right={-3} width={60} flexDirection="row" alignItems="center" justifyContent="flex-end" paddingRight={1}>
                  <Input key="compact-note" placeholder="Summary (optional)" submitLabel={'​'}
                      onInput={v => { compactNote = v }} onSubmit={v => { compactNote = v; void go() }} />
                </Box>
              </Box>
            </Box>
            {/* Compact with the Enter mark in it: a white pill drawn, the word in the app's font, the mark as Claude's prompt
                box draws its own, and a blank button over all three. A Button's label is text only, and ↵ there was a
                hairline. */}
            <Box key="compact-go-box" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
              <Box width={GO_CELLS} height={1} flexShrink={0} />
              <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                <Svg source={goPillSvg()} alt="Compact" width={GO_W} height={20} />
              </Box>
              <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center" justifyContent="center" gap={1}>
                <Text color="#141416">Compact</Text>
                <Svg source={enterSvg('#141416')} alt="Enter" width={14} height={14} />
              </Box>
              <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
                <Button key="compact-go" plain hover={{ backgroundColor: '#00000000' }} label={' '.repeat(GO_CELLS)} onPress={go} />
              </Box>
            </Box>
            <Box key="compact-close-box" position="relative" flexShrink={0}>
              <Box position="absolute" top={0} left={0} />
              <Button key="compact-close" plain label="✕" hover={{ backgroundColor: CARD_CLOSE_HOVER }} onPress={() => update($, compactAsk, () => false)} />
            </Box>
          </Box>
        </Box>
      )
    }
    const choice = await read($, handoffPick)
    if (choice) {
      const setBar = (change: Partial<HandoffChoice>) => async () => {
        if (change.kind && change.kind !== choice.kind) kindFlipAt = await $.clock.now()
        await update($, handoffPick, () => ({ ...choice, ...change }))
        // The write alone redraws the bar; a full invalidate redraws the art too, which flickers.
      }
      const { Input, Select } = themedEls($.ui.resolve(e))
      const what = handoffWhat(choice, config.handoffSkill)
      // What the next session is for, optional, for Quick and Full alike: Enter is Go.
      const focusField = (
        <Input key="handoff-focus" placeholder="Next session is for… (optional)" submitLabel={'​'}
          onInput={v => { handoffFocusDraft = v }} onSubmit={v => { handoffFocusDraft = v; void goHandoff($, choice) }} />
      )
      // Go is the one lit button: the picked kind is a quiet box, the other plain text. The app draws a hotkey's
      // letter faint on a grey button, so only the terminal gets letters there.
      const term = e.surface === 'terminal'
      const kindNow = await $.clock.now()
      const controls = [
        // Desktop: one switch with both words, the knob under the picked one (like Auto), each half a blank button.
        !term && Svg ? (
          <Box key="handoff-kind" position="relative" flexShrink={0} flexDirection="row" alignItems="center">
            <Box width={KIND_CELLS * 2} height={1} flexShrink={0} />
            <Box position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
              <Svg source={kindSwitchSvg(choice.kind, kindNow - kindFlipAt)} alt={choice.kind === 'full' ? 'Full handoff' : 'Quick handoff'} width={KIND_W} height={KIND_H} />
            </Box>
            <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center">
              {(['quick', 'full'] as const).map(k => (
                <Box key={`handoff-kind-${k}`} flexGrow={1} width={0} flexDirection="row" alignItems="center" justifyContent="center">
                  <Box flexShrink={0} width={2} alignItems="center"><Svg source={rowIconSvg(k, choice.kind === k ? '#141416' : DASH_DIM, choice.kind === k)} alt={k === 'quick' ? 'bolt' : 'pen'} width={14} height={14} /></Box>
                  {/* The picked word is on the knob, which keeps its colour whatever the app is (onKnob). */}
                  <Text color={choice.kind === k ? onKnob('#141416') : DASH_DIM}>{k === 'quick' ? 'Quick' : 'Full'}</Text>
                </Box>
              ))}
            </Box>
            <Box position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center">
              {(['quick', 'full'] as const).map(k => (
                <Box key={`handoff-kind-hit-${k}`} flexGrow={1} width={0} justifyContent="center">
                  <Button key={`handoff-${k}`} plain hover={{ backgroundColor: '#00000000' }} label={' '.repeat(KIND_CELLS)} onPress={setBar({ kind: k })} />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null,
        term || !Svg ? (choice.kind === 'quick' ? (
          <Button key="handoff-quick" hotkey={term ? 'q' : undefined} variant="secondary" label="Quick" onPress={setBar({ kind: 'quick' })} />
        ) : (
          <Button key="handoff-quick" hotkey={term ? 'q' : undefined} plain dimColor label="Quick" onPress={setBar({ kind: 'quick' })} />
        )) : null,
        term || !Svg ? (choice.kind === 'full' ? (
          <Button key="handoff-full" hotkey={term ? 'f' : undefined} variant="secondary" label="Full" onPress={setBar({ kind: 'full' })} />
        ) : (
          <Button key="handoff-full" hotkey={term ? 'f' : undefined} plain dimColor label="Full" onPress={setBar({ kind: 'full' })} />
        )) : null,
        <Select key="handoff-after" value={choice.after}
          options={[
            { value: 'continue', label: 'Clear & carry on' },
            { value: 'confirm', label: 'Clear & wait' },
            { value: 'copy', label: 'Keep chat & copy' },
          ]}
          onSelect={v => setBar({ after: v as HandoffAfter })()} />,
        <Button key="handoff-go" variant="primary" autoFocus label="Go" onPress={() => goHandoff($, choice)} />,
        <Button key="handoff-close" plain role="dismiss" label="✕" onPress={() => closeHandoffBar($)} />,
      ]
      // The terminal says all of it; the desktop bar only what the picked kind does: the dropdown beside it already
      // says what happens after.
      const line = e.surface === 'terminal' ? `${what.by}. ${what.then}` : choice.kind === 'full' ? (config.handoffSkill ? `/${config.handoffSkill}` : 'Checks git, saves HANDOFF.md') : 'A few seconds'
      if (e.surface === 'terminal') return terminalPanel($, e, 'handoff-bar', '⇥ Handoff', line, [focusField, ...controls])
      return (
        // The art is a still image here: an animated one sits in a frame the app rebuilds on every redraw, and the bar
        // redraws on every choice. Two rows, so nothing has to share: the name and what the picked kind does on the left
        // of the first, the controls on its right; the focus field across the second, Compact instead after it. Each
        // control's box holds an empty absolute child, which makes it positioned and paints it over the art (a plain flow
        // box sits under the art and takes no clicks).
        <Box key="handoff-bar" position="relative" flexDirection="column" paddingX={1} overflow="hidden"
          backgroundColor={BRAND_BG} borderStyle="round" borderColor={BRAND_EDGE}>
          <Box key="handoff-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={BRAND_SVG} alt="effortless" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
          {/* The entrance as the bar opens, only then: a choice redraws the bar. */}
          {introLayer({ Box, Svg }, 'handoff', await introShows($, 'handoff'))}
          {/* The words give way first (the line, then the name); the controls keep their width. */}
          <Box key="handoff-row" flexDirection="row" alignItems="center" gap={1}>
            <Box key="handoff-words" position="relative" flexDirection="row" alignItems="center" gap={1} flexGrow={1} flexShrink={1} minWidth={0}>
              <Box flexShrink={0}>
                <Text color={ACCENT} bold wrap="truncate">
                  ⇥ Handoff
                </Text>
              </Box>
              <Box key="handoff-what-box" flexShrink={1} minWidth={0}>
                <Text key="handoff-what" dimColor wrap="truncate">
                  {line}
                </Text>
              </Box>
            </Box>
            <Box key="handoff-actions" position="relative" flexShrink={0} flexDirection="row" gap={1} alignItems="center">
              <Box position="absolute" top={0} left={0} />
              {controls}
            </Box>
          </Box>
          <Box key="handoff-gap" height={0.5} />
          {/* The field in a window like Compact's note, anchored right: its own Enter hint (a 12 px submit button) is
              pushed past the window's right edge and clipped. The app gives the field its own width (about 32 cells, it
              does not stretch), so the window is a little wider and the field starts near the bar's left edge. The
              window reaches a row above and below the field, so its focus ring is not cut. */}
          <Box key="handoff-row-focus" flexDirection="row" alignItems="center" gap={2}>
            <Box key="handoff-field" position="relative" width={34} minWidth={8} height={1} flexShrink={1}>
              <Box position="absolute" top={-1} bottom={-1} left={0} right={0} overflow="hidden">
                <Box position="absolute" top={0} bottom={0} right={-3} width={46} flexDirection="row" alignItems="center" justifyContent="flex-end" paddingRight={1}>
                  {focusField}
                </Box>
              </Box>
            </Box>
            <Box flexGrow={1} />
            {!term ? (
              <Box key="handoff-to-compact-box" position="relative" flexShrink={0}>
                <Box position="absolute" top={0} left={0} />
                <Button key="handoff-to-compact" plain dimColor label="Compact instead" onPress={async () => { await closeHandoffBar($); await openCompact($, e) }} />
              </Box>
            ) : null}
          </Box>
        </Box>
      )
    }
    // The setup guide, one step at a time: the judge (and only what that judge needs), the lean, the handoff, the
    // footer, then a word on what else is there. The choices are saved together at Done or ✕ (see setupDraft).
    const step = await read($, setupStep)
    if (step) {
      const { Input, Select } = themedEls($.ui.resolve(e))
      const draft = await read($, setupDraft)
      const shown = setupShown(draft, config)
      const pick = (field: keyof SettingsDraft, value: string) => update($, setupDraft, d => ({ ...d, [field]: value }))
      const go = (to: SetupStep | null) => () => goSetup($, to)
      const back = setupBack(step)
      const counter = setupCounter(step)
      // The ✕ closes the guide without picking: until a judge is picked the footer keeps offering "Setup".
      const nav = (forward: unknown) => [
        ...(back ? [<Button key="setup-back" plain dimColor label="Back" onPress={go(back)} />] : []),
        forward,
        <Button key="setup-close" plain role="dismiss" label="✕" onPress={() => closeSetup($)} />,
      ]
      const nextButton = <Button key="setup-next" variant="primary" label="Next" onPress={go(setupNext(step))} />
      // The title over one line of words on the left, the controls on the right. The controls are their own absolute
      // layer, drawn last: the app draws anything in the flow under the absolute art, where it takes no clicks
      // (position="relative" does not lift it). The spacer keeps the words clear of them; room is their width in
      // columns. The art is still: every click redraws the band.
      const band = (words: unknown, room: number, controls: unknown[]) => e.surface === 'terminal' ? (
        terminalPanel($, e, 'setup', counter ? `✦ effortless setup  ${counter}` : '✦ effortless setup', words, controls)
      ) : (
        <Box key="setup" position="relative" flexDirection="row" alignItems="center" paddingX={1} overflow="hidden"
          backgroundColor={BRAND_BG} borderStyle="round" borderColor={BRAND_EDGE}>
          <Box key="setup-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={BRAND_SVG} alt="effortless" width={FROST_WIDTH * 2} height={FROST_HEIGHT * 2} />
          </Box>
          <Box key="setup-words" position="relative" flexDirection="column" flexShrink={1} minWidth={0}>
            <Text color={ACCENT} bold wrap="truncate">
              {counter ? `✦ effortless setup  ${counter}` : '✦ effortless setup'}
            </Text>
            {typeof words === 'string' ? <Text key="setup-what" wrap="truncate">{words}</Text> : words}
          </Box>
          <Box flexGrow={1} minWidth={room} />
          <Box key="setup-actions" position="absolute" top={0} right={1} bottom={0} flexDirection="row" gap={1} alignItems="center">
            {controls}
          </Box>
        </Box>
      )
      if (step === 'pick')
        return band('Haiku judges. Add a decision model too?', 62, [
          // Haiku first and filled: it needs no key. A decision model is the optional faster one; with a key, it is tried first and
          // Haiku stands in whenever it does not answer. Each mark sits tight against its own button.
          <Box key="pick-haiku" flexDirection="row" gap={1} alignItems="center">
            <Svg source={CLAUDE_MARK} alt="Claude" width={16} height={16} />
            <Button key="setup-haiku" variant="primary" label="Just Haiku (no key)" onPress={() => pickJudge($, 'haiku')} />
          </Box>,
          <Box key="pick-decision" flexDirection="row" gap={1} alignItems="center">
            <Svg source={TYPESAFE_MARK} alt="TypeSafe" width={12} height={18} />
            <Button key="setup-decision" variant="secondary" label="Add a decision model" onPress={() => pickJudge($, 'decision')} />
          </Box>,
          ...nav(
            <Button key="setup-skip" plain dimColor label="Skip" onPress={async () => {
              await markSetupDone($)
              await goSetup($, 'lean')
            }} />,
          ),
        ])
      // Fork: where a decision model runs. Zen's free Jev needs no key; OpenRouter and TypeSafe each take theirs in a step of its own.
      const withMark = (key: string, mark: { source: string; alt: string; width: number; height: number }, button: unknown) => (
        <Box key={key} flexDirection="row" gap={1} alignItems="center">
          {Svg ? <Svg source={mark.source} alt={mark.alt} width={mark.width} height={mark.height} /> : null}
          {button}
        </Box>
      )
      if (step === 'decision')
        return band('Where should the decision model run?', 96, [
          withMark('decision-zen', { source: OPENCODE_MARK, alt: 'OpenCode', width: 13, height: 16 },
            <Button key="setup-zen" variant="primary" label="Free Jev on OpenCode Zen (no key)" onPress={async () => {
              await update($, setupDraft, d => ({ ...d, judge: 'auto', decisionModels: 'opencode/jev-1.13-free' }))
              await goSetup($, 'lean')
            }} />),
          withMark('decision-openrouter', { source: OPENROUTER_MARK, alt: 'OpenRouter', width: 16, height: 12 },
            <Button key="setup-openrouter" variant="secondary" label="Add OpenRouter key" onPress={go('decision-openrouter')} />),
          withMark('decision-typesafe', { source: TYPESAFE_MARK, alt: 'TypeSafe', width: 12, height: 18 },
            <Button key="setup-typesafe" variant="secondary" label="TypeSafe key" onPress={go('decision-typesafe')} />),
          ...nav(<Button key="setup-skip" plain label="Skip" onPress={go('lean')} />),
        ])
      if (step === 'decision-openrouter')
        return band('Key from openrouter.ai:', 52, [
          <Box key="or-key-field" width={30} flexShrink={1}>
            <Input key="setup-or-key" placeholder="OpenRouter key" value={draft.openrouterKey ?? ''} submitLabel="Save"
              onInput={(v: string) => pick('openrouterKey', v)}
              onSubmit={async (v: string) => {
                if (!v.trim()) return
                await update($, setupDraft, d => ({ ...d, openrouterKey: undefined }))
                if (!(await saveOpenRouterKey($, v))) return
                // Zen's free Jev first; d1-ultra on OpenRouter when Zen does not answer.
                await update($, setupDraft, d => ({ ...d, judge: 'auto', decisionModels: 'opencode/jev-1.13-free, openrouter/liquid/d1-ultra' }))
                await goSetup($, 'lean')
              }} />
          </Box>,
          ...nav(<Button key="setup-skip" plain label="Skip" onPress={go('lean')} />),
        ])
      if (step === 'decision-typesafe')
        return band('Key from typesafe.ai:', 52, [
          <Box key="key-field" width={30} flexShrink={1}>
            <Input key="setup-key" placeholder="TypeSafe key" value={draft.key ?? ''} submitLabel="Save"
              onInput={(v: string) => pick('key', v)}
              onSubmit={async (v: string) => {
                if (!v.trim()) return
                await update($, setupDraft, d => ({ ...d, key: undefined }))
                if (!(await saveTypesafeKey($, v))) return
                await update($, setupDraft, d => ({ ...d, decisionModels: withTypesafeRoute(d.decisionModels) }))
                await goSetup($, 'lean')
              }} />
          </Box>,
          ...nav(<Button key="setup-skip" plain label="Skip" onPress={go('lean')} />),
        ])
      if (step === 'lean') {
        // Five stops, the marker on the one picked. The track is lit in purple from the middle out to the marker, so it
        // shows which way it leans, and the words name the stop and say what it does.
        const lean = shown.bias
        const track: unknown[] = []
        for (const n of [-2, -1, 0, 1, 2]) {
          if (n > -2) {
            const lit = lean > 0 ? n > 0 && n <= lean : lean < 0 ? n <= 0 && n > lean : false
            track.push(lit ? <Text key={`t${n}`} color={ACCENT}>──</Text> : <Text key={`t${n}`} dimColor>──</Text>)
          }
          track.push(<Button key={`setup-bias${n + 2}`} plain label={n === lean ? '◉' : '○'} onPress={() => pick('bias', String(n))} />)
        }
        const [name, does] = LEAN_STOPS[lean + 2]
        const side = (label: string, lit: boolean) =>
          lit ? <Text key={label} color={ACCENT}>{label}</Text> : <Text key={label} dimColor>{label}</Text>
        return band(
          <Box key="setup-what" flexDirection="row" flexShrink={1} minWidth={0}>
            <Text color={ACCENT} bold wrap="truncate">{`${name}: `}</Text>
            <Text wrap="truncate">{does}</Text>
          </Box>,
          62,
          [
            side('Cheaper', lean < 0),
            <Box key="track" flexDirection="row" alignItems="center">
              {track}
            </Box>,
            side('Smarter', lean > 0),
            ...nav(nextButton),
          ],
        )
      }
      if (step === 'handoff') {
        const skillNames = await read($, installedSkills)
        return band('Who writes a Full ⇥ handoff?', 48, [
          <Select key="setup-skill" value={shown.handoffSkill || '-'}
            options={[
              { value: '-', label: 'effortless (built in)' },
              ...[...new Set([...(shown.handoffSkill ? [shown.handoffSkill] : []), ...skillNames])].map(name => ({ value: name, label: `/${name}` })),
            ]}
            onSelect={(v: string) => pick('handoffSkill', v === '-' ? '' : v)} />,
          ...nav(nextButton),
        ])
      }
      if (step === 'look') {
        // Match is the default: Claude Code's theme in the terminal, the app's own light or dark elsewhere (theme.ts,
        // setMatchApp). The other two fix it. The choice shows at once.
        const mode = shown.appearance
        const matchLabel = e.surface === 'terminal' ? 'Match Claude Code' : 'Match app'
        return band('Dark or light panels?', 56, [
          ...(['auto', 'dark', 'light'] as const).map(value => (
            <Button key={`setup-look-${value}`} plain label={`${mode === value ? '◉' : '○'} ${{ auto: matchLabel, dark: 'Dark', light: 'Light' }[value]}`} onPress={() => pick('appearance', value)} />
          )),
          ...nav(nextButton),
        ])
      }
      return band('⏻ Auto on or off. ⚙ all settings.', 24, [
        ...nav(<Button key="setup-done" variant="primary" autoFocus label="Done" onPress={() => finishSetup($)} />),
      ])
    }
    // The judge the person picked is failing: Haiku stands in until it works again.
    const downReason = await read($, judgeDown)
    if (downReason && !config.hide.includes('down') && downReason !== (await read($, judgeDownHidden))) {
      if (e.surface === 'terminal')
        return terminalBand($, e, {
          key: 'down', kind: 'down', color: SLATE, bg: SLATE_BG, edge: SLATE_EDGE, title: 'Judge down',
          detail: `${downReason}. Haiku stands in.`,
          buttons: [
            <Button key="down-settings" variant="primary" hotkey="s" label="Settings" onPress={() => openPluginSettings($)} />,
            <Button key="down-close" plain role="dismiss" label="✕" onPress={() => update($, judgeDownHidden, () => downReason)} />,
          ],
        })
      return (
        <Box key="down" position="relative" flexDirection="row" gap={1} alignItems="center" paddingX={1} overflow="hidden"
          backgroundColor={SLATE_BG} borderStyle="round" borderColor={SLATE_EDGE}>
          <Box key="down-art" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={DOWN_SVG} alt="judge down" width={FROST_WIDTH} height={FROST_HEIGHT} />
          </Box>
          {introLayer({ Box, Svg }, 'down', await introShows($, 'down'), '#7d8aa8', '#e6ecf8')}
          <Box flexShrink={0}>
            <Text color={SLATE} bold wrap="truncate">
              ✦ Judge down
            </Text>
          </Box>
          <Text wrap="truncate">{`${downReason}. Haiku stands in.`}</Text>
          <Box flexGrow={1} minWidth={30} />
          <Box key="down-actions" position="absolute" top={0} right={1} bottom={0} flexDirection="row" gap={1} alignItems="center">
            <Button key="down-settings" variant="primary" label="Open settings" onPress={() => openPluginSettings($)} />
            <Button key="down-close" plain role="dismiss" label="✕" onPress={() => update($, judgeDownHidden, () => downReason)} />
          </Box>
        </Box>
      )
    }
    // A usage limit is close: Save mode keeps Auto at medium or below until it resets.
    const heat = await read($, hot)
    if (heat && !config.hide.includes('hot') && hotVisible(heat, await hotClosedNow($))) {
      const saving = (await read($, saveUntil)) !== null
      const window = heat.kind === 'five_hour' ? '5h' : 'weekly'
      const resets = resetLabel(heat.resetsAt, await $.clock.now())
      if (e.surface === 'terminal')
        return terminalBand($, e, {
          key: 'hot', kind: 'hot', color: EMBER, bg: EMBER_BG, edge: EMBER_EDGE, title: 'Running hot',
          detail: `${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ''}`,
          buttons: [
            <Button key="hot-save" variant="primary" hotkey="s" label={saving ? 'Save mode on' : 'Save mode'}
              onPress={async () => { $.ui.toast(`effortless: ${await toggleSave($)}`) }} />,
            <Button key="hot-close" plain role="dismiss" label="✕" onPress={() => closeHot($, heat)} />,
          ],
        })
      return (
        <Box key="hot" position="relative" flexDirection="row" gap={1} alignItems="center" paddingX={1} overflow="hidden"
          backgroundColor={EMBER_BG} borderStyle="round" borderColor={EMBER_EDGE}>
          <Box key="ember" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={EMBER_SVG} alt="embers" width={FROST_WIDTH} height={FROST_HEIGHT} />
          </Box>
          {introLayer({ Box, Svg }, 'hot', await introShows($, 'hot'), EMBER, '#ffd2a8')}
          <Box flexShrink={0}>
            <Text color={EMBER} bold wrap="truncate">
              ✦ Running hot
            </Text>
          </Box>
          <Text wrap="truncate">{`${Math.round(heat.percent)}% of your ${window} limit used${resets ? ` · resets ${resets}` : ''}`}</Text>
          <Box flexGrow={1} minWidth={30} />
          <Box key="hot-actions" position="absolute" top={0} right={1} bottom={0} flexDirection="row" gap={1} alignItems="center">
            <Button
              key="hot-save"
              variant="primary"
              label={saving ? 'Save mode on' : 'Save mode'}
              onPress={async () => {
                $.ui.toast(`effortless: ${await toggleSave($)}`)
              }}
            />
            <Button key="hot-close" plain role="dismiss" label="✕" onPress={() => closeHot($, heat)} />
          </Box>
        </Box>
      )
    }
    // A handoff or compact running or just done: said above the prompt, where it is seen at once.
    const savedAt = (await $.store.get('settingsSavedAt').catch(() => null)) as number | null
    if (typeof savedAt === 'number') {
      const since = (await $.clock.now().catch(() => Date.now())) - savedAt
      if (since >= 0 && since < SAVED_CARD_MS) {
        $.clock.after(SAVED_CARD_MS - since + 50, () => $.ui.invalidate('ui.render'))
        return savedCardTree($, e)
      }
    }
    const compactNow = e.surface === 'terminal' ? null : await compactCard($, !!e.props.isWorking)
    if (compactNow)
      return handoffCardTree($, e, compactNow, undefined,
        !cardRunning(compactNow.kind) ? () => update($, handoffCard, card => (card && !cardRunning(card.kind) ? null : card)) : undefined)
    // The cache went cold: the next message rereads the whole chat at full price. Only worth a band on a big chat.
    const compacting = await read($, isCompacting)
    const coldTokens = compacting ? null : await coldWorth($)
    if (coldTokens !== null) {
      // The slot the app gives the band is narrower than it was (it has a frame of its own now): the long line ended in
      // an ellipsis in front of the buttons, so a narrow band says the same in fewer words.
      const narrow = typeof e.props.bodyColumns === 'number' && e.props.bodyColumns < 115
      const line = narrow ? `Rereads ${kTokens(coldTokens)} tokens at full price.` : `Next message rereads ${kTokens(coldTokens)} tokens at full price.`
      if (e.surface === 'terminal')
        return terminalBand($, e, {
          key: 'cold', kind: 'cold', color: ICE, bg: ICE_BG, edge: ICE_EDGE, title: 'Chat went cold',
          detail: `${line} Hand off or compact first.`,
          buttons: [
            <Button key="cold-hide" plain hotkey="n" label="Not now" onPress={() => update($, isColdHidden, () => true)} />,
            <Button key="cold-compact" hotkey="c" label="Compact" onPress={() => openCompact($, e)} />,
            <Button key="cold-handoff" variant="primary" hotkey="h" label="Handoff" onPress={() => openHandoffBar($)} />,
          ],
        })
      // The art is a backdrop: an absolutely placed layer behind the right side, so the words and buttons sit on it.
      return (
        <Box
          key="cold"
          position="relative"
          flexDirection="row"
          gap={1}
          alignItems="center"
          paddingX={1}
          overflow="hidden"
          backgroundColor={ICE_BG}
          borderStyle="round"
          borderColor={ICE_EDGE}
        >
          {/* Taller than the band and clipped by it, so the frost reaches every edge on the right. */}
          <Box key="frost" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={FROST_SVG} alt="frost" width={FROST_WIDTH} height={FROST_HEIGHT} />
          </Box>
          <Box key="cold-glow" position="absolute" top={0} left={0} right={0} bottom={0}>
            <Svg source={inPhase(coldGlowSvg(), (await $.clock.now()) % COLD_GLOW_MS)} alt="cold glow" width={AUTO_GLOW_W} height={AUTO_GLOW_H} />
          </Box>
          {introLayer({ Box, Svg }, 'cold', await introShows($, 'cold'), ICE, '#cfeeff')}
          <Box flexShrink={0}>
            <Text color={ICE} bold wrap="truncate">
              ✦ Chat went cold
            </Text>
          </Box>
          <Text wrap="truncate">{line}</Text>
          {/* Room for the buttons, which sit in their own layer after the frost so they are drawn on top of it. */}
          <Box flexGrow={1} minWidth={34} />
          <Box key="cold-actions" position="absolute" top={0} right={1} bottom={0} flexDirection="row" gap={1} alignItems="center">
            <Button key="cold-hide" plain label="Not now" onPress={() => update($, isColdHidden, () => true)} />
            <Button key="cold-compact" variant="secondary" label="Compact" onPress={() => openCompact($, e)} />
            <Button key="cold-handoff" variant="primary" label="Handoff" onPress={() => openHandoffBar($)} />
          </Box>
        </Box>
      )
    }
    // The context is swamped: every message re-reads all of it. Compact or hand off, right here.
    const swampTokens = await read($, swamped)
    const hiddenAt = await read($, swampHiddenAt)
    if (swampTokens !== null && !config.hide.includes('swamp') && !turnBusy() && !compacting && (hiddenAt === null || swampTokens >= hiddenAt + SWAMP_REGROW)) {
      const handing = (await read($, handoffStage)) !== null
      if (e.surface === 'terminal')
        return terminalBand($, e, {
          key: 'swamp', kind: 'swamp', color: BOG, bg: BOG_BG, edge: BOG_EDGE, title: 'Chat is getting swamped',
          detail: `${Math.round(swampTokens / 1000)}k tokens${lastContext && lastContext.window ? ` (${lastContext.percent}% of context)` : ''} re-read every message.`,
          buttons: [
            <Button key="swamp-compact" variant="primary" label="Compact" onPress={() => openCompact($, e)} />,
            <Button key="swamp-handoff" label={handing ? 'Handing off…' : 'Handoff'} onPress={() => openHandoffBar($)} />,
            <Button key="swamp-close" plain role="dismiss" label="✕" onPress={() => update($, swampHiddenAt, () => swampTokens)} />,
          ],
        })
      return (
        <Box
          key="swamp"
          position="relative"
          flexDirection="row"
          gap={1}
          alignItems="center"
          paddingX={1}
          overflow="hidden"
          backgroundColor={BOG_BG}
          borderStyle="round"
          borderColor={BOG_EDGE}
        >
          <Box key="bog" position="absolute" top={-1} right={0} bottom={-1}>
            <Svg source={SWAMP_SVG} alt="swamp" width={FROST_WIDTH} height={FROST_HEIGHT} />
          </Box>
          {introLayer({ Box, Svg }, 'swamp', await introShows($, 'swamp'), '#6f9a4f', '#d6ecc2')}
          <Box flexShrink={0}>
            <Text color={BOG} bold wrap="truncate">
              ✦ Chat is getting swamped
            </Text>
          </Box>
          {/* How full the context is, as a ring and a figure: the tokens alone do not say how close the limit is. */}
          {lastContext && lastContext.window ? (
            <Box key="swamp-ring" flexShrink={0} flexDirection="row" gap={1} alignItems="center">
              <Svg source={ringSvg(lastContext.percent, BOG)} alt={`${lastContext.percent}% of context`} width={16} height={16} />
              <Text color={BOG}>{`${lastContext.percent}%`}</Text>
            </Box>
          ) : null}
          <Text wrap="truncate">
            {`${Math.round(swampTokens / 1000)}k tokens re-read every message.`}
          </Text>
          <Box flexGrow={1} minWidth={34} />
          <Box key="swamp-actions" position="absolute" top={0} right={1} bottom={0} flexDirection="row" gap={1} alignItems="center">
            <Button key="swamp-compact" variant="primary" label="Compact" onPress={() => openCompact($, e)} />
            <Button key="swamp-handoff" label={handing ? 'Handing off…' : 'Handoff'} onPress={() => openHandoffBar($)} />
            <Button key="swamp-close" plain role="dismiss" label="✕" onPress={() => update($, swampHiddenAt, () => swampTokens)} />
          </Box>
        </Box>
      )
    }
    // At rest: the dashboard, unless the person picked the minimal look (the footer's buttons, no band).
    if (config.layout === 'default') {
      return dashboardBand($, e)
    }
    // The minimal look draws no dashboard: mark the rest here, so the next band plays its entrance.
    introKind = 'rest'
    return (await effortRows($, e)) ?? next(e)
    } catch (error) {
      lastRenderError = (error instanceof Error ? error.message : String(error)).slice(0, 300)
      return next(e)
    } finally {
      if (glowReadAt !== null) {
        drawLead = drawLead * 0.7 + Math.min(150, Date.now() - glowReadAt + 16) * 0.3
        glowReadAt = null
      }
      // How long the draws take, for the first few after a load: the render log says where a slow start goes.
      if (drawsTimed < 5) {
        drawsTimed++
        renderLog.push(`${new Date().toISOString()} ${loadedSession} draw took ${Date.now() - lastRenderAt} ms`)
      }
    }
  })
}
