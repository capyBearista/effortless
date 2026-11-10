import type { EngineInterface } from 'claude-code'
import type { Answers, Effort, JudgedModel, ModelAnswer, Pick } from '../types'
import { EFFORTS } from './config'

// The models the judge answers for, each on its own scale.
const JUDGED: readonly JudgedModel[] = ['haiku', 'sonnet', 'opus', 'fable']

// The text is decisionbench's tuned prompt plus effortless's rules: on its 59 holdout Cases it scored a mean lift of 21.2 points
// over 6 decision models, against 13.9 for the old text. The Haiku-as-judge path is not measured.
const MODEL_LEVELS: Record<JudgedModel, { instructions: string; levels: Record<Effort, string> }> = {
  haiku: {
    instructions: 'Which effort should Claude Haiku use for the next message? Haiku is the smallest model, so it needs more effort than a larger model for the same work: the same as the work alone suggests for a quick answer or trivial step, and one level more for any real task such as a fix, a feature, an analysis or a plan.',
    levels: {
      low: 'quick answer or trivial action: no tools or one simple step, no planning',
      medium: 'normal work: a few tool calls or edits',
      high: 'a normal task: a fix, a feature, an analysis or a plan',
      xhigh: 'very hard: a long investigation or complex change',
      max: 'the hardest research-level work',
    },
  },
  sonnet: {
    instructions: 'Which effort should Claude Sonnet use for the next message?',
    levels: {
      low: 'quick answer or trivial action: no tools or one simple step, no planning',
      medium: 'normal work: a few tool calls or edits',
      high: 'hard or large multi-step job: many tool calls, mistakes are costly',
      xhigh: 'very hard: a long investigation or complex change',
      max: 'the hardest research-level work',
    },
  },
  opus: {
    instructions: 'Which effort should Claude Opus use for the next message? Opus is a strong model, so it needs less effort than a smaller model for the same work: one level lower than the work alone suggests. Ordinary focused work (an explanation, a contained fix, a small feature) is low for Opus.',
    levels: {
      low: 'quick answer or trivial action: no tools or one simple step, no planning',
      medium: 'normal work: a few tool calls or edits',
      high: 'hard or large multi-step job: many tool calls, mistakes are costly',
      xhigh: 'very hard: a long investigation or complex change',
      max: 'the hardest research-level work',
    },
  },
  fable: {
    instructions: 'Which effort should Claude Fable use for the next message? Fable is the strongest model, so it needs the least effort for the same work: one or two levels lower than the work alone suggests. Ordinary focused work (an explanation, a contained fix, a small feature) is low for Fable.',
    levels: {
      low: 'a quick answer or everyday work: an explanation, a contained fix, a small feature',
      medium: 'normal work: a few tool calls or edits',
      high: 'hard or large multi-step job: many tool calls, mistakes are costly',
      xhigh: 'very hard: a long investigation or complex change',
      max: 'the hardest research-level work',
    },
  },
}

// How to judge, for Haiku and the decision models alike. It never names the effort in force: the judge rates the
// task; keeping an effort (a "go" between steps, a message typed while a task runs) is effortless's own decision.
const EFFORT_RULES = `Judge the scope and the amount of work, not whether it is code. A short message can ask for a lot: "go through my whole drive and clean it up", "review the entire repo", "migrate everything" are big, multi-step, tool-heavy jobs where mistakes are costly. Low is only for answers that need no tools and no planning.

If the message answers a question in the assistant's last reply (picks an option, says which one, confirms a plan), judge only the work that answer starts, as the reply describes it, not the length of the answer and not the work done before the question: "B" can mean "build the complicated section B" (high), while "yes" or "no" to one small action ("should I archive this?", "delete the old ones too?") is low, and picking a value for one setting (a log level, a colour, a font) is low. But picking which way to build something ("option 1", "the same shapes", "B") starts that build: judge the build. Approving a whole plan or several steps takes the effort of that plan. A plain "yes", "ok" or "do it" after "Is that OK? Then I'll build X" or "Should I build X?" approves building X: judge X, not the word.

A message that pushes back on, corrects or adds to a plan or claim under discussion continues that work: judge the effort that work needs, never low. Thanks, praise or a closing remark with no new request is low. A question about how to do something, or about effort itself, that needs no tools is low.

If the person asks for deep thought ("think hard", "ultrathink", "be thorough"), pick at least high; if they ask for a quick answer, pick low.

Effort levels mean a different amount of thinking on each model, so answer for each model on its own scale: the same task can need different levels on different models.`

export const JUDGE_SYSTEM = `You choose the reasoning effort an agentic assistant (it reads files, runs tools and edits things, not only code) should use for the user's next message: the cheapest effort that will still do the job well, once for each Claude model below.

${JUDGED.map(m => `${m}: ${MODEL_LEVELS[m].instructions}\n${EFFORTS.map(e => `- ${e}: ${MODEL_LEVELS[m].levels[e]}`).join('\n')}`).join('\n\n')}

${EFFORT_RULES}

Reply with JSON only: {${JUDGED.map(m => `"${m}":"low|medium|high|xhigh|max"`).join(',')},"sure":0.0-1.0 how sure you are,"why":"at most 6 words, in the user's language"}`

/** A judge's answer: its effort for each model it answered for, and who said it. */
export type Verdict = { efforts: Answers; why: string; by: 'decision' | 'haiku'; judgeName?: string }

/** Haiku's reply as a verdict: an effort per model, one sure and why. A model with no valid level is left out; nothing
 * when no model has one. */
export function parseVerdict(text: string): Verdict | undefined {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null) return undefined
  const o = raw as Record<string, unknown>
  const sure = typeof o.sure === 'number' && o.sure >= 0 && o.sure <= 1 ? o.sure : undefined
  const efforts: Answers = {}
  for (const m of JUDGED) {
    if (EFFORTS.includes(o[m] as Effort)) efforts[m] = sure === undefined ? { effort: o[m] as Effort } : { effort: o[m] as Effort, sure }
  }
  if (!Object.keys(efforts).length) return undefined
  return { efforts, why: typeof o.why === 'string' ? o.why.slice(0, 60) : '', by: 'haiku' }
}

/**
 * What the judge reads besides the new message: the person's previous message and the assistant's last reply. The
 * reply is kept long and from its end, where a question with options ("A, B or C?") sits: "B" alone looks like a
 * small job, the reply says what B sets off.
 */
export async function recentContext($: EngineInterface): Promise<string> {
  return contextFrom(await $.session.messages())
}

/** The context text from the conversation so far: the last user message, short, and the assistant's last reply's end. */
export function contextFrom(messages: readonly { role: string; text: string }[]): string {
  // A turn with no text of its own (a tool result, an image) says nothing: the person's last words are what count.
  const lastUser = [...messages].reverse().find(m => m.role === 'user' && m.text.trim())
  const lastAssistant = lastAssistantText(messages)
  return [lastUser ? `user: ${lastUser.text.slice(0, 400)}` : '', lastAssistant ? `assistant: ${lastAssistant.slice(-2000)}` : '']
    .filter(Boolean)
    .join('\n')
}

/** The assistant's last reply, or nothing. */
function lastAssistantText(messages: readonly { role: string; text: string }[]): string {
  return [...messages].reverse().find(m => m.role === 'assistant' && m.text.trim())?.text ?? ''
}


// The decision models' task: the same rules as Haiku's, one typed question per model.
export const DECISION_TASK = `Choose the reasoning effort that an agentic AI assistant should use to handle the next message, for each model asked about. The assistant can read files, run tools and edit things, not only write code. Judge the scope and difficulty of the work the message asks for, taking the recent conversation into account. Pick the cheapest effort that still does the job well for that model.

${EFFORT_RULES}`
export const DECISION_QUESTIONS = Object.fromEntries(
  JUDGED.map(m => [`effort_${m}`, { type: 'choice', instructions: MODEL_LEVELS[m].instructions, criteria: MODEL_LEVELS[m].levels }]),
)

/** The skill or custom command a typed "/name args" runs, or nothing for the app's own commands and effortless's. */
export async function typedSkill($: EngineInterface, text: string): Promise<{ name: string; description: string } | undefined> {
  const name = text.trim().slice(1).split(/\s+/)[0]
  if (!name) return undefined
  const found = (await $.command.list().catch(() => [])).find(c => c.name === name)
  if (!found || !['user', 'plugin', 'mcp'].includes(found.source) || found.plugin === 'effortless') return undefined
  return { name, description: found.description ?? '' }
}

const LEVEL_WORD = '(low|medium|high|xhigh|x-high|extra[- ]high|max|maximum)'
const NAMED_LEVEL = new RegExp(`\\b${LEVEL_WORD}\\s+effort\\b|\\beffort(?:\\s+level)?\\s*(?:[:=]|to|at|of|on)?\\s*${LEVEL_WORD}\\b|\\bxhigh\\b`, 'gi')
const LEVEL_OF: Record<string, Effort> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', 'x-high': 'xhigh', 'extra high': 'xhigh', 'extra-high': 'xhigh', max: 'max', maximum: 'max' }

/**
 * The level a prompt asks for by name ("max effort", "effort: high", "xhigh"), or nothing. The word effort must sit
 * beside the level, so "a medium sized image" names nothing, and "don't use max effort" is a no. A named level runs
 * without the judge: effort-auto found Haiku also calls prompts that only describe hard work "named".
 */
export function namedEffort(text: string): Effort | undefined {
  for (const m of text.matchAll(NAMED_LEVEL)) {
    const before = text.slice(Math.max(0, m.index - 20), m.index).toLowerCase()
    if (/\b(not|no|don'?t|never|without|instead of)\b/.test(before)) continue
    return LEVEL_OF[(m[1] ?? m[2] ?? 'xhigh').toLowerCase().replace(/\s+/, ' ')]
  }
  return undefined
}

/** A short follow-up such as "go", "ok", "yes", "continue": two words and a dozen characters at most. */
export function isFollowUp(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 12 && t.split(/\s+/).length <= 2
}

/**
 * Whether the assistant's last reply ended on a question ("Should I archive it?", "A, B or C?"). A short message
 * after one answers it, and the answer can start a small or a big job, so it goes to the judge instead of keeping
 * the effort.
 */
export function endsOnQuestion(context: string): boolean {
  const reply = context.split('\nassistant: ').pop() ?? ''
  return context.includes('assistant: ') && reply.slice(-400).includes('?')
}

/** The message as the judge reads it: images and files it carries are named, since the judge sees only text. */
export function withAttachments(text: string, attachments?: readonly { type: string }[]): string {
  if (!attachments?.length) return text
  const counts = new Map<string, number>()
  for (const a of attachments) counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  const said = [...counts].map(([type, n]) => `${n} ${type}${n > 1 ? 's' : ''}`).join(', ')
  return `${text}

[The message comes with ${said} to look at.]`
}

/** The message as the judge reads it when it was typed while a task was still running. The effort that task runs at
 * stays out: a lower verdict waits for the turn to end (heldPick), so the running task is safe either way. */
export function withMidTurn(text: string): string {
  return `${text}

[Sent while the assistant was still working on the last task. If it adds to, corrects or steers that task, judge the effort that task needs; judge it on its own only if it is a separate new request.]`
}

/** A short follow-up that keeps the current effort: "go" between two steps, not an answer to a question. */
export function keepsEffort(message: string, context: string): boolean {
  return isFollowUp(message) && !endsOnQuestion(context)
}

/** A decision model below even odds on this model's effort. Haiku's own sure (self-reported) only tips the slider. */
export const isUnsure = (by: Verdict['by'] | Pick['by'], answer: ModelAnswer | undefined) => by === 'decision' && (answer?.sure ?? 1) < 0.5

/**
 * A decision model's reply as a verdict: each model's choice and how sure it was (its confidence, else the choice's
 * probability), as given. The answers may sit under `answers`, `result.answers` or at the top level. A model with no
 * valid level is left out; nothing when no model has one. Whether an answer is sure enough is the caller's call.
 */
export function parseDecisionAnswer(text: string): Verdict | undefined {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof json !== 'object' || json === null) return undefined
  const o = json as Record<string, any>
  const answers = (o.answers ?? o.result?.answers ?? o) as Record<string, { choice?: string; confidence?: number; probabilities?: Record<string, number> } | undefined>
  const efforts: Answers = {}
  for (const m of JUDGED) {
    const a = answers[`effort_${m}`]
    const effort = a?.choice as Effort | undefined
    if (!effort || !EFFORTS.includes(effort)) continue
    const sure = a?.confidence ?? a?.probabilities?.[effort]
    efforts[m] = typeof sure === 'number' ? { effort, sure } : { effort }
  }
  return Object.keys(efforts).length ? { efforts, why: '', by: 'decision' } : undefined
}

/** How sure a decision model was, in the band's words ("70% sure"); nothing when it did not say. */
export const sureWords = (answer: ModelAnswer) => (answer.sure !== undefined ? `${Math.round(answer.sure * 100)}% sure` : '')

/** A verdict's answers in a line: "haiku max · sonnet high · opus medium 40% (unsure)", for debug and the panel's Test. */
export function answersText(v: Verdict): string {
  return JUDGED.filter(m => v.efforts[m])
    .map(m => {
      const a = v.efforts[m]!
      const sure = a.sure !== undefined && v.by === 'decision' ? ` ${Math.round(a.sure * 100)}%` : ''
      return `${m} ${a.effort}${sure}${isUnsure(v.by, a) ? ' (unsure)' : ''}`
    })
    .join(' · ')
}

/** Why Haiku was asked: `unsure` (a decision model was unsure of, or silent on, this model), `chain` (no decision model
 * answered; `said` names the last reason), or `only` (Haiku is the judge). `said` is what the verdict line shows. */
export type HaikuWhy = { kind: 'unsure' | 'chain' | 'only'; said: string }
/** `haikuWhy` is set only when Haiku's verdict is the one used. `haikuMissed` is set when a decision model was unsure and
 * Haiku gave no answer: the decision model's answer stands, and the verdict line says so. */
export type Judged = { verdict?: Verdict; tokens: number; haikuWhy?: HaikuWhy; haikuMissed?: string }

/** Why a judge the person picked could not answer, in words: what a status code means for them. */
export function judgeFailure(name: string, status: number | 'timeout'): string {
  if (status === 'timeout') return `${name} did not answer in time`
  if (status === 401 || status === 403) return `${name} rejected the key (${status})`
  if (status === 402) return `${name} is out of credits (${status})`
  if (status === 429) return `${name} is rate limited (${status})`
  return `${name} failed (${status})`
}

/** The text Haiku reads: the last turns and the next message. Not the model in use nor the effort in force: the verdict
 * answers for every model, and effortless applies the one that runs. */
export function judgeQuestion(prompt: string, context: string): string {
  return [context ? `Recent conversation:\n${context}` : '', `Next message:\n${prompt.slice(0, 2000)}`].filter(Boolean).join('\n\n')
}

export const HANDOFF_SYSTEM = `You decide whether the person should hand off now: start a fresh chat that carries over a short summary, instead of carrying on in this one. You are shown what the chat was for, the trail of what the person asked, the last turns, the next message, how full the context is and whether the cache is cold.

Say yes only for a clear reason: the task just finished and the next message is something else, the topic has changed so the old context is dead weight, the chat keeps going in circles on the same problem, or a long chat now holds so much unrelated history that a clean start would be sharper. A normal next step of the same work is never a reason, a long chat by itself is not one, and neither is a high context share when the work is going well. When unsure, say no: a wrong yes costs the person more than a missed one.

Reply with JSON only: {"handoff":"reason of at most 8 words, in the person's language"} for yes, or {"handoff":null} for no.`

/** What the handoff check reads: the chat's purpose, a trail of the person's messages, the last reply's end. */
export function handoffEvidence(messages: readonly { role: string; text: string }[], next: string, percent: number, cold: boolean): string {
  const asked = messages.filter(m => m.role === 'user' && m.text.trim())
  const first = asked[0]?.text.slice(0, 500) ?? ''
  const trail = asked.slice(-8, -1).map(m => `- ${m.text.slice(0, 160).replace(/\s+/g, ' ')}`)
  const reply = lastAssistantText(messages).slice(-700)
  return [
    first ? `What the chat was for (first message):\n${first}` : '',
    trail.length ? `Trail of earlier messages:\n${trail.join('\n')}` : '',
    reply ? `The assistant's last reply (its end):\n${reply}` : '',
    `Next message:\n${next.slice(0, 600)}`,
    `Context used: ${Math.round(percent)}% of the window; ${asked.length} messages so far; the cache is ${cold ? 'cold' : 'warm'}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Reads Haiku's answer: a reason, or null for no (anything unreadable is no). */
export function parseHandoffAnswer(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const { handoff } = JSON.parse(match[0]) as { handoff?: unknown }
    return typeof handoff === 'string' && handoff.trim() ? handoff.trim().slice(0, 70) : null
  } catch {
    return null
  }
}

/** What the judge reads for a subagent: its task, said to be one, so it judges the subagent's work. */
export function helperQuestion(prompt: string, type: string): string {
  return `${prompt.slice(0, 4000)}

[This is the task Claude gave a ${type} subagent, not a message from the person. Judge the effort that subagent needs to do it well.]`
}

/** The lowest effort a helper gets: medium, or the person's Min when higher, never above their Max. A helper's answer
 * goes back to the chat unchecked, and at low it miscounted where medium did not (bench/results/helpers-2026-10-10.md). */
export function helperFloor(floor: Effort, ceiling: Effort): Effort {
  const i = Math.min(Math.max(EFFORTS.indexOf(floor), EFFORTS.indexOf('medium')), EFFORTS.indexOf(ceiling))
  return EFFORTS[i]
}
