import { describe, expect, mock, test as baseTest } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { helperFloor, namedEffort, hotVisible, tipped, bounded, handoffEvidence, parseHandoffAnswer, withTypesafeKey, withEnvLine, parseVerdict, capped, resetLabel, HANDOFF_PROMPT, handoffMessage, withAttachments, endsOnQuestion, keepsEffort, judgeFailure, contextFrom, readConfig, timingWarnings, asSpent, cacheColor, cacheLabel, cacheClock, cacheSafe, cacheTtlOf, mostlyCached, isFollowUp, parseDecisionAnswer, parseTypesafeKey, savedText, forkOutcome, setupNext, setupBack, setupCounter, dashboardLines, flashColor, handoffGlowStep, weighted, handoffLook, claudeCandidates, noClaudeHint, compactTranscript, judgeGlowSvg, judgeGlowAt, judgeBrightnessAt, JUDGE_RISE_MS, JUDGE_FADE_MS, JUDGE_STEP_MS, JUDGE_PIECE_MS } from '../hooks/register'
import { ART_COLUMNS, artFrame, artPixel, MOVING } from '../hooks/art'
import { hopTimeout, MAX_ROUTES, movedEarlier, parseDecisionModels, routeLabel, routeShortName, withoutRoute, withRoute } from '../hooks/decisions'
import { isLight, lightHex, lightProps, setLight, setTheme, themedEls, themedSvg, tint, tintHex } from '../hooks/theme'
import { importsOf, moduleLinks, moduleOf, relPath, withTouch } from '../hooks/agents'
import { progressShare, stepsFromTodos, withTaskCreated, withTaskUpdated } from '../hooks/progress'


// Most tests below were written for the footer's buttons: they run in the minimal look unless they name another.
// The dashboard's own tests pass { layout: 'default' }.
type Opts = Parameters<typeof baseTest>[1]
const minimal = (o?: Record<string, unknown>) => ({ ...(o ?? {}), options: { layout: 'minimal', ...((o?.options as object) ?? {}) } })
const test = ((name: string, a: unknown, b?: unknown) =>
  b === undefined
    ? baseTest(name, minimal() as Opts, a as never)
    : baseTest(name, minimal(a as Record<string, unknown>) as Opts, b as never)) as typeof baseTest

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type Judged = 'haiku' | 'sonnet' | 'opus' | 'fable'
/** A decision model's reply: its effort for each model (one level for all, or per model), sure as given. */
const decisionReply = (effort: string | Partial<Record<Judged, string>>, sure: number | Partial<Record<Judged, number>> = 0.9) =>
  JSON.stringify({
    answers: Object.fromEntries(
      (['haiku', 'sonnet', 'opus', 'fable'] as const)
        .map(m => [m, typeof effort === 'string' ? effort : effort[m], typeof sure === 'number' ? sure : (sure[m] ?? 0.9)] as const)
        .filter(([, choice]) => choice)
        .map(([m, choice, confidence]) => [`effort_${m}`, { choice, confidence }]),
    ),
    usage: { input_tokens: 480, output_tokens: 54 },
  })

/** One request of the main loop on this model, the engine sending `effort`; what went out is in recordSteps. */
async function stepOn($: Engine, model: string, effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'medium', agentId?: string) {
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model, effort, messageCount: 1, ...(agentId ? { agentId } : {}) } as never)) {
    // drain
  }
}

/** Haiku as the judge answers this reply, and counts how often it was asked. */
function judgeSays(on: On, text: string) {
  const asked: string[] = []
  on('model.complete', (_$, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true as const, text, usage: USAGE } }
  })
  return asked
}

/** What sits beneath the plugins in a session: the prompt goes through, the status line takes text. */
function engine(on: On, env: Record<string, string> = {}, sessionModel = 'claude-opus-5-5', said: { role: string; text: string }[] = [], seed?: Record<string, unknown>) {
  mock.store(on, seed)
  mock.env(on, env)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: said }) as never)
  on('session.model', () => ({ value: sessionModel }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }, { name: 'session-handoff', source: 'user' }] as never }))
}

/** Records the slash commands the mod runs, as the person's own /model and /effort. */
function recordCommands(on: On) {
  const ran: string[] = []
  on('command.run', (_$, e) => {
    ran.push(`/${e.command} ${e.args}`)
    return { text: 'ok' }
  })
  return ran
}

/** Records the model and effort each main-conversation request was sent with. */
function recordSteps(on: On) {
  const sent: { model: string; effort: unknown }[] = []
  on('turn.step', async function* (_$, e) {
    sent.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return sent
}

/** One main-loop request, the engine sending `effort` as its own setting (high unless /effort set another). */
async function step($: Engine, effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'high') {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort, messageCount: 1 })
  for await (const _ of stream) {
    // drain
  }
}

/** The desktop footer: one Auto button, and the effort in use beside it. */
const FOOTER = { plugin: 'effortless', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never

/** The band above the prompt on desktop: it draws nothing (only the terminal has rows there). */
const DESK_BAND = { plugin: 'effortless', surface: 'desktop', ...BAND } as never

/** What a mounted tree draws, as text: its elements, props and strings. */
/** Nothing shows above the prompt on desktop: only the hidden hover cards, revealed by hovering the footer. */
async function noBand($: Engine, at: never) {
  const ui = await $.ui.mount(at)
  const text = await drawn(ui)
  expect(text).toContain('hover-cards')
  expect(text).not.toMatch(/"key":"(settings|setup|down|hot|cold|swamp)"/)
  await ui.unmount()
}

async function drawn(ui: { drawn: () => Promise<unknown> }): Promise<string> {
  return JSON.stringify(await ui.drawn())
}

/** The plugin drew nothing there: the mount shows only the app's own node (Claude Code 2.1.321+). */
async function drawsNothing($: Engine, at: unknown) {
  const ui = await $.ui.mount(at as never)
  expect(await drawn(ui)).toMatch(/^\{"type":"engine","ref":\d+\}$/)
  await ui.unmount()
}

/**
 * The band's buttons take clicks: the app draws anything in the flow under an absolutely placed art layer, so the
 * layer holding them must itself be absolute and come after the art.
 */
async function clickable(ui: { drawn: () => Promise<unknown> }, layer: string) {
  const find = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== 'object') return undefined
    const n = node as Record<string, unknown>
    const props = (n.props ?? {}) as Record<string, unknown>
    if (n.key === layer || props.key === layer) return n
    for (const value of Object.values(n)) {
      const hit = Array.isArray(value) ? value.map(find).find(Boolean) : find(value)
      if (hit) return hit
    }
    return undefined
  }
  const node = find(await ui.drawn())
  expect(node).toBeDefined()
  const props = ((node as Record<string, unknown>).props ?? node) as Record<string, unknown>
  // Either an absolute layer, or a box in the flow made positioned by an empty absolute child (the dashboard's and the
  // handoff bar's controls): both paint over the art.
  const kids = ((node as Record<string, unknown>).children ?? []) as Record<string, unknown>[]
  const positioned = kids.some(k => {
    const p = (k?.props ?? {}) as Record<string, unknown>
    return k?.type === 'Box' && p.position === 'absolute' && !((k.children as unknown[] | undefined)?.length)
  })
  expect(props.position === 'absolute' || positioned).toBe(true)
}

describe('auto', () => {
  test('effort follows the judge and the model stays the one in use', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"simple question"}')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'vad heter mappen?', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })

  test('on Fable 5.1 a judged prompt applies the fable answer, and the request goes out at that effort', async ($, on) => {
    engine(on, {}, 'claude-fable-5-1')
    judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"medium","fable":"low","why":"simple question"}')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'vad heter mappen?', wait: false, origin: { kind: 'composer' } })
    await stepOn($, 'claude-fable-5-1', 'xhigh')

    expect(sent[0]).toEqual({ model: 'claude-fable-5-1', effort: 'low' })
  })

  test('Auto switched off: the app effort goes out, not the pick the judge made while Auto was on', async ($, on) => {
    engine(on)
    on('model.complete', () => ({ value: { isAnswered: true as const, text: '{"haiku":"low","sonnet":"low","opus":"low","why":"tiny"}', usage: USAGE } }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'rename this one variable for me', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0].effort).toBe('low')
    // Auto off, the app still on Extra (no change the mod could see): Extra goes out, not the judge's old low.
    await $.command.run({ command: 'effortless', args: 'auto' })
    await step($, 'xhigh')
    expect(sent[1].effort).toBe('xhigh')
    await $.prompt.submit({ text: 'now plan the whole architecture', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[2].effort).toBe('xhigh')
  })

  test('a typed skill is judged like a prompt (told what it is); the app\'s own commands are not', async ($, on) => {
    engine(on)
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String((e as { prompt?: string }).prompt ?? ''))
      return { value: { isAnswered: true as const, text: '{"haiku":"low","sonnet":"low","opus":"low","why":"small job"}', usage: USAGE } }
    })
    const sent = recordSteps(on)
    // /session-handoff is a user skill (see engine's command list): judged, even though it is short enough to look like a follow-up.
    await $.prompt.submit({ text: '/session-handoff', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(asked.length).toBe(1)
    expect(asked[0]).toContain('slash command that runs a skill')
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
    // /model is the app's own: never judged.
    await $.prompt.submit({ text: '/model', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(1)
  })

  test('the judge never moves a prompt to a dearer model than the chat model', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'debug this race condition', wait: false, origin: { kind: 'composer' } })
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'high', messageCount: 1 })) {
      // drain
    }
    expect(sent[0].model).toBe('claude-sonnet-5-5')
  })

  test('a reply that is not a verdict leaves the session as it is', async ($, on) => {
    engine(on)
    judgeSays(on, 'I think sonnet')
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fixa buggen', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  })

  test('a typesafe/ decision model decides when TYPESAFE_API_KEY is set, with typed questions, and Haiku is not asked', { options: { decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const calls: { url: string; auth?: string; body: Record<string, any> }[] = []
    on('http.fetch', (_$, e) => {
      calls.push({
        url: e.url,
        auth: (e.init?.headers as Record<string, string> | undefined)?.authorization,
        body: JSON.parse(String(e.init?.body)),
      })
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('max') } }
    })
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'designa om hela relayn', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(calls[0].auth).toBe('Bearer k')
    expect(calls[0].body.model).toBe('jev-latest')
    expect(calls[0].body.state.next_message).toBe('designa om hela relayn')
    expect(calls[0].body.questions.effort_opus.type).toBe('choice')
    expect(Object.keys(calls[0].body.questions.effort_opus.criteria)).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(asked.length).toBe(0)
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'max' })
  })

  test('with judge auto and a typesafe/ decision model, the TypeSafe key is read from ~/.config/jev/.env when the environment has none', { options: { judge: 'auto', decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { USERPROFILE: '/Users/x' })
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const read: string[] = []
    on('fs.read', (_$, e) => {
      read.push(e.path)
      return { value: 'OTHER=1\nTYPESAFE_API_KEY="from-file"\n' } as never
    })
    const auth: (string | undefined)[] = []
    on('http.fetch', (_$, e) => {
      auth.push((e.init?.headers as Record<string, string> | undefined)?.authorization)
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('high') } }
    })
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    expect(read.map(path => path.replaceAll('\\', '/'))).toEqual(['/Users/x/.config/jev/.env'])
    expect(auth).toEqual(['Bearer from-file'])
    expect(asked.length).toBe(0)
  })

  test('slash commands are not judged', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"haiku":"max","sonnet":"max","opus":"max","why":"x"}')

    await $.prompt.submit({ text: '/clear', wait: false, origin: { kind: 'composer' } })

    expect(asked.length).toBe(0)
  })
})

describe('manual effort', () => {
  test("the app's own Effort control wins over Auto and turns it off", async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const sent = recordSteps(on)
    const drain = async (index: number, effort: 'low' | 'medium' | 'high') => {
      for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort, messageCount: 1 })) {
        // drain
      }
    }

    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await drain(0, 'medium')
    expect(sent[0].effort).toBe('high')

    // The person picks Low in the app between two requests.
    await drain(1, 'low')
    expect(sent[1].effort).toBe('low')
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto off')
    await ui.unmount()

    await drain(2, 'low')
    expect(sent[2].effort).toBe('low')
  })
})

describe('model in use', () => {
  test('after a switch in the app, effort applies to the new model at once', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"kort"}')
    const sent = recordSteps(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const switchTo = (from: string, to: string) =>
      $.classic.PostModelSwitch({ from_model: from, to_model: to, requested_model: null, source: 'picker', context_tokens: 0 } as never)

    await switchTo('claude-opus-5-5', 'claude-haiku-5-5')
    await $.prompt.submit({ text: 'ok', wait: false, origin: { kind: 'composer' } })

    // The person picks Opus in the app.
    await switchTo('claude-haiku-5-5', 'claude-opus-5-5')

    await step($, 'medium')
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })
})

describe('typed commands', () => {
  const box = (on: On, draft: string) => {
    const filled: string[] = []
    on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }) as never)
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    return filled
  }

  test('an effort click sets the effort at once and runs /effort for the app', async ($, on) => {
    engine(on)
    const filled = box(on, '')
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })

    await ui.press({ key: 'e-high' })
    await step($, 'medium')

    expect(ran).toEqual(['/effort high'])
    expect(filled).toEqual([])
    expect(sent[0].effort).toBe('high')
    await ui.unmount()
  })
})

describe('footer text', () => {
  // The footer sits on the app's own surface, so it is drawn in the app's theme keys (the violet is 'merged').
  const PURPLE = 'merged'
  const auto = async ($: Engine) => String((await $.command.run({ command: 'effortless', args: 'auto' })).text)
  const saving = (on: On, outputTokens: number) =>
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { ...USAGE, output_tokens: outputTokens, model: 'claude-opus-5-5' },
      } as never
    })
  const asked = async ($: Engine) => String((await $.command.run({ command: 'effortless', args: 'stats' })).text)

  test('the footer is purple text and one small button; no box, nothing lit', async ($, on) => {
    engine(on)
    const footer = await $.ui.mount(FOOTER)
    const text = await drawn(footer)
    expect(text).toContain(`"color":"${PURPLE}"`)
    expect(text).toContain('"children":[" Auto "]')
    // The only button is the small switch for Auto: no label other than the power glyph, not the lit look.
    // The Auto switch, the setup (or settings gear) and the handoff symbol.
    expect(text.match(/"type":"Button"/g)?.length).toBe(3)
    expect(text).toContain('"label":" ⏻ "')
    // No frame of its own (it drew wide and cut off): plain, with the same grey box as the level on hover.
    expect(text).toContain('"plain":true')
    expect(text).toContain('"hover":{"scope":"power"}')
    expect(text).not.toContain('"variant":"primary"')
    expect(text).not.toContain('borderStyle')
    // Hovering the level puts a grey box behind it.
    expect(text).toContain('"hover":{"scope":"effort"}')
    // No background at rest: the only ones are in the hover styles and the hidden hover cards (display none).
    expect(text.replaceAll('"backgroundColor":"#2b2b2f"}', '').replaceAll('"backgroundColor":"#221c3a"', '')).not.toContain('backgroundColor')
    await footer.unmount()
  })

  test('with Auto on it is the effort in use, in purple', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const text = await drawn(footer)
    expect(text).toContain('"children":[" High "]')
    expect(text).toContain(`"color":"${PURPLE}"`)
    await footer.unmount()
  })

  test('the small button switches Auto off ("Off", dim, not purple) and on again', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).toContain('"children":[" High "]')

    await footer.press({ key: 'auto' })
    const off = await drawn(footer)
    expect(off).toContain('"children":[" Off "]')
    expect(off).not.toContain(`"color":"${PURPLE}"`)
    await $.prompt.submit({ text: 'en till', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(1)

    await footer.press({ key: 'auto' })
    expect(await drawn(footer)).toContain(`"color":"${PURPLE}"`)

    // The command does the same.
    expect(await auto($)).toContain('Auto off')
    expect(await drawn(footer)).toContain('"children":[" Off "]')
    await footer.unmount()
  })

  test("the app's own Effort control turns Auto off and the footer says Off", async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    recordSteps(on)
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(await drawn(footer)).toContain(`"color":"${PURPLE}"`)

    // The person picks another effort in the app between two requests.
    await step($, 'low')
    expect(await drawn(footer)).toContain('"children":[" Off "]')
    await footer.unmount()
  })

  test('on Haiku 5.5 the effort is named and applied: the Haiku answer', async ($, on) => {
    engine(on, {}, 'claude-haiku-5-5')
    judgeSays(on, '{"haiku":"high","sonnet":"low","opus":"low","why":"simple"}')
    const sent = recordSteps(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const footer = await $.ui.mount(FOOTER)
    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-haiku-5-5',
      requested_model: 'haiku',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).toContain('High')
    await stepOn($, 'claude-haiku-5-5')
    expect(sent[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'high' })
    await footer.unmount()
  })

  test('on a model outside the four families, Auto pauses and the judge is not asked', async ($, on) => {
    engine(on, {}, 'some-other-model')
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"low","opus":"low","why":"simple"}')
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(0)
  })

  test('the judge is told that scope counts: a short message can be a big job', async ($, on) => {
    engine(on)
    let system = ''
    on('model.complete', (_$, e) => {
      system = String(e.system)
      return { value: { isAnswered: true as const, text: '{"haiku":"high","sonnet":"high","opus":"high","why":"stor uppgift"}', usage: USAGE } } as never
    })
    await $.prompt.submit({ text: 'go through my whole google drive and clean it up', wait: false, origin: { kind: 'composer' } })
    expect(system).toContain('Judge the scope')
    expect(system).toContain('whole drive')
    expect(system).toContain('never low')
    expect(system).toContain('"fable":')
  })

  test('a thinking state while the judge decides', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    // The judge takes half a second to answer.
    on('model.complete', async () => {
      await mocked.sleep(500)
      return { value: { isAnswered: true as const, text: '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}', usage: USAGE } } as never
    })
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).not.toContain('Deciding')

    const submitted = $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await mocked.advance(100)
    expect(await drawn(footer)).toContain('"children":[" Deciding… "]')

    await mocked.advance(600)
    await submitted
    expect(await drawn(footer)).not.toContain('Deciding')
    expect(await drawn(footer)).toContain('"children":[" High "]')
    await footer.unmount()
  })

  test('a switch is shown as Low → High for a moment, then only the level', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let verdict = '{"haiku":"low","sonnet":"low","opus":"low","why":"simple"}'
    on('model.complete', () => ({ value: { isAnswered: true as const, text: verdict, usage: USAGE } }) as never)
    const footer = await $.ui.mount(FOOTER)

    // The first verdict has nothing to switch from.
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).not.toContain('→')

    verdict = '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}'
    await $.prompt.submit({ text: 'hard task across several files', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(footer)).toContain('"children":[" Low → High "]')

    await mocked.advance(2600)
    const settled = await drawn(footer)
    expect(settled).not.toContain('→')
    expect(settled).toContain('"children":[" High "]')
    await footer.unmount()
  })

  test('/effortless stats reports the measured cost of every token kind, per effort, and the judge', async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"simple"}')
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 600, cache_read_input_tokens: 10000, cache_creation_input_tokens: 800, model: 'claude-opus-5-5' },
      } as never
    })
    expect(await asked($)).toContain('nothing measured yet')

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'high')

    // 100 in + 800 written x1.25 + 10000 read x0.1 + 600 out x5 = 100 + 1000 + 1000 + 3000 = 5100.
    const text = await asked($)
    expect(text).toContain('1 prompts, 1 requests, cost about 5.1k')
    expect(text).toContain('cache reads 20 %, cache writes 20 %, output 59 %')
    expect(text).toContain('Low 1, average 5.1k')
    expect(text).toContain('Judge: decision models 0, Haiku after unsure 0, after no answer 0, Haiku only 1')
    expect(text).not.toContain('saved about')
  })

  test('requests you steered yourself are not counted', async ($, on) => {
    engine(on)
    saving(on, 600)
    const rows = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await rows.press({ key: 'e-low' })
    await step($, 'high')
    expect(await asked($)).toContain('nothing measured yet')
    await rows.unmount()
  })

  test('nothing is drawn above the prompt on desktop', async ($, on) => {
    engine(on)
    await drawsNothing($, DESK_BAND)
  })

})

describe('helpers', () => {
  test('cacheSafe: any release of the four families, today\'s and later ones; other models pause', () => {
    expect(cacheSafe('claude-opus-5-5')).toBe(true)
    expect(cacheSafe('claude-sonnet-5-5[1m]')).toBe(true)
    expect(cacheSafe('claude-haiku-5-5')).toBe(true)
    expect(cacheSafe('claude-fable-5-1[1m]')).toBe(true)
    expect(cacheSafe('claude-fable-5-2')).toBe(true)
    expect(cacheSafe('claude-opus-6-1')).toBe(true)
    expect(cacheSafe('claude-sonnet-6')).toBe(true)
    expect(cacheSafe('some-other-model')).toBe(false)
  })

  test('parseTypesafeKey reads the key line, quoted or not, and nothing else', () => {
    expect(parseTypesafeKey('TYPESAFE_API_KEY=abc')).toBe('abc')
    expect(parseTypesafeKey('X=1\n  TYPESAFE_API_KEY = "q w" \n')).toBe('q w')
    expect(parseTypesafeKey('TYPESAFE_API_KEY=')).toBeUndefined()
    expect(parseTypesafeKey('OTHER=1')).toBeUndefined()
  })

  test('parseDecisionAnswer: each model\'s choice and confidence as given, unsure ones too; a bad entry is left out; junk is nothing', () => {
    const v = parseDecisionAnswer(decisionReply({ haiku: 'max', sonnet: 'high', opus: 'medium' }, { opus: 0.4 }))
    expect(v?.efforts).toEqual({ haiku: { effort: 'max', sure: 0.9 }, sonnet: { effort: 'high', sure: 0.9 }, opus: { effort: 'medium', sure: 0.4 } })
    expect(v?.by).toBe('decision')
    expect(parseDecisionAnswer(decisionReply({ haiku: 'turbo', opus: 'low' }))?.efforts).toEqual({ opus: { effort: 'low', sure: 0.9 } })
    expect(parseDecisionAnswer(decisionReply('turbo'))).toBeUndefined()
    expect(parseDecisionAnswer('nope')).toBeUndefined()
    // No confidence: the choice's own probability stands in.
    const probs = JSON.stringify({ answers: { effort_opus: { choice: 'low', probabilities: { low: 0.62, medium: 0.38 } } } })
    expect(parseDecisionAnswer(probs)?.efforts.opus).toEqual({ effort: 'low', sure: 0.62 })
  })

  test('parseDecisionAnswer reads the answers under answers, under result.answers, or at the top level', () => {
    const one = { effort_sonnet: { choice: 'high', confidence: 0.7 } }
    for (const body of [{ answers: one }, { result: { answers: one } }, one]) {
      expect(parseDecisionAnswer(JSON.stringify(body))?.efforts.sonnet).toEqual({ effort: 'high', sure: 0.7 })
    }
  })

  test('parseVerdict: Haiku\'s effort for each model, one sure and why; a bad entry is left out', () => {
    const v = parseVerdict('{"haiku":"max","sonnet":"turbo","opus":"medium","sure":0.6,"why":"big job"}')
    expect(v?.efforts).toEqual({ haiku: { effort: 'max', sure: 0.6 }, opus: { effort: 'medium', sure: 0.6 } })
    expect(v?.why).toBe('big job')
    expect(v?.by).toBe('haiku')
    expect(parseVerdict('{"model":"opus","effort":"high"}')).toBeUndefined()
    expect(parseVerdict('I think sonnet')).toBeUndefined()
  })
})

describe('follow-ups', () => {
  test('isFollowUp: short go-aheads yes, real requests no', () => {
    for (const t of ['go', 'ok', ' yes ', 'ok go', 'continue']) expect(isFollowUp(t)).toBe(true)
    for (const t of ['', 'rename x to count in utils', 'go through my whole drive']) expect(isFollowUp(t)).toBe(false)
  })

  test('"go" after a judged prompt keeps its effort and asks no judge', async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'granska hela relayn', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(1)
    expect(sent[0].effort).toBe('high')
  })
})

describe('named level', () => {
  test('namedEffort: a level said with the word effort, or xhigh, counts; other senses and negations do not', () => {
    expect(namedEffort('do this with max effort please')).toBe('max')
    expect(namedEffort('Effort: high, then refactor the relay')).toBe('high')
    expect(namedEffort('run it at effort low')).toBe('low')
    expect(namedEffort('use extra high effort for this one')).toBe('xhigh')
    expect(namedEffort('xhigh, review the whole repo')).toBe('xhigh')
    expect(namedEffort('maximum effort on this bug')).toBe('max')
    expect(namedEffort('make a medium sized image')).toBeUndefined()
    expect(namedEffort('this needs a lot of effort, the bug is high up in the stack')).toBeUndefined()
    expect(namedEffort("don't use max effort for this")).toBeUndefined()
    expect(namedEffort('no need for high effort here')).toBeUndefined()
    expect(namedEffort('a high effort job: migrate everything')).toBe('high')
  })

  test('a prompt that names a level runs at it without asking the judge, past Max', { options: { effortCeiling: 'high' } } as never, async ($, on) => {
    engine(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"small"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'max effort: find why the relay drops messages', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(0)
    expect(sent[0].effort).toBe('max')
    // The next prompt without a level goes back to the judge, within Max.
    await $.prompt.submit({ text: 'now rename the helper in utils', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(asked.length).toBe(1)
    expect(sent[1].effort).toBe('low')
  })
})

describe('state from an older version', () => {
  test('the pre-0.2.0 tally { requests, actual, baseline } reads as an empty tally, never throws', () => {
    const old = { requests: 3, actual: 900, baseline: 1500 } as never
    expect(asSpent(old).judge).toEqual({ decision: 0, haikuUnsure: 0, haikuNoAnswer: 0, haikuOnly: 0, ms: 0, tokens: 0 })
    expect(asSpent(old).byEffort).toEqual({})
    expect(() => savedText(old)).not.toThrow()
    expect(asSpent(undefined).prompts).toBe(0)
  })
})

describe('cache countdown', () => {
  const answer = (on: On, cacheCreation?: Record<string, number>) =>
    on('turn.step', async function* (_$, e) {
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [],
        stopReason: 'end_turn',
        usage: { ...USAGE, ...(cacheCreation ? { cache_creation: cacheCreation } : {}) },
      } as never
    })
  // The countdown's timer starts with the session, as in the app.
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const shows = (text: string) => `"children":["${text}"]`

  test('cacheTtlOf and cacheLabel', () => {
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 900, ephemeral_5m_input_tokens: 0 } })).toBe('1h')
    expect(cacheTtlOf({ cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 10 } })).toBe('5m')
    expect(cacheTtlOf({ input_tokens: 1 })).toBeUndefined()
    expect(cacheLabel(60)).toBe('59m')
    expect(cacheClock(3_521_000)).toBe('58:41')
    expect(cacheClock(59_400)).toBe('1:00')
    expect(cacheClock(5_000)).toBe('0:05')
    expect(cacheClock(0)).toBe('❄ Cold')
    expect(cacheLabel(1)).toBe('<1m')
    expect(cacheLabel(0)).toBe('❄ Cold')
    expect(cacheColor(60)).toBeUndefined()
    expect(cacheColor(22)).toBeUndefined()
    expect(cacheColor(21)).toBe('#e0a33a')
    expect(cacheColor(7)).toBe('#e0a33a')
    expect(cacheColor(6)).toBe('#e5534b')
    expect(cacheColor(1)).toBe('#e5534b')
    expect(cacheColor(0)).toBe('#7cc4ff')
    expect(mostlyCached({ input_tokens: 90000, cache_read_input_tokens: 10 })).toBe(false)
  })

  test('nothing before the first response; then it counts down with no further response, turns amber, goes cold', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500, ephemeral_5m_input_tokens: 0 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).not.toContain('Cold')

    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))

    // No request in between: the session's own timer moves it.
    await mocked.advance(30 * 60_000)
    expect(await drawn(footer)).toContain(shows('29m'))

    expect(await drawn(footer)).not.toContain('"color":"#e')
    await mocked.advance(10 * 60_000)
    expect(await drawn(footer)).toContain(shows('19m'))
    expect(await drawn(footer)).toContain('"color":"warning"')
    await mocked.advance(16 * 60_000)
    const late = await drawn(footer)
    expect(late).toContain(shows('3m'))
    expect(late).toContain('"color":"error"')

    await mocked.advance(5 * 60_000)
    expect(await drawn(footer)).toContain(shows('❄ Cold'))

    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))
    await footer.unmount()
  })

  test('a response that does not say its lifetime is counted as 1 hour', async ($, on) => {
    engine(on)
    mock.clock(on)
    answer(on)
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    expect(await drawn(footer)).toContain(shows('59m'))
    await footer.unmount()
  })

  test('a response that says 5 minutes counts down 5 minutes', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    expect(await drawn(footer)).toContain(shows('4m'))
    await mocked.advance(6 * 60_000)
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    await footer.unmount()
  })

  /** The band above the prompt, with the first-run setup guide closed so the cold band can show. */
  const coldBand = async ($: Engine) => {
    const band = await $.ui.mount(DESK_BAND)
    if (await band.find({ key: 'setup-haiku' })) {
      await band.press({ key: 'setup-haiku' })
      await band.press({ key: 'setup-close' })
    }
    return band
  }

  test('Compact appears only once the cache is cold, and a click compacts', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 500_000, window: 1_000_000, percent: 50 } } }) as never)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500, ephemeral_5m_input_tokens: 0 })
    let compacted = 0
    let note = ''
    on('command.run', (_$, e) => {
      if (e.command === 'compact') note = e.args
      if (e.command === 'compact') compacted++
      return { text: 'ok' }
    })
    await start($, on)
    await step($)
    await mocked.advance(59 * 60_000)
    // Still warm: no band (only the first-run guide, closed here), so nothing to compact yet.
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-haiku' })
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await drawsNothing($, DESK_BAND)
    await mocked.advance(2 * 60_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await band.find({ key: 'cold-compact' })).toBeDefined()
    await band.press({ key: 'cold-compact' })
    // The bar asks for an optional note first; Enter in it compacts with the note as /compact's instructions.
    await band.input({ key: 'compact-note', text: 'keep the API decisions' })
    await mocked.advance(100)
    // The test kit's compaction has no transcript to run over, so only the call is checked here.
    expect(compacted).toBe(1)
    expect(note).toBe('keep the API decisions')
    await band.unmount()
  })

  test('/effortless cold shows Cold and the Compact button at once, for testing', async ($, on) => {
    engine(on)
    mock.clock(on)
    answer(on, { ephemeral_1h_input_tokens: 500 })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    await step($)
    const reply = await $.command.run({ command: 'effortless', args: 'cold' })
    expect(String(reply.text)).toContain('cold')
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    expect(await footer.find({ key: 'compact' })).toBeUndefined()
    const band = await coldBand($)
    expect(await band.find({ key: 'cold-compact' })).toBeDefined()
    await band.unmount()
    await footer.unmount()
  })

  test('a compact that fails says why in a toast, nothing breaks', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 500_000, window: 1_000_000, percent: 50 } } }) as never)
    const mocked = mock.clock(on)
    answer(on, { ephemeral_5m_input_tokens: 500 })
    on('command.run', (_$, e) => {
      if (e.command === 'compact') throw new Error('compact is not available here')
      return { text: 'ok' }
    })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const footer = await $.ui.mount(FOOTER)
    const band = await coldBand($)
    await step($)
    await mocked.advance(6 * 60_000)
    await band.press({ key: 'cold-compact' })
    // The bar asks for an optional note first; Compact runs it.
    await band.press({ key: 'compact-go' })
    expect(toasts.join(' ')).toContain('compact failed')
    expect(await drawn(footer)).toContain(shows('❄ Cold'))
    await band.unmount()
    await footer.unmount()
  })
})

describe('cache guard', () => {
  test('on Fable Auto judges the prompt, and the footer shows the level, not Paused', async ($, on) => {
    engine(on, {}, 'claude-fable-5-1')
    const asked = judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"medium","fable":"low","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    const footer = await $.ui.mount(FOOTER)
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-fable-5-1', effort: 'xhigh', messageCount: 1 })
    for await (const _ of stream) {
      // drain
    }
    expect(asked.length).toBe(1)
    expect(sent).toEqual(['low'])
    expect(await drawn(footer)).not.toContain('Paused')
    await footer.unmount()
  })

  test('a pick made on Opus 5.5 is not applied to a Fable request', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"low","fable":"high","why":"x"}')
    const sent: unknown[] = []
    on('turn.step', async function* (_$, e) {
      sent.push(e.effort)
      return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    for (const model of ['claude-opus-5-5', 'claude-fable-5-1']) {
      const stream = $.turn.step({ turnId: 't1', index: 0, model, effort: 'xhigh', messageCount: 1 })
      for await (const _ of stream) {
        // drain
      }
    }
    expect(sent).toEqual(['low', 'high'])
  })
})

describe('footer', () => {
  test('auto sets the effort of the request, never runs /effort or /model', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"simple"}')
    const ran = recordCommands(on)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'rename the function', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')

    expect(sent[0].effort).toBe('low')
    expect(ran).toEqual([])
  })

})

describe('band', () => {
  for (const surface of ['terminal'] as const) {
    test(`clicking an effort turns auto off and is what the turn runs with (${surface})`, async ($, on) => {
      engine(on)
      const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
      const sent = recordSteps(on)
      const ran = recordCommands(on)

      const ui = await $.ui.mount({ plugin: 'effortless', surface, ...BAND })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto on')

      await ui.press({ key: 'e-xhigh' })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto off')
      expect(ran).toEqual(['/effort xhigh'])

      await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
      await step($, 'xhigh')

      expect(asked.length).toBe(0)
      expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'xhigh' })

      await ui.press({ key: 'auto' })
      expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto on')
      await ui.unmount()
    })
  }
})

describe('a level picked by hand, in the minimal look', () => {
  test('the lit level says manual on its button', async ($, on) => {
    engine(on)
    recordCommands(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await ui.press({ key: 'e-low' })
    expect(JSON.stringify(await ui.find({ key: 'e-low' }))).toContain('"label":"low · manual"')
    await ui.unmount()
  })
})

describe('a level clicked while the judge runs', () => {
  test('the verdict is dropped and the pick stays at the click', async ($, on) => {
    engine(on)
    mock.clock(on)
    recordCommands(on)
    let started!: () => void
    const judging = new Promise<void>(resolve => (started = resolve))
    let release!: () => void
    const released = new Promise<void>(resolve => (release = resolve))
    on('model.complete', async () => {
      started()
      await released
      return { value: { isAnswered: true as const, text: '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}', usage: USAGE } }
    })
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    const submitted = $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await judging
    await ui.press({ key: 'e-low' })
    release()
    await submitted

    expect(JSON.stringify(await ui.find({ key: 'e-low' }))).toContain('"variant":"primary"')
    expect(JSON.stringify(await ui.find({ key: 'e-high' }))).not.toContain('"variant":"primary"')
    expect((await ui.find({ key: 'auto' }))?.text).toContain('Auto off')
    // The prompt still counts for the judge, though Auto did not steer it.
    expect(String((await $.command.run({ command: 'effortless', args: 'stats' })).text)).toContain('Haiku only 1')
    await ui.unmount()
  })
})

describe('the band follows the settings', () => {
  test('save mode on caps a pick already made: the band and the next request say medium', async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"max","sonnet":"max","opus":"max","why":"hard"}')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    expect(JSON.stringify(await ui.find({ key: 'e-max' }))).toContain('"variant":"primary"')

    await $.command.run({ command: 'effortless', args: 'save' })
    expect(JSON.stringify(await ui.find({ key: 'e-medium' }))).toContain('"variant":"primary"')
    await step($, 'high')
    expect(sent[0].effort).toBe('medium')
    await ui.unmount()
  })

  test('save mode off brings the judge\'s answer back: the band and the next request say max again', async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"max","sonnet":"max","opus":"max","why":"hard"}')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    await $.command.run({ command: 'effortless', args: 'save' })
    expect(JSON.stringify(await ui.find({ key: 'e-medium' }))).toContain('"variant":"primary"')
    await $.command.run({ command: 'effortless', args: 'save' })
    expect(JSON.stringify(await ui.find({ key: 'e-max' }))).toContain('"variant":"primary"')
    await step($, 'high')
    expect(sent[0].effort).toBe('max')
    await ui.unmount()
  })

  test('a lower Max saved in the settings is in force at the next start: the pick comes down with it', async ($, on) => {
    // The Max saved from the settings (kept in the store, as a host that refuses the /config row keeps it); the setup
    // guide is done, so the next start does not open it over the band.
    engine(on, {}, 'claude-opus-5-5', [], { savedSettings: { effortCeiling: 'medium' }, setupDone: true })
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    expect(JSON.stringify(await ui.find({ key: 'e-high' }))).toContain('"variant":"primary"')

    // A saved setting reloads the plugin: its start reads the kept settings, and the pick is settled again under them.
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
    expect(JSON.stringify(await ui.find({ key: 'e-medium' }))).toContain('"variant":"primary"')
    await step($, 'high')
    expect(sent[0].effort).toBe('medium')
    await ui.unmount()
  })
})

describe('review fixes', () => {
  test('a model switch that changes the engine effort is not read as you choosing, Auto stays on', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"simple"}')
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent[0].effort).toBe('low')

    // The person picks another model; the engine's own effort for it is different.
    await $.classic.PostModelSwitch({
      from_model: 'claude-opus-5-5',
      to_model: 'claude-sonnet-5-5',
      requested_model: 'sonnet',
      source: 'picker',
      context_tokens: 0,
    } as never)
    await step($, 'medium')

    // Auto still decides: the request keeps the judged effort instead of the engine's 'medium'.
    expect(sent[1].effort).toBe('low')
  })

})

describe('judge choice (plugin settings)', () => {
  const chat = (content: string) =>
    JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 300, completion_tokens: 20 } })

  test('readConfig: an unknown or empty judge is auto, values are trimmed', () => {
    expect(readConfig(undefined).judge).toBe('auto')
    expect(readConfig({ judge: 'gpt' }).judge).toBe('auto')
    // The Custom judge is gone: a saved 'custom' reads as auto.
    expect(readConfig({ judge: 'custom' }).judge).toBe('auto')
    expect(readConfig({ judge: ' haiku ' }).judge).toBe('haiku')
    expect(readConfig({})).toEqual({
      judge: 'auto',
      typesafeKey: '',
      decisionModels: [],
      openrouterKey: '',
      judgeTimeoutMs: 4000,
      judgeBudgetMs: 8000,
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
    })
    expect(readConfig({ swampAt: '20' })).toMatchObject({ swampAt: 20 })
    expect(readConfig({ swampAt: '33' }).swampAt).toBe(70)
    expect(readConfig({ handoffSkill: '/session-handoff', handoffAfter: 'confirm' })).toMatchObject({
      handoffSkill: 'session-handoff',
      handoffAfter: 'confirm',
    })
  })

  test('haiku: a TypeSafe key in the environment is not used', { options: { judge: 'haiku' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    let fetched = 0
    on('http.fetch', () => {
      fetched++
      return { value: { status: 500, ok: false, headers: {}, text: '' } }
    })
    await $.prompt.submit({ text: 'hello there', wait: false, origin: { kind: 'composer' } })
    expect(fetched).toBe(0)
    expect(asked.length).toBe(1)
  })

  test('a typesafe/ decision model uses the key from the settings before the environment', { options: { decisionModels: 'typesafe/jev-latest', typesafeKey: 'from-settings' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'from-env' })
    mock.clock(on)
    const auth: (string | undefined)[] = []
    on('http.fetch', (_$, e) => {
      auth.push((e.init?.headers as Record<string, string> | undefined)?.authorization)
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('high') } }
    })
    await $.prompt.submit({ text: 'hard task here', wait: false, origin: { kind: 'composer' } })
    expect(auth).toEqual(['Bearer from-settings'])
  })
})

describe('context for the judge', () => {
  test("the assistant's last reply goes along, long and from its end, where its question sits", () => {
    const question = 'Which section should I build: A (simple), B (a complicated multi-step layout) or C?'
    const reply = 'x'.repeat(5000) + ' ' + question
    const text = contextFrom([
      { role: 'user', text: 'make me a new section' },
      { role: 'assistant', text: reply },
    ])
    expect(text).toContain(question)
    expect(text).toContain('user: make me a new section')
    expect(text.length).toBeLessThan(2500)
    expect(contextFrom([])).toBe('')
  })

  test("Haiku is handed the assistant's question and told how to judge an answer to it", async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    mock.clock(on)
    on('prompt.submit', (_$, e) => ({ text: e.text }))
    on('ui.status', () => ({ value: undefined }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.messages', () => ({
      value: [
        { role: 'user', text: 'make me a new section' },
        { role: 'assistant', text: 'Which one: A (simple) or B (a complicated multi-step layout)?' },
      ],
    }) as never)
    const seen: { system?: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: '{"haiku":"high","sonnet":"high","opus":"high","why":"B is big"}', usage: USAGE } }
    })
    await $.prompt.submit({ text: 'B', wait: false, origin: { kind: 'composer' } })
    expect(seen[0].prompt).toContain('B (a complicated multi-step layout)')
    expect(seen[0].system).toContain('judge only the work that answer starts')
    expect(seen[0].system).toContain('should I archive this?')
  })
})

describe('model-aware effort', () => {
  /** Switches the session's model the way the app reports it. */
  const switchModel = ($: Engine, from: string, to: string) =>
    $.classic.PostModelSwitch({ from_model: from, to_model: to, requested_model: null, source: 'picker', context_tokens: 0 } as never)

  test('Haiku reads the same question whatever effort was in force and whatever model runs', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const seen: { system?: string; prompt: string }[] = []
    let says = 'low'
    on('model.complete', (_$, e) => {
      seen.push({ system: e.system, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: `{"haiku":"${says}","sonnet":"${says}","opus":"${says}","why":"x"}`, usage: USAGE } }
    })
    recordSteps(on)
    const ask = async () => {
      await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
      await stepOn($, 'claude-opus-5-5')
    }
    await ask() // no pick yet
    says = 'xhigh'
    await ask() // the pick is low
    await ask() // the pick is xhigh
    await switchModel($, 'claude-opus-5-5', 'claude-sonnet-5-5')
    await ask() // on Sonnet now
    expect(seen.length).toBe(4)
    const first = seen[0]!
    for (const s of seen.slice(1)) expect(s).toEqual(first)
    expect(first.prompt).not.toMatch(/Current|opus|sonnet|xhigh|low/i)
    expect(first.system).not.toContain('one step lower')
    expect(first.system).toContain('"haiku"')
  })

  test('a decision model gets the same body whatever effort was in force and whatever model runs, with a question per model', { options: { decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const bodies: Record<string, any>[] = []
    let says = 'low'
    on('http.fetch', (_$, e) => {
      bodies.push(JSON.parse(String(e.init?.body)))
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply(says) } }
    })
    recordSteps(on)
    const ask = async () => {
      await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
      await stepOn($, 'claude-opus-5-5')
    }
    await ask()
    says = 'xhigh'
    await ask()
    await switchModel($, 'claude-opus-5-5', 'claude-sonnet-5-5')
    await ask()
    expect(bodies.length).toBe(3)
    const first = bodies[0]!
    for (const b of bodies.slice(1)) expect(b).toEqual(first)
    expect(Object.keys(first.state).sort()).toEqual(['next_message', 'recent_conversation', 'task'])
    expect(Object.keys(first.questions)).toEqual(['effort_haiku', 'effort_sonnet', 'effort_opus', 'effort_fable'])
    expect(first.questions.effort_opus.instructions).toContain('Opus 5.5')
    expect(first.questions.effort_fable.instructions).toContain('Fable 5.1')
    // Each model has its own scale: the same level is described differently per model.
    expect(first.questions.effort_haiku.criteria.high).not.toBe(first.questions.effort_sonnet.criteria.high)
    // The decision task is the tuned intro, a blank line, then the rules every judge gets (EFFORT_RULES).
    expect(first.state.task.startsWith('Choose the reasoning effort that an agentic AI assistant should use to handle the next message')).toBe(true)
    expect(first.state.task).toContain('\n\nJudge the scope and the amount of work, not whether it is code.')
    expect(first.state.task.endsWith('the same task can need different levels on different models.')).toBe(true)
    expect(JSON.stringify(first)).not.toMatch(/current_|one step lower/)
  })

  test('one verdict, and each model runs at its own answer', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"medium","why":"a refactor"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await stepOn($, 'claude-sonnet-5-5')
    expect(sent[0]).toEqual({ model: 'claude-sonnet-5-5', effort: 'high' })
  })

  test('a switch to another model takes that model\'s answer, and "go" keeps it', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    const asked = judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"medium","why":"a refactor"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await stepOn($, 'claude-opus-5-5')
    await switchModel($, 'claude-opus-5-5', 'claude-sonnet-5-5')
    await stepOn($, 'claude-sonnet-5-5')
    await $.prompt.submit({ text: 'go', wait: false, origin: { kind: 'composer' } })
    await stepOn($, 'claude-sonnet-5-5')
    expect(asked.length).toBe(1)
    expect(sent.map(s => s.effort)).toEqual(['medium', 'high', 'high'])
  })

  test('a switch to a model the verdict has no answer for keeps the level and says so', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    judgeSays(on, '{"haiku":"max","sonnet":"high","opus":"high","why":"a refactor"}')
    const sent = recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await switchModel($, 'claude-opus-5-5', 'claude-fable-5-1')
    await stepOn($, 'claude-fable-5-1')
    expect(sent.map(s => s.effort)).toEqual(['high'])
    expect(await drawn(ui)).toContain('kept')
    await ui.unmount()
  })

  test('a level you named stays across a switch', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'fix it, max effort', wait: false, origin: { kind: 'composer' } })
    await switchModel($, 'claude-opus-5-5', 'claude-sonnet-5-5')
    await stepOn($, 'claude-sonnet-5-5')
    expect(sent[0].effort).toBe('max')
  })
})

describe('keys', () => {
  test('without a typesafe/ decision model, ~/.config/jev/.env is never opened: Haiku judges', async ($, on) => {
    engine(on, { USERPROFILE: 'C:/Users/x' })
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const read: string[] = []
    on('fs.read', (_$, e) => {
      read.push(e.path)
      return { value: 'TYPESAFE_API_KEY=secret' } as never
    })
    await $.prompt.submit({ text: 'hello there', wait: false, origin: { kind: 'composer' } })
    expect(read.filter(path => path.includes('.env'))).toEqual([])
    expect(asked.length).toBe(1)
  })
})

describe('setup guide', () => {
  const DESK = { plugin: 'effortless', surface: 'desktop', ...BAND } as never
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const settings = (on: On) => {
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    return set
  }
  const toasts = (on: On) => {
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    return said
  }

  test('an app with no /config row for the plugin: the choices are kept in the store and come back next session', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('config.set', () => ({ deny: 'no /config row with key effortless.judge ($.config.list names them)' }) as never)
    const said = toasts(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-haiku' })
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-next' })
    await band.press({ key: 'setup-done' })
    await band.unmount()
    await mocked.advance(16_000)
    expect(said.join(' ')).not.toContain('could not save')
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'effortless', args: 'settings' })
    const panel = await $.ui.mount(DESK)
    expect(await drawn(panel)).toContain('Haiku')
    await panel.press({ key: 'settings-card-judge' })
    expect(await drawn(panel)).toContain('Haiku only')
    expect(await drawn(panel)).not.toContain('custom')
    await panel.unmount()
  })

  test('the steps run judge, lean, handoff, done; Back goes one step back', () => {
    expect(setupNext('pick')).toBe('lean')
    expect(setupNext('decision')).toBe('lean')
    expect(setupNext('lean')).toBe('handoff')
    expect(setupNext('handoff')).toBe('look')
    expect(setupNext('look')).toBe('done')
    expect(setupNext('done')).toBeNull()
    expect(setupBack('pick')).toBeNull()
    expect(setupBack('decision')).toBe('pick')
    expect(setupBack('lean')).toBe('pick')
    expect(setupBack('look')).toBe('handoff')
    expect(setupBack('done')).toBe('look')
    expect(setupCounter('decision')).toBe('1/4')
    expect(setupCounter('handoff')).toBe('3/4')
    expect(setupCounter('look')).toBe('4/4')
    expect(setupCounter('done')).toBe('')
  })

  test('opens by itself the first time; the choices are saved together at Done, which closes it for good', async ($, on) => {
    engine(on)
    mock.clock(on)
    const set = settings(on)
    const said = toasts(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    expect(await band.find({ key: 'setup-haiku' })).toBeDefined()
    expect(await band.find({ key: 'setup-custom' })).toBeUndefined()
    expect(await band.find({ key: 'setup-back' })).toBeUndefined()
    await clickable(band, 'setup-actions')
    // Branded: the name in the footer's purple, the step counter beside it.
    expect(await drawn(band)).toContain('"color":"merged"')
    expect(await drawn(band)).toContain('✦ effortless setup  1/4')
    expect(await drawn(band)).toContain('Just Haiku (no key)')
    // The right side: a still SVG (every click redraws the band, and a redrawn animation flickers) with the gradient.
    const first = await drawn(band)
    expect(first).toContain('"type":"Svg"')
    expect(first).not.toContain('"isInteractive":true')
    expect(first).toContain('linearGradient')
    await band.press({ key: 'setup-haiku' })
    // Nothing is saved yet: each saved setting reloads the plugin and puts a notice in the chat.
    expect(set).toEqual([])
    expect(said.join(' ')).toContain('Haiku 5.5 judges')

    // 2/4 the lean: each stop is named and says what it does; the track lights toward the marker.
    expect(await drawn(band)).toContain('2/4')
    expect(await drawn(band)).toContain('Balanced: ')
    await band.press({ key: 'setup-bias4' })
    expect(await drawn(band)).toContain('Smartest: ')
    expect(await drawn(band)).toContain('{"color":"merged"},"children":["──"]')
    await band.press({ key: 'setup-next' })

    // 3/4 the handoff: the installed skills to pick from.
    expect(await drawn(band)).toContain('3/4')
    expect(await drawn(band)).toContain('/session-handoff')
    await band.select({ key: 'setup-skill', value: 'session-handoff' })
    await band.press({ key: 'setup-next' })

    // 4/4 the look: match Claude Code, dark or light. Light is picked here.
    expect(await drawn(band)).toContain('4/4')
    expect(await drawn(band)).toContain('Dark or light panels?')
    expect(await drawn(band)).toContain('◉ Match app')
    await band.press({ key: 'setup-look-light' })
    expect(await drawn(band)).toContain('◉ Light')
    await band.press({ key: 'setup-next' })

    // The last word: the footer's buttons; no step of ticks. Back goes to the look step.
    expect(await drawn(band)).toContain('Auto on or off')
    expect(await band.find({ key: 'setup-box-timer' })).toBeUndefined()
    await band.press({ key: 'setup-back' })
    expect(await drawn(band)).toContain('4/4')
    await band.press({ key: 'setup-next' })
    expect(set).toEqual([])
    await band.press({ key: 'setup-done' })
    expect(set).toEqual([
      { key: 'effortless.effortBias', value: '2' },
      { key: 'effortless.handoffSkill', value: 'session-handoff' },
      { key: 'effortless.appearance', value: 'light' },
    ])
    await band.unmount()
    await drawsNothing($, DESK)

    // A new session: the guide stays closed; /effortless setup opens it again.
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await drawsNothing($, DESK)
    await $.command.run({ command: 'effortless', args: 'setup' })
    const again = await $.ui.mount(DESK)
    expect(await again.find({ key: 'setup-decision' })).toBeDefined()
    await again.unmount()
  })

  test('a decision model without a key asks for it in the band; Skip goes on to the lean, Back returns to the pick', async ($, on) => {
    engine(on)
    mock.clock(on)
    const set = settings(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-decision' })
    // Fork: first where the decision model runs; the TypeSafe key is one of three.
    expect(await drawn(band)).toContain('Where should the decision model run?')
    await band.press({ key: 'setup-typesafe' })
    expect(set).toEqual([])
    expect(await drawn(band)).toContain('typesafe.ai')
    expect(await band.find({ key: 'setup-key' })).toBeDefined()
    expect(await band.find({ key: 'setup-haiku' })).toBeUndefined()
    await band.press({ key: 'setup-skip' })
    expect(await band.find({ key: 'setup-bias2' })).toBeDefined()
    await band.press({ key: 'setup-back' })
    expect(await band.find({ key: 'setup-decision' })).toBeDefined()
    // The cross keeps what was picked so far.
    await band.press({ key: 'setup-close' })
    expect(set).toEqual([])
    await band.unmount()
  })

  test('the TypeSafe key step saves a pasted env line\'s value; a failed save stays on the step', async ($, on) => {
    engine(on, { USERPROFILE: '/Users/x' })
    mock.clock(on)
    settings(on)
    let fail = true
    const files: Record<string, string> = {}
    on('fs.read', () => ({ value: '' }) as never)
    on('fs.write', (_$, e) => {
      if (fail) throw new Error('read-only')
      files[e.path.split('\\').join('/')] = e.text
      return { value: undefined } as never
    })
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-decision' })
    await band.press({ key: 'setup-typesafe' })
    await band.input({ key: 'setup-key', text: 'TYPESAFE_API_KEY=pasted-k' })
    expect(await band.find({ key: 'setup-key' })).toBeDefined()
    fail = false
    await band.input({ key: 'setup-key', text: 'TYPESAFE_API_KEY=pasted-k' })
    expect(files['/Users/x/.config/jev/.env']).toBe('TYPESAFE_API_KEY=pasted-k\n')
    expect(await band.find({ key: 'setup-bias2' })).toBeDefined()
    await band.unmount()
  })

  test('Skip on the judge keeps the default judge and moves on; the footer then shows the gear', async ($, on) => {
    engine(on)
    mock.clock(on)
    const set = settings(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-skip' })
    expect(set).toEqual([])
    expect(await drawn(band)).toContain('2/4')
    await band.press({ key: 'setup-close' })
    await band.unmount()
    const footer = await $.ui.mount(FOOTER)
    expect(await footer.find({ key: 'setup' })).toBeUndefined()
    expect(await footer.find({ key: 'settings' })).toBeDefined()
    await footer.unmount()
  })

  test('a TypeSafe key already in the environment adds typesafe/jev-latest with no second step', async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    const set = settings(on)
    const said = toasts(on)
    await start($, on)
    const band = await $.ui.mount(DESK)
    await band.press({ key: 'setup-decision' })
    expect(said.join(' ')).toContain('typesafe/jev-latest is a decision model now')
    expect(await drawn(band)).toContain('2/4')
    await band.press({ key: 'setup-close' })
    expect(set).toContainEqual({ key: 'effortless.decisionModels', value: 'typesafe/jev-latest' })
    await band.unmount()
    await drawsNothing($, DESK)
  })
})

describe('judge failures are said', () => {
  test('judgeFailure names the cause', () => {
    expect(judgeFailure('Decision model', 402)).toContain('out of credits')
    expect(judgeFailure('Decision model', 429)).toContain('rate limited')
    expect(judgeFailure('Decision model', 401)).toContain('rejected the key')
    expect(judgeFailure('Decision model', 'timeout')).toContain('did not answer')
  })

  test('a decision model out of credits: the person is told once, and Haiku judges', { options: { decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    on('http.fetch', () => ({ value: { status: 402, ok: false, headers: {}, text: 'payment required' } }))
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await $.prompt.submit({ text: 'first question here', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'second question here', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(2)
    expect(said.filter(t => t.includes('out of credits')).length).toBe(1)
    expect(said[0]).toContain('Haiku judges for now')
  })
})

describe('short answers to a question', () => {
  test('a short reply after a question goes to the judge; between two steps it keeps the effort', () => {
    const asked = 'user: tidy up\nassistant: Done. Should I archive it?'
    const told = 'user: add export\nassistant: Added the button. Next I wire it up.'
    expect(endsOnQuestion(asked)).toBe(true)
    expect(endsOnQuestion(told)).toBe(false)
    expect(endsOnQuestion('')).toBe(false)
    expect(keepsEffort('yes', asked)).toBe(false)
    expect(keepsEffort('go', told)).toBe(true)
    expect(keepsEffort('build the whole thing', told)).toBe(false)
  })

  test('"yes" to "should I archive it?" is judged, not kept', async ($, on) => {
    const said: { role: string; text: string }[] = []
    engine(on, {}, 'claude-sonnet-5-5', said)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    said.push({ role: 'assistant', text: 'Done. Should I archive the old branch?' })
    await $.prompt.submit({ text: 'yes', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(2)
  })

})

describe('images', () => {
  test('the judge is told what the message carries', () => {
    expect(withAttachments('fix this', [{ type: 'image' }, { type: 'image' }])).toContain('[The message comes with 2 images to look at.]')
    expect(withAttachments('fix this')).toBe('fix this')
  })

  test('"fix this" with a screenshot is judged, not kept as a follow-up', async ($, on) => {
    engine(on, {}, 'claude-sonnet-5-5')
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"medium","sonnet":"medium","opus":"medium","why":"x"}')
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    await $.prompt.submit({ text: 'fix this', wait: false, origin: { kind: 'composer' }, attachments: [{ type: 'image', mediaType: 'image/png' }] } as never)
    expect(asked.length).toBe(2)
    expect(asked[1]).toContain('1 image')
  })
})

describe('compaction by Haiku', () => {
  const SUMMARY = '1. Primary request: rename userId across the app. ' + 'Details. '.repeat(40)
  const said = [
    { role: 'user', text: 'rename this variable to userId', toolUses: [] },
    { role: 'assistant', text: 'Renamed in 4 files.', toolUses: [{ tool_use_id: 't1', tool: 'Edit', input: { file_path: 'a.ts' }, text: 'x'.repeat(5000) }] },
  ]
  /** Claude Code's own compaction beneath the mod, and whether it ran. */
  const core = (on: On) => {
    const ran = { core: 0 }
    on('session.compact', (_$, e) => {
      ran.core++
      return { messages: [{ role: 'user', text: 'core summary', toolUses: [] }] } as never
    })
    return ran
  }

  test('the last messages reach Haiku nearly whole: the code just written is not cut to 400 characters', () => {
    const code = 'x'.repeat(5000)
    const old = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i}`, toolUses: [{ tool: 'Edit', input: { new_string: code }, text: code }] }))
    const text = compactTranscript(old as never)
    // The first message is cut, the last one is whole.
    expect(text.split('turn 0')[1].split('turn 1')[0]).toContain('more characters')
    expect(text.split('turn 9')[1]).not.toContain('more characters')
  })

  test('the transcript names each tool call and cuts long results', () => {
    // Two messages are all tail; with the tail held to the same 2000 the cut shows.
    const text = compactTranscript(said as never, 2000, 2000)
    expect(text).toContain('USER: rename this variable to userId')
    expect(text).toContain('[Edit {"file_path":"a.ts"}]')
    expect(text).toContain('[3000 more characters]')
  })

  test('Haiku 5.5 writes the summary, with the note typed after /compact; Claude Code does not compact', async ($, on) => {
    engine(on, {}, 'claude-opus-5-5', said as never)
    const ran = core(on)
    const asked: { model: string; prompt: string }[] = []
    on('model.complete', (_$, e) => {
      asked.push({ model: e.model, prompt: e.prompt })
      return { value: { isAnswered: true as const, text: SUMMARY, usage: USAGE } }
    })
    const out = (await $.session.compact({ instructions: 'keep the API decisions' })) as { messages?: { text: string }[] }
    expect(ran.core).toBe(0)
    expect(asked[0].model).toBe('claude-haiku-5-5')
    expect(asked[0].prompt).toContain('keep the API decisions')
    expect(out.messages?.[0].text).toContain('rename userId across the app')
  })

  test('when Haiku fails, Claude Code compacts as usual and a toast says why', async ($, on) => {
    engine(on)
    const ran = core(on)
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
      return { value: undefined } as never
    })
    on('model.complete', () => ({ value: { isAnswered: false as const, reason: 'api-error', status: 500 } }) as never)
    await $.session.compact({})
    expect(ran.core).toBe(1)
    expect(toasts.join(' ')).toContain('Haiku could not compact')
  })

  test("set to the chat's model, Claude Code compacts and Haiku is never asked", { options: { compactWith: 'session' } } as never, async ($, on) => {
    engine(on)
    const ran = core(on)
    let asked = 0
    on('model.complete', () => {
      asked++
      return { value: { isAnswered: true as const, text: SUMMARY, usage: USAGE } }
    })
    await $.session.compact({})
    expect(ran.core).toBe(1)
    expect(asked).toBe(0)
  })
})

describe('deciding glow', () => {
  const op = (svg: string | null) => Number(/\.r\{opacity:([\d.]+)/.exec(svg ?? '')?.[1] ?? NaN)
  test('rises, holds at full while deciding as a still image, then fades from full in short pieces', () => {
    const at = (end: number | null, now: number) => judgeGlowAt(1000, end, now)
    expect(at(null, 999)).toBeNull()
    expect(op(at(null, 1000))).toBe(0)
    expect(op(at(null, 1000 + JUDGE_RISE_MS / 2))).toBeGreaterThan(0.3)
    // Held: no animation at all, so an old copy drawn again cannot restart anything.
    for (const now of [1000 + JUDGE_RISE_MS, 1900, 9000]) {
      expect(at(null, now)).not.toContain('animation')
      expect(op(at(null, now))).toBe(0.85)
    }
    // A verdict after the rise: the fade starts at once, from full, in pieces of JUDGE_STEP_MS.
    expect(op(at(3000, 3000))).toBe(0.85)
    expect(at(3000, 3000)).toContain('animation:r ' + (JUDGE_PIECE_MS / 1000).toFixed(3) + 's linear forwards')
    expect(at(3000, 3000 + JUDGE_FADE_MS)).toBeNull()
    // A verdict inside the rise: the rise finishes first, so the fade never starts from half-way.
    expect(op(at(1100, 1300))).toBeLessThan(0.85)
    expect(op(at(1100, 1000 + JUDGE_RISE_MS))).toBe(0.85)
    expect(at(1100, 1000 + JUDGE_RISE_MS + JUDGE_FADE_MS)).toBeNull()
  })
  test('each piece runs along the true curve for longer than the app takes to redraw, so the fade never stands still or goes up', () => {
    const pts = (svg: string) => [...svg.matchAll(/(\d+)%\{opacity:([\d.]+)\}/g)].map(m => Number(m[2]))
    for (let t = 0; t < JUDGE_FADE_MS; t += 37) {
      const p = pts(judgeGlowSvg('fade', t))
      expect(p.length).toBe(5)
      // Starts on the curve, only goes down, and ends where the curve is at the end of the piece.
      expect(Math.abs(p[0] - judgeBrightnessAt('fade', t))).toBeLessThan(0.001)
      for (let k = 1; k < 5; k++) expect(p[k]).toBeLessThanOrEqual(p[k - 1])
      expect(Math.abs(p[4] - judgeBrightnessAt('fade', Math.min(JUDGE_FADE_MS, t + JUDGE_PIECE_MS)))).toBeLessThan(0.001)
    }
    expect(JUDGE_PIECE_MS).toBeGreaterThan(120)
    expect(pts(judgeGlowSvg('fade', JUDGE_FADE_MS - 10))[4]).toBe(0)
    expect(Math.abs(judgeBrightnessAt('fade', JUDGE_FADE_MS / 2) - 0.425)).toBeLessThan(0.001)
  })
})

describe('cold band', () => {
  test('shows above the prompt when the cache is cold, compacts in one click, and hides until the next cold', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('session.compact', () => ({ value: { messages: [] } }) as never)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const DESK = { plugin: 'effortless', surface: 'desktop', ...BAND } as never
    const guide = await $.ui.mount(DESK)
    await guide.press({ key: 'setup-haiku' })
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'effortless', args: 'cold' })
    const band = await $.ui.mount(DESK)
    expect(await drawn(band)).toContain('Chat went cold')
    expect(await drawn(band)).toContain('class=\\"f\\"')
    await band.press({ key: 'cold-hide' })
    await band.unmount()
    await drawsNothing($, DESK)
  })
})

describe('handoff', () => {
  test('the first message carries the handoff and what to do next', () => {
    expect(handoffMessage(' the plan ', 'continue')).toBe(
      'Handoff from the previous chat:\n\nthe plan\n\nContinue with the next step. If it is marked "needs user", say what you need and wait.',
    )
    expect(handoffMessage('x', 'confirm')).toContain('then wait for me')
    // Full: the skill saved the handoff; its last words may only say so. The new chat reads what it saved first.
    const full = handoffMessage("I've saved the handoff.", 'continue', 'session-handoff')
    expect(full).toContain('it ran /session-handoff')
    expect(full).toContain('First read the handoff /session-handoff saved')
    expect(full).toContain('HANDOFF.md')
    expect(full).toContain('Continue with the next step')
  })

  test('the prompt asks for checked work, marked user steps and git as of last check', () => {
    expect(HANDOFF_PROMPT).toContain('needs user')
    expect(HANDOFF_PROMPT).toContain('as of last check')
    expect(HANDOFF_PROMPT).toContain('Never present something planned, skipped or untested as done')
    expect(HANDOFF_PROMPT).toContain('Do not use tools')
  })

  /** Presses ⇥ in the footer, makes the choices in the handoff bar, and presses Go. */
  async function handOff($: Engine, footer: { press: (at: { key: string }) => Promise<unknown> }, keys: string[] = [], after?: string) {
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    for (const key of keys) await bar.press({ key })
    if (after) await bar.select({ key: 'handoff-after', value: after })
    await bar.press({ key: 'handoff-go' })
    await bar.unmount()
  }

  function handoffEngine(on: On, said: { role: string; text: string }[] = []) {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: said }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: quick.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    return { forked, ran, submitted }
  }

  test('⇥ opens the handoff bar; it says what happens and starts nothing until Go', async ($, on) => {
    const { forked } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await clickable(bar, 'handoff-actions')
    expect(await drawn(bar)).toContain('Handoff')
    expect(await drawn(bar)).toContain('A few seconds')
    await bar.select({ key: 'handoff-after', value: 'copy' })
    expect(await drawn(bar)).toContain('"value":"copy"')
    await mocked.advance(2500)
    expect(forked).toEqual([])
    await bar.press({ key: 'handoff-close' })
    await bar.unmount()
    const after = await $.ui.mount(DESK_BAND)
    expect(await after.find({ key: 'handoff-go' })).toBeUndefined()
    await after.unmount()
    await footer.unmount()
  })

  test('on a cold cache, Quick is written by Haiku from the transcript, not a fork that rereads the chat', async ($, on) => {
    const { forked, submitted } = handoffEngine(on, [{ role: 'user', text: 'build the thing' }, { role: 'assistant', text: 'built it' }])
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(String(e.model))
      return { value: { isAnswered: true as const, text: `Goal: from Haiku. ${'x'.repeat(120)}`, usage: USAGE } }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'effortless', args: 'cold' })
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, ['handoff-quick'])
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(asked.some(m => m.includes('haiku'))).toBe(true)
    expect(submitted.some(t => t.includes('Goal: from Haiku'))).toBe(true)
    await footer.unmount()
  })

  test('hotVisible: closed, the band stays away for its window and comes back once at 95%', () => {
    const heat = { kind: 'five_hour', percent: 82, resetsAt: '2026-10-10T20:00:00Z' }
    expect(hotVisible(heat, null)).toBe(true)
    const closed = { window: 'five_hour ' + Math.round(new Date(heat.resetsAt).getTime() / 900_000), percent: 82 }
    expect(hotVisible({ ...heat, percent: 91 }, closed)).toBe(false)
    expect(hotVisible({ ...heat, percent: 96 }, closed)).toBe(true)
    expect(hotVisible({ ...heat, percent: 96 }, { ...closed, percent: 96 })).toBe(false)
    expect(hotVisible({ ...heat, resetsAt: '2026-10-11T01:00:00Z' }, closed)).toBe(true)
  })

  test('with a skill set, Quick forks and Full runs the skill', { options: { handoffSkill: 'session-handoff' } } as never, async ($, on) => {
    const { forked, ran, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, ['handoff-quick'])
    await mocked.advance(2500)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(ran).not.toContain('session-handoff')
    expect(ran).toContain('clear')
    await handOff($, footer, ['handoff-full'])
    await mocked.advance(1000)
    expect(ran).toContain('session-handoff')
    expect(forked).toHaveLength(1)
    // The skill's last words only say it saved the handoff: the new chat is told to read what it saved.
    await $.turn.complete({ turnId: 't2', answer: "I've saved the handoff.", durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await mocked.advance(2500)
    expect(submitted.at(-1)).toContain('First read the handoff /session-handoff saved')
    await footer.unmount()
  })

  test('the bar opens on the choice made last', { options: { handoffSkill: 'session-handoff' } } as never, async ($, on) => {
    handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, ['handoff-full'], 'confirm')
    await mocked.advance(1000)
    await $.turn.complete({ turnId: 't1', answer: 'Goal: full.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await mocked.advance(1500)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    expect(await drawn(bar)).toContain('"/session-handoff"')
    expect(await drawn(bar)).toContain('"value":"confirm"')
    await bar.unmount()
    await footer.unmount()
  })

  test("without a skill, Full is effortless's own: a turn that checks git and saves HANDOFF.md, no fork", async ($, on) => {
    const { forked, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await bar.press({ key: 'handoff-full' })
    expect(await drawn(bar)).toContain('Checks git, saves HANDOFF.md')
    await bar.press({ key: 'handoff-go' })
    await mocked.advance(2500)
    expect(forked).toEqual([])
    expect(submitted.some(t => t.includes('HANDOFF.md in the first of these folders'))).toBe(true)
    await bar.unmount()
    await footer.unmount()
  })

  test('Keep chat & copy copies the handoff and clears nothing', async ($, on) => {
    const { ran, submitted } = handoffEngine(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, [], 'copy')
    await mocked.advance(2500)
    expect(copied).toHaveLength(1)
    expect(copied[0]).toContain('Goal: quick.')
    expect(copied[0]).toContain('Continue with the next step.')
    expect(ran).not.toContain('clear')
    expect(submitted).toEqual([])
    await footer.unmount()
  })

  test('a handoff card shows above the prompt, not under the reply: handing off, then landed, gone after the next message', async ($, on) => {
    handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: true } }) as never)
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const reply = (text: string) =>
      ({ plugin: 'effortless', surface: 'desktop', component: 'AssistantMessage', props: { text, isFirstOfReply: true } }) as never
    await $.turn.complete({ turnId: 't1', answer: 'Last reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    await bar.select({ key: 'handoff-after', value: 'copy' })
    await bar.press({ key: 'handoff-go' })
    await bar.unmount()
    // The first-run guide comes before the card: closed here.
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    const under = await $.ui.mount(reply('Last reply.'))
    expect(await under.find({ key: 'reply-handoff' })).toBeUndefined()
    await under.unmount()
    const during = await $.ui.mount(DESK_BAND)
    expect(await drawn(during)).toContain('Handing off')
    await during.unmount()
    await mocked.advance(2500)
    const landed = await $.ui.mount(DESK_BAND)
    expect(await drawn(landed)).toContain('Handoff copied')
    expect(await landed.find({ key: 'card-close' })).toBeDefined()
    await landed.unmount()
    await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })
    await $.turn.complete({ turnId: 't2', answer: 'Next reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    // The card is gone: the band draws whatever else it has, or nothing.
    const after = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(after ? await after.find({ key: 'reply-handoff' }) : undefined).toBeUndefined()
    await after?.unmount()
    await footer.unmount()
  })

  test('if the clipboard refuses, the handoff goes in the prompt box', async ($, on) => {
    const { ran } = handoffEngine(on)
    on('ui.copy', () => ({ value: { isCopied: false, reason: 'no clipboard' } }) as never)
    const filled: string[] = []
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer, [], 'copy')
    await mocked.advance(2500)
    expect(filled.join('')).toContain('Goal: quick.')
    expect(ran).not.toContain('clear')
    await footer.unmount()
  })

  test('the handoff is written by a fork: no turn in the chat, then cleared and sent', async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const forked: string[] = []
    on('model.fork', (_$, e) => {
      forked.push(e.prompt)
      return { value: { isAnswered: true, text: 'Goal: fork it. Next: ship.', usage: USAGE } } as never
    })
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(submitted).not.toContain(HANDOFF_PROMPT)
    await mocked.advance(1500)
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: fork it. Next: ship.')
    await footer.unmount()
  })

  test('without a fork (no reply yet, or it failed) the handoff is written as a turn, then cleared and sent', async ($, on) => {
    // engine() without its prompt.submit, so this test can see what the mod sends.
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    const ran: string[] = []
    on('command.run', (_$, e) => {
      ran.push(e.command)
      return { text: 'ok' }
    })
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    await $.turn.complete({ turnId: 't9', answer: 'Goal: ship it. Next: tests.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    await mocked.advance(1500)
    expect(ran).toContain('clear')
    expect(submitted.at(-1)).toContain('Goal: ship it. Next: tests.')
    expect(submitted.at(-1)).toContain('Continue with the next step.')
    await footer.unmount()
  })

  test('a fork that writes nothing says why: in a toast and in /effortless debug, and the turn takes over', async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }] as never }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('model.fork', () => ({ value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE } }) as never)
    on('command.run', () => ({ text: 'ok' }))
    const submitted: string[] = []
    on('prompt.submit', (_$, e) => {
      submitted.push(e.text)
      return { text: e.text }
    })
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await handOff($, footer)
    await mocked.advance(1000)
    expect(submitted.at(-1)).toBe(HANDOFF_PROMPT)
    expect(toasts.join(' ')).toContain('api-error 529 overloaded')
    const debug = String((await $.command.run({ command: 'effortless', args: 'debug' })).text)
    expect(debug).toContain('last fork: api-error 529 overloaded')
    await footer.unmount()
  })

  test('the fork outcome names the reason, or what an answer cost', () => {
    expect(forkOutcome({ isAnswered: false, reason: 'nothing-to-fork' }, 0)).toBe('nothing-to-fork (0.0s)')
    expect(forkOutcome({ isAnswered: false, reason: 'aborted', usage: USAGE }, 2500)).toBe('aborted (2.5s)')
    expect(forkOutcome({ isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage: USAGE }, 0)).toBe('api-error no response unknown (0.0s)')
    expect(forkOutcome(new Error('refused from a timer'), 100)).toBe('threw: refused from a timer (0.1s)')
    const usage = { input_tokens: 10, output_tokens: 700, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 }
    expect(forkOutcome({ isAnswered: true, text: 'Goal', usage }, 4000)).toBe('answered, 700 out, 90% cached (4.0s)')
    expect(forkOutcome({ isAnswered: true, text: '  ', usage }, 0)).toBe('answered with blank text (0.0s)')
  })
})

describe('swamp band and setup entry', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('the swamp band waits for the threshold set: 21% of a 1M window is not swamped at the default 70%', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 208_000, window: 1_000_000, percent: 21 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    // Nothing to draw above the prompt: the engine has no band to mount.
    const band = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(band ? await drawn(band) : '').not.toContain('Chat is getting swamped')
    await band?.unmount()
  })

  test('at a 20% threshold the same chat is swamped', { options: { swampAt: '20' } } as never, async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 208_000, window: 1_000_000, percent: 21 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    await band.unmount()
  })

  test('a swamped context shows Compact and Handoff above the prompt; closing hides it until the context grows', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let tokens = 180_000
    on('session.usage', () => ({ value: { context: { tokens, window: 250_000, percent: Math.round(tokens / 2_500) } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    expect(await drawn(band)).toContain('180k tokens')
    expect(await band.find({ key: 'swamp-compact' })).toBeDefined()
    expect(await band.find({ key: 'swamp-handoff' })).toBeDefined()
    await band.press({ key: 'swamp-close' })
    await band.unmount()
    await drawsNothing($, DESK_BAND)
    tokens = 240_000
    await mocked.advance(16_000)
    const again = await $.ui.mount(DESK_BAND)
    expect(await drawn(again)).toContain('240k tokens')
    await again.unmount()
  })

  test('the swamp band waits while a turn runs and comes back when it ends', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('turn.complete', () => ({ text: '' }) as never)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.prompt.submit({ text: '/status', wait: false, origin: { kind: 'composer' } })
    const busy = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(busy ? await drawn(busy) : '').not.toContain('Chat is getting swamped')
    await busy?.unmount()
    await $.turn.complete({ turnId: 't1', answer: 'Done.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const after = await $.ui.mount(DESK_BAND)
    expect(await drawn(after)).toContain('Chat is getting swamped')
    await after.unmount()
  })

  test('while compacting, the swamp band steps aside: the card under the reply says it', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let release = () => {}
    on('command.run', (_$, e) => {
      if (e.command !== 'compact') return { text: 'ok' }
      return new Promise(resolve => {
        release = () => resolve({ text: 'ok' })
      }) as never
    })
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'swamp-compact' })
    const pressed = band.press({ key: 'compact-go' })
    await mocked.advance(100)
    const during = await $.ui.mount(DESK_BAND).catch(() => null)
    expect(during ? await drawn(during) : '').not.toContain('Chat is getting swamped')
    expect(await during?.find({ key: 'swamp-compact' })).toBeUndefined()
    release()
    await pressed
    await during?.unmount()
    await band.unmount()
  })

  test('Compact shows its card above the prompt at once: Compacting while it runs, then Compact complete until the next reply', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let release = () => {}
    on('command.run', (_$, e) => {
      if (e.command !== 'compact') return { text: 'ok' }
      return new Promise(resolve => {
        release = () => resolve({ text: 'ok' })
      }) as never
    })
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.turn.complete({ turnId: 't1', answer: 'Last reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const reply = () => $.ui.mount({ plugin: 'effortless', surface: 'desktop', component: 'AssistantMessage', props: { text: 'Last reply.', isFirstOfReply: true } } as never)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'swamp-compact' })
    const pressed = band.press({ key: 'compact-go' })
    await mocked.advance(100)
    expect(await drawn(band)).toContain('Compacting…')
    // Not under the old reply: after a compact no reply sits past the boundary.
    const during = await reply()
    expect(await during.find({ key: 'reply-handoff' })).toBeUndefined()
    await during.unmount()
    release()
    await pressed
    expect(await drawn(band)).toContain('Compact complete')
    await band.unmount()
    // The first reply after it takes it away.
    await $.turn.complete({ turnId: 't2', answer: 'Next reply.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const later = await $.ui.mount(DESK_BAND)
    expect(await drawn(later)).not.toContain('Compact complete')
    await later.unmount()
  })

  test('a swamped chat draws no card under the reply: the band above the prompt says it', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 200_000, window: 250_000, percent: 80 } } }) as never)
    on('turn.complete', (_$, e) => ({ text: e.answer }))
    // The app's own drawing of a reply block, beneath the plugin.
    on('ui.render', { component: 'AssistantMessage' }, (h, e) => {
      const { Text } = h.ui.resolve(e)
      return Text({ children: e.props.text } as never) as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    await $.turn.complete({ turnId: 't1', answer: 'First answer.', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const reply = await $.ui.mount({ plugin: 'effortless', surface: 'desktop', component: 'AssistantMessage', props: { text: 'First answer.', isFirstOfReply: true } } as never)
    expect(await reply.find({ key: 'reply-warn' })).toBeUndefined()
    expect(await drawn(reply)).not.toContain('swamped')
    await reply.unmount()
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat is getting swamped')
    await band.unmount()
  })

  test('/effortless save switches save mode on and off', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    expect(String((await $.command.run({ command: 'effortless', args: 'save' })).text)).toContain('save mode on')
    expect(String((await $.command.run({ command: 'effortless', args: 'save' })).text)).toContain('save mode off')
  })

  test('save mode paints the footer level ember; off again, it is purple', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await $.command.run({ command: 'effortless', args: 'save' })
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).toContain('"color":"claude"')
    await $.command.run({ command: 'effortless', args: 'save' })
    await footer.unmount()
    const again = await $.ui.mount(FOOTER)
    const text = await drawn(again)
    expect(text).not.toContain('"color":"claude"')
    expect(text).toContain('"color":"merged"')
    await again.unmount()
  })

  test('the setup can be closed with the cross; the footer then offers Setup, which opens it again', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await drawsNothing($, DESK_BAND)
    const footer = await $.ui.mount(FOOTER)
    expect(await footer.find({ key: 'setup' })).toBeDefined()
    await footer.press({ key: 'setup' })
    const reopened = await $.ui.mount(DESK_BAND)
    expect(await reopened.find({ key: 'setup-decision' })).toBeDefined()
    await reopened.press({ key: 'setup-haiku' })
    await reopened.press({ key: 'setup-close' })
    await reopened.unmount()
    expect(await footer.find({ key: 'setup' })).toBeUndefined()
    // Once set up, the same place is a gear that opens the settings panel.
    await footer.press({ key: 'settings' })
    const panel = await $.ui.mount(DESK_BAND)
    expect(await drawn(panel)).toContain('"key":"settings-title"')
    await panel.unmount()
    await footer.unmount()
  })
})

describe('running hot and judge down', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('save mode caps at medium, and reset times read short', () => {
    expect(capped('xhigh', true)).toBe('medium')
    expect(capped('low', true)).toBe('low')
    expect(capped('xhigh', false)).toBe('xhigh')
    const now = new Date('2026-10-06T10:00:00').getTime()
    expect(resetLabel('2026-10-06T14:20:00', now)).toBe('14:20')
    expect(resetLabel(null, now)).toBe('')
  })

  test('a limit past 80% shows the running-hot band; save mode can be switched on', async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [
      { kind: 'five_hour', percentUsed: 84, resetsAt: '2026-10-06T14:20:00Z' },
      { kind: 'seven_day', percentUsed: 40 },
    ] } }) as never)
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Running hot')
    expect(await drawn(band)).toContain('84% of your 5h limit used')
    await band.press({ key: 'hot-save' })
    expect(said.join(' ')).toContain('save mode on')
    await band.unmount()
  })

  test('a failing judge shows the judge-down band until it answers again', { options: { decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    let status = 402
    on('http.fetch', () => ({ value: status === 200
      ? { status: 200, ok: true, headers: {}, text: decisionReply('high', 0.9) }
      : { status, ok: false, headers: {}, text: 'payment required' } }))
    on('ui.toast', () => ({ value: undefined }) as never)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.prompt.submit({ text: 'refactor the sync engine end to end', wait: false, origin: { kind: 'composer' } })
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Judge down')
    expect(await drawn(band)).toContain('out of credits')
    await band.unmount()
    status = 200
    await $.prompt.submit({ text: 'now write tests for the queue module', wait: false, origin: { kind: 'composer' } })
    await drawsNothing($, DESK_BAND)
  })
})

describe('settings panel', () => {
  test('settings asked for before a restart open after it, and drawing writes no state', async ($, on) => {
    // The store outlives a restart, the state does not: the request the load before left for this chat.
    mock.store(on, { openSettingsAt: { at: Date.now(), session: 'chat-1' } })
    mock.env(on, {})
    const mocked = mock.clock(on)
    on('ui.status', () => ({ value: undefined }))
    on('session.messages', () => ({ value: [] }) as never)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.id', () => ({ value: 'chat-1' }) as never)
    on('command.list', () => ({ value: [] as never }))
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await mocked.advance(10)
    await ui.redraw()
    expect(await drawn(ui)).toContain('"key":"settings"')
    const debug = String((await $.command.run({ command: 'effortless', args: 'debug' } as never)).text)
    expect(debug).toContain('band error: none')
    await ui.unmount()
  })

  test('Test asks the picked judge one sample and says if it answered, or why not', { options: { layout: 'default', decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'k' })
    mock.clock(on)
    let status = 200
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(String(e))
      return { value: undefined } as never
    })
    on('http.fetch', () => ({ value: { status, ok: status === 200, headers: {}, text: status === 200 ? decisionReply('low') : 'no' } }))
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'dash-settings' })
    await band.press({ key: 'settings-card-judge' })
    await band.press({ key: 'settings-judge-test' })
    const result = async () => (await band.findAll({ type: 'Text' })).map(t => t.text).find(t => /^[✓✗]/.test(t))
    expect(await result()).toContain('✓ jev-latest answered: haiku low 90% · sonnet low 90% · opus low 90% · fable low 90% in')
    status = 401
    await band.press({ key: 'settings-judge-test' })
    expect(await result()).toBe('✗ TypeSafe jev-latest rejected the key (401)')
    // A test warns nobody: no toast, no judge-down band.
    expect(toasts).toEqual([])
    await band.unmount()
  })

  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('Test sends a typed TYPESAFE_API_KEY=… line as its value', { options: { layout: 'default', decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { TYPESAFE_API_KEY: 'env-k' })
    mock.clock(on)
    const auth: (string | undefined)[] = []
    on('http.fetch', (_$, e) => {
      auth.push((e.init?.headers as Record<string, string> | undefined)?.authorization)
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('low') } }
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'dash-settings' })
    await band.press({ key: 'settings-card-judge' })
    await band.input({ key: 'settings-key', text: 'TYPESAFE_API_KEY=draft-k' })
    await band.press({ key: 'settings-judge-test' })
    // A line with no value falls back to the key in force.
    await band.input({ key: 'settings-key', text: 'TYPESAFE_API_KEY=' })
    await band.press({ key: 'settings-judge-test' })
    expect(auth).toEqual(['Bearer draft-k', 'Bearer env-k'])
    await band.unmount()
  })

  test('a lower Max saved in the panel brings the pick down at once', { options: { layout: 'default' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('config.set', (_$, e) => ({ value: e.value }) as never)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"hard"}')
    const sent = recordSteps(on)
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.prompt.submit({ text: 'hard task', wait: false, origin: { kind: 'composer' } })
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'dash-settings' })
    await band.press({ key: 'settings-card-effort' })
    await band.select({ key: 'settings-ceiling', value: 'medium' })
    await band.press({ key: 'settings-save' })
    await step($, 'high')
    expect(sent[0].effort).toBe('medium')
    await band.unmount()
  })

  test('the slider tips only close calls; floor and ceiling clamp; the key line is set in place', () => {
    expect(tipped('medium', 0.6, 1)).toBe('high')
    expect(tipped('medium', 0.9, 1)).toBe('medium')
    expect(tipped('medium', 0.8, 1)).toBe('medium')
    expect(tipped('medium', 0.8, 2)).toBe('high')
    expect(tipped('medium', 0.6, -1)).toBe('low')
    expect(tipped('low', 0.3, -2)).toBe('low')
    expect(tipped('medium', undefined, 2)).toBe('medium')
    expect(bounded('low', 'medium', 'max')).toBe('medium')
    expect(bounded('max', 'low', 'high')).toBe('high')
    expect(withTypesafeKey('A=1\nTYPESAFE_API_KEY=old\n', 'new')).toBe('A=1\nTYPESAFE_API_KEY=new\n')
    expect(withTypesafeKey('A=1', 'new')).toBe('A=1\nTYPESAFE_API_KEY=new\n')
    expect(parseVerdict('{"haiku":"high","sonnet":"high","opus":"high","sure":0.7,"why":"x"}')?.efforts.opus?.sure).toBe(0.7)
  })

  test('Open settings opens the panel; the slider, range and key are saved from it', { options: { decisionModels: 'typesafe/jev-latest' } } as never, async ($, on) => {
    engine(on, { USERPROFILE: '/Users/x' })
    const mocked = mock.clock(on)
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    const files: Record<string, string> = { '/Users/x/.config/jev/.env': 'OTHER=1\n' }
    const at = (path: string) => path.split('\\').join('/')
    on('fs.read', (_$, e) => ({ value: files[at(e.path)] ?? '' }) as never)
    on('fs.write', (_$, e) => {
      files[at(e.path)] = e.text
      return { value: undefined } as never
    })
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'effortless', args: 'down' } as never)
    const down = await $.ui.mount(DESK_BAND)
    await down.press({ key: 'down-settings' })
    await down.unmount()
    const panel = await $.ui.mount(DESK_BAND)
    expect(await drawn(panel)).toContain('"key":"settings-title"')
    // The panel opens on the four cards; each opens its own controls, Back returns.
    expect(await panel.find({ key: 'settings-card-effort' })).toBeDefined()
    expect(await panel.find({ key: 'bias3' })).toBeUndefined()
    await panel.press({ key: 'settings-card-effort' })
    await panel.press({ key: 'bias3' })
    await panel.select({ key: 'settings-floor', value: 'medium' })
    // Helpers: the Auto switch again, off by default.
    expect(await drawn(panel)).toContain('Helpers off')
    await panel.press({ key: 'settings-helpers-switch' })
    expect(await drawn(panel)).toContain('Helpers on')
    await panel.press({ key: 'settings-back' })
    await panel.press({ key: 'settings-card-judge' })
    await panel.input({ key: 'settings-key', text: ' tk-new ' })
    await panel.press({ key: 'settings-back' })
    await panel.press({ key: 'settings-card-handoff' })
    await panel.select({ key: 'settings-skill', value: 'session-handoff' })
    // Which model writes a compaction sits with the handoff settings.
    expect(await panel.find({ key: 'settings-compact-with' })).toBeDefined()
    expect(await panel.find({ key: 'show-box-swamp' })).toBeDefined()
    expect(await panel.find({ key: 'show-box-cold' })).toBeDefined()
    await panel.press({ key: 'settings-back' })
    // The cards say what is set, unsaved changes included.
    expect(await drawn(panel)).toContain('Smarter · medium to max · helpers')
    expect(await drawn(panel)).toContain('/session-handoff · compact alert at')
    await panel.press({ key: 'settings-card-show' })
    await panel.press({ key: 'show-box-timer' })
    await panel.press({ key: 'show-box-reason' })
    // The judge line starts off, so its box switches it on; the cache timer goes off. No alert.
    // The alerts are in the Handoff card, beside when the context alert shows.
    expect(await panel.find({ key: 'show-box-swamp' })).toBeUndefined()
    expect(set).toEqual([])
    await panel.press({ key: 'settings-save' })
    expect(set).toContainEqual({ key: 'effortless.hide', value: 'timer' })
    expect(set).toContainEqual({ key: 'effortless.handoffSkill', value: 'session-handoff' })
    expect(set).toContainEqual({ key: 'effortless.effortBias', value: '1' })
    expect(set).toContainEqual({ key: 'effortless.effortFloor', value: 'medium' })
    expect(set).toContainEqual({ key: 'effortless.helpers', value: 'on' })
    expect(said.join(' | ')).toContain('key saved')
    expect(files['/Users/x/.config/jev/.env']).toBe('OTHER=1\nTYPESAFE_API_KEY=tk-new\n')
    await panel.unmount()
    // A plain card says it was saved, then goes.
    const saved = await $.ui.mount(DESK_BAND)
    expect(await drawn(saved)).toContain('Settings saved')
    await saved.unmount()
    await mocked.advance(3000)
    await drawsNothing($, DESK_BAND)
  })
})

describe('switching parts off', () => {
  test('readConfig keeps only parts that can be switched off; the judge-down alert is not among them', () => {
    expect(readConfig({ hide: 'swamp, handoff,bogus,down' }).hide).toEqual(['swamp', 'handoff'])
  })

  test('a hidden handoff button is not in the footer; a switched-off context alert does not show', { options: { hide: 'handoff,swamp' } } as never, async ($, on) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 600_000, window: 1_000_000, percent: 60 } } }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await mocked.advance(16_000)
    // Nothing above the prompt: the swamp band was the only thing to draw.
    await drawsNothing($, DESK_BAND)
    const footer = await $.ui.mount(FOOTER)
    expect(await footer.find({ key: 'handoff' })).toBeUndefined()
    await footer.unmount()
  })
})

describe('the command file', () => {
  test('/effortless:effortless, as the app may name the command file, is answered by the mod', async ($, on) => {
    engine(on)
    mock.clock(on)
    const answer = await $.command.run({ command: 'effortless:effortless', args: 'settings' } as never)
    expect(String((answer as { text?: string }).text)).toContain('settings are open')
  })
})


// The task step list the agent panel follows: its rules.
describe('task step rules', () => {
  const todos = (statuses: ('pending' | 'in_progress' | 'completed')[]) =>
    statuses.map((status, i) => ({ content: `Step ${i + 1}`, activeForm: `Doing step ${i + 1}`, status }))
  test('the steps: share', () => {
    const steps = stepsFromTodos(todos(['completed', 'in_progress', 'pending', 'pending']))
    expect(progressShare(steps)).toBe(1.5 / 4)
    expect(progressShare([])).toBe(0)
  })

  test('tasks are added, updated and deleted by id', () => {
    let steps = withTaskCreated([], '1', { subject: 'Read', activeForm: 'Reading' })
    steps = withTaskCreated(steps, '2', { subject: 'Write' })
    steps = withTaskUpdated(steps, { taskId: '1', status: 'in_progress' })
    expect(steps.map(s => [s.id, s.status, s.doing])).toEqual([['1', 'in_progress', 'Reading'], ['2', 'pending', 'Write']])
    expect(withTaskUpdated(steps, { taskId: '2', status: 'deleted' }).map(s => s.id)).toEqual(['1'])
  })

})

describe('terminal art', () => {
  test('a frame is 16 by 2 cells of ▀, faded in from the left', () => {
    // 32 cells of three 4-byte words: 384 bytes, 512 base64 characters.
    expect(artFrame('swamp', 0)).toHaveLength(512)
    for (const kind of ['cold', 'swamp', 'hot', 'down', 'brand', 'calm', 'compacting', 'done'] as const) {
      expect(artPixel(kind, 3, 0, 1)).toBe(artPixel(kind, 9, 0, 1))
    }
  })

  test('moving kinds change over time; still ones do not', () => {
    const frames = (kind: Parameters<typeof artFrame>[0]) => new Set(Array.from({ length: 30 }, (_, t) => artFrame(kind, t))).size
    for (const kind of MOVING) expect(frames(kind)).toBeGreaterThan(1)
    expect(frames('brand')).toBe(1)
    expect(frames('calm')).toBe(1)
    expect(frames('done')).toBe(1)
  })
})

describe('terminal bands', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
  }
  const at = (columns: number) =>
    ({ plugin: 'effortless', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: columns, maxRows: 14 } }) as never

  for (const kind of ['swamp', 'cold', 'hot', 'down'] as const) {
    test(`${kind}: art on the right when wide, none at 80 columns; the effort row stays under it`, async ($, on) => {
      engine(on)
      mock.clock(on)
      await start($, on)
      const guide = await $.ui.mount(at(120))
      await guide.press({ key: 'setup-close' })
      await guide.unmount()
      await $.command.run({ command: 'effortless', args: kind } as never)
      const wide = await $.ui.mount(at(120))
      const text = await drawn(wide)
      expect(text).toContain('"type":"Raster"')
      expect(text).toContain('"children":["Effort"]')
      await wide.unmount()
      const narrow = await $.ui.mount(at(80))
      const small = await drawn(narrow)
      expect(small).not.toContain('"type":"Raster"')
      expect(small).toContain('"children":["Effort"]')
      await narrow.unmount()
    })
  }

  test('Settings in a narrow terminal: cards keep their text, the header wraps, the bug link copies', async ($, on) => {
    engine(on)
    mock.clock(on)
    const copied: string[] = []
    on('ui.copy', (_$, e) => {
      copied.push(e.text)
      return { value: { isCopied: true } } as never
    })
    await start($, on)
    const guide = await $.ui.mount(at(36))
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'effortless', args: 'settings' } as never)
    const panel = await $.ui.mount(at(36))
    const text = await drawn(panel)
    // No blank buttons laid over the cards: a terminal paints their spaces over the title and summary.
    expect(text).not.toContain(' '.repeat(800))
    expect(text).toContain('Effort ›')
    // Title and buttons are in the flow, so a narrow window wraps them instead of drawing one over the other.
    expect(text).not.toMatch(/"key":"settings-(title|actions)"[^}]*"position":"absolute"/)
    expect(text).not.toContain('"href"')
    await panel.press({ key: 'settings-bug' })
    expect(copied[0]).toContain('github.com/capyBearista/effortless/issues/new')
    await panel.press({ key: 'settings-card-effort' })
    expect(await drawn(panel)).toContain('Helpers')
    expect(await drawn(panel)).not.toContain(' '.repeat(40))
    // Short choices are buttons, not a dropdown that opens inside the row: one press picks.
    await panel.press({ key: 'settings-back' })
    await panel.press({ key: 'settings-card-show' })
    expect(await panel.find({ key: 'settings-theme' })).toBeDefined()
    await panel.press({ key: 'settings-theme-rose' })
    expect(await drawn(panel)).toContain('unsaved changes')
    expect(JSON.stringify(await panel.find({ key: 'settings-theme-rose' }))).toContain('"variant":"secondary"')
    await panel.unmount()
  })
})

describe('dashboard', () => {
  const DASH = { options: { layout: 'default' } } as never
  const start = async ($: Engine, on: On, surface: 'desktop' | 'terminal' = 'desktop') => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface, isInteractive: true } as never)
  }
  const closeSetup = async ($: Engine, band: unknown) => {
    const guide = await $.ui.mount(band as never)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
  }

  test('light appearance: surfaces come out pale, text reads on them, alpha and hue are kept', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1, 7), 16)
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
      return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
    }
    const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    // Edges stay a visible step darker than the panels they frame.
    for (const edge of ['#2a2a2f', '#4a3f80']) expect(lum(lightHex(edge, 'surface'))).toBeGreaterThan(0.45)
    for (const dark of ['#141416', '#15121f', '#0e1820', '#111710', '#1a110c', '#0f1c15']) {
      const pale = lightHex(dark, 'surface')
      expect(lum(pale)).toBeGreaterThan(0.6)
    }
    const surfaces = ['#141416', '#15121f', '#0e1820', '#111710', '#1a110c', '#0f1c15', '#12141b'].map(h => lightHex(h, 'surface'))
    for (const text of ['#d4d4d8', '#8b8b93', '#a79cf7', '#7c6cf0', '#7cc4ff', '#a7c98f', '#f08a3c', '#7fe0a4', '#ffffff', '#6b6b73', '#e0a33a', '#e5534b'])
      for (const bg of surfaces) expect(contrast(lightHex(text, 'text'), bg)).toBeGreaterThanOrEqual(4.5)
    // Main text stays darker than dim text, and a colour stays its hue.
    expect(lum(lightHex('#d4d4d8', 'text'))).toBeLessThan(lum(lightHex('#8b8b93', 'text')))
    expect(lightHex('#7fe0a4', 'text')).toMatch(/^#[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}$/)
    const green = parseInt(lightHex('#7fe0a4', 'text').slice(3, 5), 16)
    const red = parseInt(lightHex('#7fe0a4', 'text').slice(1, 3), 16)
    expect(green).toBeGreaterThan(red)
    expect(lightHex('#14141680', 'surface').endsWith('80')).toBe(true)
  })

  test('light appearance: Box, Text and Button props are turned, hover too; dark leaves the apps own parts alone', () => {
    const Box = (p: Record<string, unknown>) => p
    const Text = (p: Record<string, unknown>) => p
    const Button = (p: Record<string, unknown>) => p
    const els = { Box, Text, Button, Svg: (p: Record<string, unknown>) => p }
    expect(themedEls(els).Box).toBe(Box)
    try {
      setLight(true)
      const lit = themedEls(els) as typeof els
      expect(lit.Box).not.toBe(Box)
      const box = lit.Box({ backgroundColor: '#141416', borderColor: '#2a2a2f', hover: { backgroundColor: '#1c1c20' }, flexDirection: 'row' })
      expect(box.backgroundColor).toBe(lightHex('#141416', 'surface'))
      expect(box.borderColor).toBe(lightHex('#2a2a2f', 'surface'))
      expect((box.hover as { backgroundColor: string }).backgroundColor).toBe(lightHex('#1c1c20', 'surface'))
      expect(box.flexDirection).toBe('row')
      expect(lit.Text({ color: '#d4d4d8', bold: true }).color).toBe(lightHex('#d4d4d8', 'text'))
      expect(lit.Text({ color: 'red' }).color).toBe('red')
      expect(lit.Button({ hover: { backgroundColor: '#00000000' } }).hover).toEqual({ backgroundColor: lightHex('#00000000', 'surface') })
      expect(lightProps({ color: '#fff' }).color).toBe('#fff')
    } finally {
      setLight(false)
    }
    expect(isLight()).toBe(false)
  })

  test('light appearance: drawn art turns pale, with the sparkles still petals in rose', () => {
    const art = '<svg><style>.sp{fill:#fff}</style><rect fill="#15121f" width="9" height="9"/><rect fill="#7c6cf0" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
    try {
      setLight(true)
      const violet = tint(art)
      expect(violet).not.toContain('#15121f')
      expect(violet).toContain(lightHex('#15121f'))
      expect(violet).toContain('class="sp"')
      setTheme('rose')
      const rose = tint(art)
      expect(rose).toContain('class="pt"')
      expect(rose).not.toContain('#ffb3cf')
    } finally {
      setTheme('violet')
      setLight(false)
    }
  })

  test('light appearance, set in the settings: the band is drawn pale', { options: { layout: 'default', appearance: 'light' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    const band = await $.ui.mount(DESK_BAND)
    const text = await drawn(band)
    expect(text).toContain(lightHex('#141416', 'surface'))
    expect(text).not.toContain('"backgroundColor":"#141416"')
    await band.unmount()
  })

  test("auto appearance on the desktop follows the app, not Claude Code's theme row: theme keys and the app's surface either way", { options: { layout: 'default' } } as never, async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    let claudeTheme = 'light'
    on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: claudeTheme, provider: { kind: 'engine' }, isLocked: false }] }) as never)
    await start($, on)
    await closeSetup($, DESK_BAND)
    for (const row of ['light', 'dark']) {
      claudeTheme = row
      await mocked.advance(5000)
      let band = await $.ui.mount(DESK_BAND)
      await band.unmount()
      await mocked.advance(100)
      band = await $.ui.mount(DESK_BAND)
      const tree = await drawn(band)
      expect(tree).toContain('"backgroundColor":"inverseText"')
      expect(tree).not.toContain('"backgroundColor":"#141416"')
      expect(tree).not.toContain(`"backgroundColor":"${lightHex('#141416', 'surface')}"`)
      // The drawings carry their light form for the app to pick.
      expect(tree).toContain('prefers-color-scheme: light')
      await band.unmount()
    }
  })

  test('Dark set on the desktop: the dark palette, with the app\'s controls on the app\'s own surface', { options: { layout: 'default', appearance: 'dark' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    const band = await $.ui.mount(DESK_BAND)
    const tree = await drawn(band)
    expect(tree).toContain('"backgroundColor":"#141416"')
    expect(tree).not.toContain('prefers-color-scheme: light')
    await band.unmount()
  })

  test('a new chat: Low picked by hand in another chat does not beat the effort the app is on when the first prompt goes', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    on('prompt.fill', () => ({ isFilled: true }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    // The other chat: Low picked by hand in effortless, so Auto went off and the pick is kept for the next chat.
    const rows = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND } as never)
    await rows.press({ key: 'e-low' })
    await rows.unmount()
    // A new chat starts from that; the person sets the app to Extra before the first prompt goes.
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.prompt.submit({ text: 'plan the architecture of the trainer', wait: false, origin: { kind: 'composer' } })
    await step($, 'xhigh')
    expect(sent.at(-1)!.effort).toBe('xhigh')
  })

  test('picking an effort in the app turns Auto off and says so', async ($, on) => {
    engine(on)
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    const sent = recordSteps(on)
    await step($, 'high')
    await step($, 'low')
    expect(sent.at(-1)!.effort).toBe('low')
    expect(said.join(' ')).toContain('Auto is off. You picked Low')
    expect(String((await $.command.run({ command: 'effortless', args: 'auto' })).text)).toContain('Auto on')
  })

  test('/effortless debug says what the app asked for and what was sent', async ($, on) => {
    engine(on)
    const sent = recordSteps(on)
    const debug = async () => String((await $.command.run({ command: 'effortless', args: 'debug' })).text)
    expect(await debug()).toContain('last request: none yet')
    await $.command.run({ command: 'effortless', args: 'auto' })
    await step($, 'xhigh')
    expect(sent.at(-1)!.effort).toBe('xhigh')
    expect(await debug()).toContain('last request: app asked claude-opus-5-5 at xhigh, sent claude-opus-5-5 at xhigh (unchanged)')
    // The model that ran is also on a line of its own.
    expect((await debug()).split(String.fromCharCode(10)).at(-1)).toBe('model used: claude-opus-5-5 at xhigh')
  })

  test("its lines: the effort, cache and context; the judge's reason and the last reply", () => {
    const base = { auto: true, paused: false, judging: false, effort: 'medium' as const, cacheNow: 42, contextPercent: 18, reason: 'Decision model: a small fix', last: null }
    expect(dashboardLines(base).head).toBe(`✦ Medium · cache ${cacheLabel(42)} · 18% context`)
    expect(dashboardLines(base).detail).toBe('Decision model: a small fix')
    expect(dashboardLines({ ...base, last: { cost: 42_000, ms: 38_200 } }).detail).toBe('Decision model: a small fix · last reply ≈42.0k tokens · 38s')
    expect(dashboardLines({ ...base, auto: false }).head).toBe(`✦ Off · cache ${cacheLabel(42)} · 18% context`)
    expect(dashboardLines({ ...base, cacheNow: null, contextPercent: null }).head).toBe('✦ Medium')
    expect(weighted({ input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 1000, cache_creation_input_tokens: 4 })).toBe(10 + 10 + 100 + 5)
  })

  test('the word says manual for a level picked by hand and kept for a kept one; Auto off says Off unless a level was picked', () => {
    const base = { auto: true, paused: false, judging: false, effort: 'medium' as const, cacheNow: null, contextPercent: null, reason: '', last: null }
    expect(dashboardLines({ ...base, manual: true }).what).toBe('Medium · manual')
    expect(dashboardLines({ ...base, manual: true, auto: false }).what).toBe('Medium · manual')
    expect(dashboardLines({ ...base, kept: true }).what).toBe('Medium · kept')
    expect(dashboardLines({ ...base, auto: false }).what).toBe('Off')
    expect(dashboardLines({ ...base, auto: false, kept: true }).what).toBe('Off')
    expect(dashboardLines({ ...base, judging: true, manual: true }).what).toBe('Deciding…')
  })

  test('the effort word and the figures after it are drawn apart, so the figures can be cut and the word stays whole', () => {
    const base = { auto: true, paused: false, judging: false, effort: 'low' as const, cacheNow: 42, contextPercent: null, reason: '', last: null }
    expect(dashboardLines(base).what).toBe('Low')
    expect(dashboardLines(base).rest).toBe(` · cache ${cacheLabel(42)}`)
    expect(dashboardLines({ ...base, cacheNow: null }).rest).toBe('')
  })

  test('a new effort glows violet, then turns the band white in one redraw', () => {
    expect(flashColor(0)).toBe('#9b7bff')
    expect(flashColor(999)).toBe('#9b7bff')
    expect(new Set([1000, 1160, 1320, 1480, 1640].map(flashColor)).size).toBe(5)
    expect(flashColor(1400)).not.toBe('#9b7bff')
    expect(flashColor(1400)).not.toBe('#d4d4d8')
    expect(flashColor(null)).toBe('#d4d4d8')
    expect(flashColor(1800)).toBe('#d4d4d8')
  })

  test('desktop: a level button sets that level by hand: the app runs /effort, Auto goes off, and the next request keeps the pick', DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    const ran = recordCommands(on)
    const sent = recordSteps(on)
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    await start($, on)
    await closeSetup($, DESK_BAND)
    const band = await $.ui.mount(DESK_BAND)

    await band.press({ key: 'dash-e-xhigh' })
    expect(await drawn(band)).toContain('"children":["XHigh · manual"]')
    expect(await drawn(band)).toContain('"alt":"Auto off"')
    expect(ran).toEqual(['/effort xhigh'])

    // The app now runs at XHigh: that is the pick, not a change of the person's to be read back (no toast, no reset).
    await step($, 'xhigh')
    expect(sent[0].effort).toBe('xhigh')
    expect(said.join(' ')).not.toContain('Auto is off')
    expect(await drawn(band)).toContain('"children":["XHigh · manual"]')
    await band.unmount()
  })

  test('desktop: where the app refuses the run, /effort goes into the prompt box for the person to send', DASH, async ($, on) => {
    // No host answers the /effort run, so the app refuses it and the command goes to the prompt box instead.
    engine(on)
    mock.clock(on)
    const filled: string[] = []
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    on('prompt.fill', (_$, e) => {
      filled.push(e.text)
      return { isFilled: true } as never
    })
    await start($, on)
    await closeSetup($, DESK_BAND)
    const band = await $.ui.mount(DESK_BAND)

    await band.press({ key: 'dash-e-high' })
    expect(filled).toEqual(['/effort high'])
    expect(await drawn(band)).toContain('"children":["High · manual"]')
    await band.unmount()
  })

  test('desktop: a level picked by hand says manual in the word, and does not light up', DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
    on('prompt.fill', () => ({ isFilled: true }) as never)
    await start($, on)
    await closeSetup($, DESK_BAND)
    const first = await $.ui.mount(DESK_BAND)
    await first.unmount()
    // Picking an effort by hand turns Auto off and runs the app's /effort: the person's own switch, not a verdict, so the
    // word changes without the flash.
    const rows = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await rows.press({ key: 'e-low' })
    await rows.unmount()
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('"color":"text","bold":true,"weight":"semibold"},"children":["Low · manual"]')
    await band.unmount()
  })

  test("desktop: the band above the prompt at rest, with Auto, Handoff and settings; the footer is the app's own", DASH, async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 180_000, window: 1_000_000, percent: 18 } } }) as never)
    await start($, on)
    await closeSetup($, DESK_BAND)
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    // The context as a ring and a figure, as the swamp band shows it.
    expect(await band.find({ key: 'dash-ring' })).toBeDefined()
    expect(await drawn(band)).toContain('"children":["18%"]')
    expect(await band.find({ key: 'dash-auto' })).toBeDefined()
    expect(await band.find({ key: 'dash-settings' })).toBeDefined()
    // A drawn icon on desktop, not the word.
    expect(await band.find({ key: 'dash-settings-icon' })).toBeDefined()
    expect(await drawn(band)).not.toContain('"label":"Settings"')
    // The mark stands in for the ✦ on desktop.
    expect(await band.find({ key: 'dash-mark' })).toBeDefined()
    await band.press({ key: 'dash-auto' })
    expect(await drawn(band)).toContain('Auto off')
    // One button: Compact on a fresh chat. It opens the compact card, which can switch to Handoff.
    await band.press({ key: 'dash-handoff' })
    expect(await drawn(band)).toContain('compact-bar')
    await band.press({ key: 'compact-to-handoff' })
    expect(await drawn(band)).toContain('⇥ Handoff')
    await band.unmount()
    await drawsNothing($, FOOTER)
  })

  test('Handoff button set to always: Handoff from the start, calm, no glow, with Compact beside it', { options: { layout: 'default', handoffButton: 'always' } } as never, async ($, on) => {
    engine(on)
    recordSteps(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 100_000, window: 1_000_000, percent: 10 } } }) as never)
    await start($, on)
    await closeSetup($, DESK_BAND)
    await mocked.advance(16_000)
    const band = await $.ui.mount(DESK_BAND)
    expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
    expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
    expect(await band.find({ key: 'dash-handoff-h' })).toBeUndefined()
    const text = await drawn(band)
    expect(text).toContain('Handoff')
    // Compact stays beside it as quiet text, so both are a press away.
    expect(await band.find({ key: 'dash-compact' })).toBeDefined()
    await band.unmount()
  })

  test('readConfig keeps handoffButton to advised or always', () => {
    expect(readConfig({}).handoffButton).toBe('advised')
    expect(readConfig({ handoffButton: 'always' }).handoffButton).toBe('always')
    expect(readConfig({ handoffButton: 'sometimes' }).handoffButton).toBe('advised')
  })

  test('one button: Compact until the Haiku check says a handoff would suit; then Handoff, lit, with the reason', DASH, async ($, on) => {
    engine(on)
    recordSteps(on)
    const mocked = mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 400_000, window: 1_000_000, percent: 40 } } }) as never)
    let handoff: string | null = null
    const systems: string[] = []
    on('model.complete', (_$, e) => {
      systems.push(String((e as { system?: string }).system ?? '').slice(0, 30))
      const text = String((e as { system?: string }).system ?? '').includes('decide whether the person should hand off')
        ? JSON.stringify({ handoff })
        : '{"haiku":"high","sonnet":"high","opus":"high","why":"big refactor"}'
      return { value: { isAnswered: true as const, text, usage: USAGE } }
    })
    await start($, on)
    await closeSetup($, DESK_BAND)
    await mocked.advance(16_000)
    // A fairly full chat, no advice: no glow, no H key, one button, and it says Compact.
    let band = await $.ui.mount(DESK_BAND)
    expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
    expect(await band.find({ key: 'dash-compact' })).toBeUndefined()
    expect(await band.find({ key: 'dash-handoff-h' })).toBeUndefined()
    expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
    expect(await drawn(band)).toContain('Compact')
    await band.unmount()
    // The check runs every second message from 30%. Haiku says a handoff would suit.
    handoff = 'Task done, new topic'
    await $.prompt.submit({ text: 'completely different: help me plan a trip to Lisbon', wait: false, origin: { kind: 'composer' } })
    await step($)
    await $.prompt.submit({ text: 'and which neighbourhood should I stay in for the first night', wait: false, origin: { kind: 'composer' } })
    await step($)
    band = await $.ui.mount(DESK_BAND)
    expect((await band.find({ key: 'dash-handoff-h' }))?.props).toMatchObject({ hotkey: 'h' })
    expect(await band.find({ key: 'dash-glow' })).toBeDefined()
    expect(await drawn(band)).toContain('Handoff would suit: Task done, new topic')
    await band.unmount()
    // A later check that says no clears it again.
    handoff = null
    await $.prompt.submit({ text: 'now make the Lisbon plan a three day one with a budget', wait: false, origin: { kind: 'composer' } })
    await step($)
    await $.prompt.submit({ text: 'add the cost of the tram tickets to the budget as well', wait: false, origin: { kind: 'composer' } })
    await step($)
    band = await $.ui.mount(DESK_BAND)
    expect(await band.find({ key: 'dash-glow' })).toBeUndefined()
    expect(await drawn(band)).not.toContain('Handoff would suit')
    await band.unmount()
  })

  test('the handoff check reads the purpose, the trail, the last reply, the fill and the cache; an unclear answer is no', () => {
    const messages = [
      { role: 'user', text: 'build the settings page' },
      { role: 'assistant', text: 'done, anything else?' },
      { role: 'user', text: 'also fix the footer' },
      { role: 'assistant', text: 'footer fixed' },
    ]
    const text = handoffEvidence(messages, 'plan a trip to Lisbon', 42, true)
    expect(text).toContain('build the settings page')
    expect(text).toContain('footer fixed')
    expect(text).toContain('plan a trip to Lisbon')
    expect(text).toContain('42%')
    expect(text).toContain('cache is cold')
    expect(parseHandoffAnswer('{"handoff":"Task done"}')).toBe('Task done')
    expect(parseHandoffAnswer('{"handoff":null}')).toBeNull()
    expect(parseHandoffAnswer('{"handoff":"  "}')).toBeNull()
    expect(parseHandoffAnswer('maybe')).toBeNull()
  })

  test('the Handoff glow steps up every 10% from 30%', () => {
    expect([0, 29, 30, 39, 40, 55, 69, 70, 95].map(handoffGlowStep)).toEqual([0, 0, 1, 1, 2, 3, 4, 5, 5])
  })

  test("an alert takes the dashboard's place, and the dashboard comes back after it", DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    await $.command.run({ command: 'effortless', args: 'hot' } as never)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Running hot')
    expect(await band.find({ key: 'dash-auto' })).toBeUndefined()
    await band.press({ key: 'hot-close' })
    expect(await band.find({ key: 'dash-auto' })).toBeDefined()
    await band.unmount()
  })

  test('terminal: the same band with the effort row under it', DASH, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on, 'terminal')
    const at = { plugin: 'effortless', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 120, maxRows: 14 } } as never
    await closeSetup($, at)
    const band = await $.ui.mount(at)
    const text = await drawn(band)
    // Auto is switched in the bar, not twice: the effort row under it drops its own.
    const before = (await band.find({ key: 'dash-auto' }))?.text
    expect(before).toContain('Auto')
    expect(await band.find({ key: 'auto' })).toBeUndefined()
    await band.press({ key: 'dash-auto' })
    expect((await band.find({ key: 'dash-auto' }))?.text).not.toBe(before)
    expect(await band.find({ key: 'dash-handoff' })).toBeDefined()
    expect(text).toContain('"children":["Effort"]')
    // No still sparkles at rest: 16 by 4 pixels of them read as noise in a terminal.
    expect(text).not.toContain('"type":"Raster"')
    await band.unmount()
  })

  test("the minimal look draws no band and keeps the footer's buttons", { options: { layout: 'minimal' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($, DESK_BAND)
    await drawsNothing($, DESK_BAND)
    const footer = await $.ui.mount(FOOTER)
    expect(await footer.find({ key: 'auto' })).toBeDefined()
    await footer.unmount()
  })
})

describe('a chat opened again', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('classic.SessionStart', () => ({}) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  const closeSetup = async ($: Engine) => {
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
  }

  test('two hours after its last response: the cache shows cold at once', async ($, on) => {
    engine(on)
    on('session.usage', () => ({ value: { context: { tokens: 500_000, window: 1_000_000, percent: 50 } } }) as never)
    mock.clock(on)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7200, prompt_cache_likely_expired: true } as never)
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('Chat went cold')
    await band.unmount()
  })

  test('a small chat that went cold shows no band: rereading it costs too little', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('session.usage', () => ({ value: { context: { tokens: 30_000, window: 1_000_000, percent: 3 } } }) as never)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7200, prompt_cache_likely_expired: true } as never)
    await drawsNothing($, DESK_BAND)
  })

  test('ten minutes after: the countdown goes on from where it was, no cold band', async ($, on) => {
    engine(on)
    mock.clock(on)
    await start($, on)
    await closeSetup($)
    await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 600, prompt_cache_likely_expired: false } as never)
    await drawsNothing($, DESK_BAND)
    const footer = await $.ui.mount(FOOTER)
    expect(await drawn(footer)).toMatch(/"(49|50)m"/)
    await footer.unmount()
  })
})

describe('handoff look', () => {
  test('no box at 0%, the grey box at 15%, white at 30% where the glow starts, a step each percent', () => {
    expect(handoffLook(0).opacity).toBe(0)
    expect(handoffLook(15)).toMatchObject({ opacity: 1, fill: '#2b2b2f' })
    expect(handoffLook(30)).toMatchObject({ fill: '#ececf0', label: '#141416' })
    expect(handoffLook(80)).toEqual(handoffLook(30))
    expect(new Set(Array.from({ length: 31 }, (_, p) => JSON.stringify(handoffLook(p)))).size).toBe(31)
  })
})

describe('a message typed while a turn runs', () => {
  /** The judge answers with whatever `says.effort` holds at the time. */
  function judgeSaysNow(on: On, says: { effort: string }) {
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true as const, text: `{"haiku":"${says.effort}","sonnet":"${says.effort}","opus":"${says.effort}","why":"x"}`, usage: USAGE } }
    })
    return asked
  }
  /** One request of turn `turnId` at request `index`. */
  async function stepOf($: Engine, turnId: string, index: number) {
    for await (const _ of $.turn.step({ turnId, index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
      // drain
    }
  }

  test('a lower verdict never lowers the running turn; it takes the next one', async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    const asked = judgeSaysNow(on, says)
    const sent = recordSteps(on)
    mock.clock(on)
    on('turn.complete', () => ({ text: '' }) as never)

    await $.prompt.submit({ text: 'refactor the whole auth module across the app', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    says.effort = 'low'
    await $.prompt.submit({ text: 'also rename the helper you made', wait: false, turnId: 't1', origin: { kind: 'composer' } } as never)
    await stepOf($, 't1', 1)
    await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'completed' } as never)
    await stepOf($, 't2', 0)

    expect(asked.length).toBe(2)
    // The judge is told the message came in while the task ran.
    expect(asked[1]).toContain('still working')
    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'low'])
  })

  test('a higher verdict raises the running turn at once', async ($, on) => {
    engine(on)
    const says = { effort: 'low' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fix the typo in the readme', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    says.effort = 'high'
    await $.prompt.submit({ text: 'actually go through every doc and fix them all', wait: false, turnId: 't1', origin: { kind: 'composer' } } as never)
    await stepOf($, 't1', 1)

    expect(sent.map(s => s.effort)).toEqual(['low', 'high'])
  })

  test('Auto switched off or on mid-turn leaves the running turn at its effort', async ($, on) => {
    engine(on)
    const says = { effort: 'high' }
    judgeSaysNow(on, says)
    const sent = recordSteps(on)
    const auto = () => $.command.run({ command: 'effortless', args: 'auto' })

    await $.prompt.submit({ text: 'refactor the whole auth module across the app', wait: false, origin: { kind: 'composer' } })
    await stepOf($, 't1', 0)
    expect(String((await auto()).text)).toContain('Auto off')
    await stepOf($, 't1', 1)
    expect(String((await auto()).text)).toContain('Auto on')
    await stepOf($, 't1', 2)

    expect(sent.map(s => s.effort)).toEqual(['high', 'high', 'high'])
  })
})

describe('compact, uninstall and the claude CLI', () => {
  const DESK = { options: { layout: 'default' } } as never
  /** A session with `installed` on disk; records what the mod runs. */
  function world(on: On, v: { installed: string }) {
    engine(on)
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('fs.read', (_$, e) => {
      if (String(e.path).replaceAll('\\', '/').endsWith('.claude-plugin/plugin.json')) return { value: JSON.stringify({ version: v.installed }) } as never
      return { value: '' } as never
    })
    const ran: string[] = []
    on('process.run', (_$, e) => {
      ran.push(e.argv.join(' '))
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    })
    const commands: string[] = []
    on('command.run', (_$, e) => {
      commands.push(`/${e.command}`)
      return { text: 'ok' }
    })
    return { ran, commands }
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 30))
  /** Through the setup guide a first session opens, which takes the band before any card. */
  async function pastSetup(ui: { find: (q: { key: string }) => Promise<unknown>; press: (q: { key: string }) => Promise<unknown> }) {
    for (let i = 0; i < 6 && (await ui.find({ key: 'setup-close' })); i++)
      await ui.press({ key: (await ui.find({ key: 'setup-haiku' })) ? 'setup-haiku' : 'setup-close' })
  }
  const start = ($: Engine) => $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)

  test('the one button says Compact, opens the compact step, and stays on a narrow bar', DESK, async ($, on) => {
    world(on, { installed: '1.0.1' })
    await start($)
    await settle()
    const wide = await $.ui.mount({ plugin: 'effortless', surface: 'desktop', ...BAND })
    await pastSetup(wide)
    expect(await wide.find({ key: 'dash-compact' })).toBeUndefined()
    expect(await wide.find({ key: 'dash-handoff' })).toBeDefined()
    await wide.press({ key: 'dash-handoff' })
    await settle()
    expect(await drawn(wide)).toContain('compact-bar')
    await wide.press({ key: 'compact-close' })
    await settle()
    await wide.unmount()
    const narrow = await $.ui.mount({ plugin: 'effortless', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND.props, bodyColumns: 60 } } as never)
    await pastSetup(narrow)
    expect(await narrow.find({ key: 'dash-handoff' })).toBeDefined()
    await narrow.unmount()
  })

  test('Uninstall in Customize asks for a second press, then uninstalls and reloads', DESK, async ($, on) => {
    const w = world(on, { installed: '1.0.1' })
    on('ui.toast', () => ({ value: undefined }) as never)
    await start($)
    await settle()
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'desktop', ...BAND })
    await pastSetup(ui)
    await ui.press({ key: 'dash-settings' })
    await ui.press({ key: 'settings-card-show' })
    expect(await drawn(ui)).toContain('Customize')
    w.ran.length = 0
    await ui.press({ key: 'settings-uninstall' })
    expect(w.ran).toEqual([])
    expect(await drawn(ui)).toContain('Press again to uninstall')
    await ui.press({ key: 'settings-uninstall' })
    await settle()
    expect(w.ran).toEqual(['claude plugin uninstall effortless@effortless'])
    expect(w.commands).toContain('/reload-plugins')
    await ui.unmount()
  })

  test('claude is looked for on PATH, then where the Windows and Mac installers put it', () => {
    expect(claudeCandidates('C:/Users/friend')).toEqual(['claude', 'C:/Users/friend/.local/bin/claude.exe'])
    expect(claudeCandidates('/Users/friend')).toEqual(['claude', '/Users/friend/.local/bin/claude'])
    expect(claudeCandidates(undefined)).toEqual(['claude'])
    expect(noClaudeHint("$.process.run(claude) failed to start: ENOENT: Command 'claude' not found or is in an unsafe location (current directory)", 'C:/Users/friend')).toContain('install.ps1')
    expect(noClaudeHint('spawn claude ENOENT', '/Users/friend')).toContain('install.sh')
    expect(noClaudeHint('network down', '/Users/friend')).toBeUndefined()
  })
})

describe('agent panel', () => {
  const PANE = {
    plugin: 'effortless',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'effortless-agents',
    props: { title: 'Agents', isFocused: false, bodyColumns: 46, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  } as never
  const start = async ($: Engine, on: On) => {
    engine(on)
    mock.clock(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('classic.SessionStart', () => ({}) as never)
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }

  test('the demo shows a card per agent still going and folds the finished ones into one', async ($, on) => {
    await start($, on)
    const reply = await $.command.run({ command: 'effortless', args: 'agents demo' })
    expect(String(reply.text)).toContain('agent panel')
    const pane = await $.ui.mount(PANE)
    const text = await drawn(pane)
    // A tree for tools/render-band (--tree), when asked for.
    if (text && (globalThis as { AGENT_TREE?: boolean }).AGENT_TREE) console.log(`AGENT_TREE ${text}`)
    for (const id of ['demo-1', 'demo-2', 'demo-3']) expect(await pane.find({ key: `agent-${id}` })).toBeDefined()
    expect(await pane.find({ key: 'agent-demo-4' })).toBeUndefined()
    expect(text).toContain('✓ 2 done')
    expect(text).toContain('1 waiting')
    expect(text).toContain('waiting on Bash npm test')
    // Pressing a card opens it: the pick and why show.
    await pane.press({ key: 'agent-demo-2-press' })
    expect(await drawn(pane)).toContain('a review before merge')
    await pane.unmount()
  })

  test('a spawned agent runs, waits on a long tool, and is done when its loop answers', async ($, on) => {
    on('agent.spawn', () => ({ agentId: 'a1', model: 'claude-haiku-5-5' }) as never)
    on('tool.call', () => ({ result: 'ok', isError: false }) as never)
    on('turn.complete', () => ({ text: '' }))
    await start($, on)
    await $.agent.spawn({ prompt: 'look around', description: 'find the hooks', subagentType: 'Explore' } as never)
    await $.command.run({ command: 'effortless', args: 'agents' })
    const pane = await $.ui.mount(PANE)
    expect(await drawn(pane)).toContain('1 working')
    expect(await drawn(pane)).toContain('find the hooks')
    await $.tool.call({ tool: 'Grep', pattern: 'agentId', agentId: 'a1' } as never)
    expect(await drawn(pane)).toContain('Grep agentId')
    await $.turn.complete({ turnId: 'x', agentId: 'a1', answer: 'found', durationMs: 1, isAborted: false, reason: 'answer' } as never)
    const text = await drawn(pane)
    expect(text).toContain('All done')
    expect(text).toContain('✓ 1 done')
    await pane.unmount()
  })

  test('with Helpers on, the judge picks a subagent\'s effort at its spawn and every request of it runs at that', { options: { helpers: 'on' } } as never, async ($, on) => {
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"quick search"}')
    on('agent.spawn', () => ({ agentId: 'h1', model: 'claude-opus-5-5' }) as never)
    on('turn.complete', () => ({ text: '' }))
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'list the files under hooks', description: 'find files', subagentType: 'Explore' } as never)
    expect(asked.some(p => p.includes('Explore subagent'))).toBe(true)
    for (const index of [0, 1]) {
      for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1, agentId: 'h1' } as never)) {
        // drain
      }
    }
    // Helpers start at medium: a low verdict comes up to it.
    expect(sent.map(s => s.effort)).toEqual(['medium', 'medium'])
    await $.command.run({ command: 'effortless', args: 'agents' })
    const pane = await $.ui.mount(PANE)
    await pane.press({ key: 'agent-h1-press' }).catch(() => undefined)
    expect(await drawn(pane)).toContain('Medium')
    expect(await drawn(pane)).toContain('helpers start at medium')
    await pane.unmount()
  })

  test('a subagent\'s first request before its spawn resolves still gets the picked effort', { options: { helpers: 'on' } } as never, async ($, on) => {
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"quick search"}')
    const sent = recordSteps(on)
    on('agent.list', () => ({ value: [{ id: 'h2', description: 'find files', type: 'Explore', status: 'running' }] }) as never)
    // The engine's own spawn: the subagent's first request goes out before the spawn answers with its id.
    let early: Promise<void> | null = null
    on('agent.spawn', async () => {
      early = (async () => {
        for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 1, agentId: 'h2' } as never)) {
          // drain
        }
      })()
      await early
      return { agentId: 'h2', model: 'claude-opus-5-5' } as never
    })
    await start($, on)
    await $.agent.spawn({ prompt: 'list the files under hooks', description: 'find files', subagentType: 'Explore' } as never)
    expect(sent.map(s => s.effort)).toEqual(['medium'])
  })

  test('with Helpers on, a subagent runs at the answer for its own model', { options: { helpers: 'on' } } as never, async ($, on) => {
    judgeSays(on, '{"haiku":"max","sonnet":"xhigh","opus":"high","why":"a big search"}')
    on('agent.spawn', () => ({ agentId: 'h5', model: 'claude-sonnet-5-5' }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'map every caller of judge()', description: 'map callers', subagentType: 'Explore' } as never)
    await stepOn($, 'claude-sonnet-5-5', 'high', 'h5')
    expect(sent.map(s => s.effort)).toEqual(['xhigh'])
  })

  test('with Helpers on, a decision model unsure for the subagent\'s model leaves it at the chat\'s effort, and Haiku is not asked', { options: { helpers: 'on', decisionModels: 'opencode/jev-1.13-free' } } as never, async ($, on) => {
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: decisionReply({ sonnet: 'xhigh', opus: 'xhigh' }, { sonnet: 0.3 }) } }))
    on('agent.spawn', () => ({ agentId: 'h6', model: 'claude-sonnet-5-5' }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'map every caller of judge()', description: 'map callers', subagentType: 'Explore' } as never)
    await stepOn($, 'claude-sonnet-5-5', 'high', 'h6')
    expect(asked.some(p => p.includes('subagent'))).toBe(false)
    expect(sent.map(s => s.effort)).toEqual(['high'])
  })

  test('with Helpers off, a subagent on another model than the chat\'s keeps the effort Claude Code gives it', async ($, on) => {
    engine(on)
    judgeSays(on, '{"haiku":"xhigh","sonnet":"xhigh","opus":"xhigh","why":"hard"}')
    on('agent.spawn', () => ({ agentId: 'h7', model: 'claude-sonnet-5-5' }) as never)
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'find why the relay drops messages', wait: false, origin: { kind: 'composer' } })
    await $.agent.spawn({ prompt: 'read relay/worker.js', description: 'read relay', subagentType: 'Explore' } as never)
    await stepOn($, 'claude-sonnet-5-5', 'medium', 'h7')
    expect(sent.map(s => s.effort)).toEqual(['medium'])
  })

  test('with Helpers on, a Haiku 5.5 subagent runs at the Haiku answer', { options: { helpers: 'on' } } as never, async ($, on) => {
    judgeSays(on, '{"haiku":"max","sonnet":"xhigh","opus":"high","why":"a big search"}')
    on('agent.spawn', () => ({ agentId: 'h8', model: 'claude-haiku-5-5' }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'map every caller of judge()', description: 'map callers', subagentType: 'Explore' } as never)
    await stepOn($, 'claude-haiku-5-5', 'medium', 'h8')
    expect(sent.map(s => s.effort)).toEqual(['max'])
  })

  test('with Helpers on, a decision model\'s helper pick says how sure it was', { options: { helpers: 'on', decisionModels: 'opencode/jev-1.13-free' } } as never, async ($, on) => {
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: decisionReply('high', 0.7) } }))
    on('agent.spawn', () => ({ agentId: 'h9', model: 'claude-opus-5-5' }) as never)
    on('turn.complete', () => ({ text: '' }))
    await start($, on)
    await $.agent.spawn({ prompt: 'map every caller of judge()', description: 'map callers', subagentType: 'Explore' } as never)
    await $.command.run({ command: 'effortless', args: 'agents' })
    const pane = await $.ui.mount(PANE)
    await pane.press({ key: 'agent-h9-press' }).catch(() => undefined)
    expect(await drawn(pane)).toContain('70% sure')
    await pane.unmount()
  })

  test("helperFloor: medium, the person's Min when higher, never above their Max", () => {
    expect(helperFloor('low', 'max')).toBe('medium')
    expect(helperFloor('high', 'max')).toBe('high')
    expect(helperFloor('low', 'low')).toBe('low')
  })

  test('with Helpers off, a subagent runs at the chat\'s effort and the judge is not asked', async ($, on) => {
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"quick search"}')
    on('agent.spawn', () => ({ agentId: 'h3', model: 'claude-opus-5-5' }) as never)
    const sent = recordSteps(on)
    await start($, on)
    await $.agent.spawn({ prompt: 'list the files', description: 'find files', subagentType: 'Explore' } as never)
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 1, agentId: 'h3' } as never)) {
      // drain
    }
    expect(asked.some(p => p.includes('subagent'))).toBe(false)
    expect(sent.map(s => s.effort)).toEqual(['high'])
  })

  test('with Helpers off, a subagent of a judged turn runs at the turn\'s effort, never below medium', async ($, on) => {
    engine(on)
    let verdict = '{"haiku":"xhigh","sonnet":"xhigh","opus":"xhigh","why":"hard"}'
    const asked: string[] = []
    on('model.complete', (_$, e) => {
      asked.push(e.prompt)
      return { value: { isAnswered: true as const, text: verdict, usage: USAGE } }
    })
    on('agent.spawn', () => ({ agentId: 'h4', model: 'claude-opus-5-5' }) as never)
    const sent = recordSteps(on)
    const sub = async () => {
      for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1, agentId: 'h4' } as never)) {
        // drain
      }
    }
    await $.prompt.submit({ text: 'find why the relay drops messages', wait: false, origin: { kind: 'composer' } })
    await $.agent.spawn({ prompt: 'read relay/worker.js', description: 'read relay', subagentType: 'Explore' } as never)
    await sub()
    verdict = '{"haiku":"low","sonnet":"low","opus":"low","why":"small"}'
    await $.prompt.submit({ text: 'list the files in hooks', wait: false, origin: { kind: 'composer' } })
    await sub()
    // No judge call for the subagent itself; it follows the turn, raised to medium at least.
    expect(asked.some(p => p.includes('subagent'))).toBe(false)
    expect(sent.map(s => s.effort)).toEqual(['xhigh', 'medium'])
  })

  test('the demo map shows the parts touched; a part opens to its files', async ($, on) => {
    await start($, on)
    await $.command.run({ command: 'effortless', args: 'agents demo' })
    const pane = await $.ui.mount(PANE)
    const text = await drawn(pane)
    expect(text).toContain('Map')
    expect(text).toContain('5 parts touched')
    expect(text).toContain('map of 5 parts of the code')
    // The main chat's own list is the total progress: 2 of 5 steps.
    expect(text).toContain('2 of 5 steps')
    expect(text).not.toContain('register.tsx')
    await pane.press({ key: 'mod-hooks-press' })
    const open = await drawn(pane)
    expect(open).toContain('register.tsx')
    expect(open).toContain('agents.tsx')
    await pane.unmount()
  })

  test("a file the main chat reads lands on the map under its folder", async ($, on) => {
    on('tool.call', () => ({ result: 'ok', isError: false }) as never)
    on('fs.read', () => ({ value: "import { a } from '../types'" }) as never)
    on('session.root', () => ({ value: '/proj' }) as never)
    await start($, on)
    await $.tool.call({ tool: 'Read', file_path: '/proj/hooks/x.ts' } as never)
    await $.command.run({ command: 'effortless', args: 'agents' })
    const pane = await $.ui.mount(PANE)
    const text = await drawn(pane)
    expect(text).toContain('1 part touched')
    expect(text).toContain('hooks')
    await pane.unmount()
  })

  test('imports, folders and links between parts', () => {
    expect(relPath('C:\\proj\\hooks\\a.ts', 'C:/proj')).toBe('hooks/a.ts')
    expect(relPath('/elsewhere/a.ts', '/proj')).toBeNull()
    expect(importsOf('hooks/a.tsx', "import x from './b'\nimport type { T } from '../types'")).toEqual(['hooks/b', 'types'])
    expect(importsOf('pkg/mod.py', 'from .util import x\nimport os')).toEqual(['pkg/util', 'os'])
    expect(moduleOf('tools/render-band/out/x.mjs')).toBe('tools/render-band')
    expect(moduleOf('README.md')).toBe('project')
    let files = withTouch([], 'hooks/a.ts', false, 'main', 1, ['types'])
    files = withTouch(files, 'types/index.d.ts', true, 'a1', 2, [])
    expect(moduleLinks(files)).toEqual(['hooks>types'])
    expect(files.find(f => f.path === 'types/index.d.ts')?.by).toEqual(['a1'])
  })
})

describe('theme', () => {
  test('readConfig reads orange and falls back to violet', () => {
    expect(readConfig({ theme: 'orange' }).theme).toBe('orange')
    expect(readConfig({ theme: ' orange ' }).theme).toBe('orange')
    expect(readConfig({ theme: 'pink' }).theme).toBe('violet')
    expect(readConfig({}).theme).toBe('violet')
  })

  test('orange turns the violets and leaves greys, greens, blues and yellows alone', () => {
    try {
      setTheme('orange')
      const hue = (hex: string) => {
        const n = parseInt(hex.slice(1), 16)
        const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
        const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return (h * 60 + 360) % 360
      }
      for (const violet of ['#a79cf7', '#b9a7ff', '#7c6cf0', '#4a3f80', '#15121f', '#9b7bff', '#e4dfff'])
        expect(Math.abs(hue(tintHex(violet)) - 15) < 4).toBe(true)
      for (const same of ['#ffffff', '#000000', '#141416', '#d4d4d8', '#8b8b93', '#2c2c31', '#7fe0a4', '#e0a33a', '#7cc4ff', '#e5534b', '#5d6a86'])
        expect(tintHex(same)).toBe(same)
      expect(tint('<stop stop-color="#a79cf7"/><path fill="#ffffff"/>')).toBe(`<stop stop-color="${tintHex('#a79cf7')}"/><path fill="#ffffff"/>`)
    } finally {
      setTheme('violet')
    }
  })

  test('rose turns the violets pink, leaves the signal colours alone, and draws the sparkles as falling petals', () => {
    expect(readConfig({ theme: 'rose' }).theme).toBe('rose')
    try {
      setTheme('rose')
      const hue = (hex: string) => {
        const n = parseInt(hex.slice(1), 16)
        const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
        const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return (h * 60 + 360) % 360
      }
      for (const violet of ['#a79cf7', '#b9a7ff', '#7c6cf0', '#4a3f80', '#9b7bff'])
        expect(Math.abs(hue(tintHex(violet)) - 340) < 4).toBe(true)
      for (const same of ['#ffffff', '#141416', '#7fe0a4', '#e0a33a', '#7cc4ff', '#e5534b'])
        expect(tintHex(same)).toBe(same)
      const art = '<svg><style>.sp{fill:#fff}</style><rect fill="#7c6cf0" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
      const petals = tint(art)
      expect(petals).toContain('class="pt"')
      expect(petals).toContain('<g transform="translate(168 0)">')
      expect(petals).toContain('@keyframes fall')
      expect(petals).not.toContain('class="sp"')
      // Art with no violet in it (the green Done card) keeps its sparkles.
      const green = '<svg><style>.sp{fill:#fff}</style><rect fill="#2fae62" width="9" height="9"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 Z"/></svg>'
      expect(tint(green)).toContain('class="sp"')
      expect(tint(green)).not.toContain('class="pt"')
      // Orange keeps the sparkles.
      setTheme('orange')
      expect(tint(art)).toContain('class="sp"')
    } finally {
      setTheme('violet')
    }
  })

  test('violet changes nothing and the Svg is left as it is', () => {
    setTheme('violet')
    const Svg = (p: Record<string, unknown>) => p
    expect(tint('#a79cf7')).toBe('#a79cf7')
    expect(themedSvg(Svg)).toBe(Svg)
    try {
      setTheme('orange')
      const wrapped = themedSvg(Svg) as typeof Svg
      expect(wrapped({ source: '<g fill="#a79cf7"/>' }).source).toBe(`<g fill="${tintHex('#a79cf7')}"/>`)
      expect(wrapped({ source: 42 }).source).toBe(42)
    } finally {
      setTheme('violet')
    }
  })
})

describe('decision models (fork)', () => {
  const CHAIN = 'opencode/jev-1.13-free, openrouter/typesafe/jev-1.13'
  /** Answers each decision-model request by its URL, and records what was sent. */
  function decisions(on: On, reply: (url: string) => { status: number; text: string }) {
    const calls: { url: string; auth?: string; headers: Record<string, string>; body: Record<string, any> }[] = []
    on('http.fetch', (_$, e) => {
      calls.push({
        url: e.url,
        auth: (e.init?.headers as Record<string, string> | undefined)?.authorization,
        headers: (e.init?.headers as Record<string, string> | undefined) ?? {},
        body: e.init?.body ? JSON.parse(String(e.init.body)) : {},
      })
      const r = reply(e.url)
      return { value: { status: r.status, ok: r.status < 300, headers: {}, text: r.text } }
    })
    return calls
  }
  function toasts(on: On) {
    const said: string[] = []
    on('ui.toast', (_$, e) => {
      said.push(String((e as { text?: string }).text ?? e))
      return { value: undefined } as never
    })
    return said
  }

  test('the setting reads as routes: Zen, OpenRouter and TypeSafe, in order, without junk or repeats', () => {
    expect(parseDecisionModels('opencode/jev-1.13-free,\n openrouter/inception/mercury-decide:free, typesafe/jev-latest')).toEqual([
      { id: 'opencode/jev-1.13-free', provider: 'zen', model: 'jev-1.13-free' },
      { id: 'openrouter/inception/mercury-decide:free', provider: 'openrouter', model: 'inception/mercury-decide:free' },
      { id: 'typesafe/jev-latest', provider: 'typesafe', model: 'jev-latest' },
    ])
    expect(parseDecisionModels('openrouter/jev, opencode/a/b, gpt-5, /x, opencode/jev-1.13-free, opencode/jev-1.13-free')).toEqual([
      { id: 'opencode/jev-1.13-free', provider: 'zen', model: 'jev-1.13-free' },
    ])
    expect(parseDecisionModels('typesafe-ai/jev-1.13.0')[0]).toMatchObject({ provider: 'typesafe', model: 'jev-1.13.0' })
    expect(parseDecisionModels('')).toEqual([])
    expect(parseDecisionModels(Array.from({ length: 12 }, (_, i) => `opencode/m${i}`).join(',')).length).toBe(MAX_ROUTES)
    expect(readConfig({ decisionModels: CHAIN }).decisionModels.map(r => r.provider)).toEqual(['zen', 'openrouter'])
  })

  test('judge timings are used as typed, with no hidden range; a bad one falls back to the default and is named', () => {
    expect(readConfig({ judgeTimeoutMs: '12000', judgeBudgetMs: '10000' })).toMatchObject({ judgeTimeoutMs: 12000, judgeBudgetMs: 10000 })
    expect(readConfig({ judgeTimeoutMs: '60000', judgeBudgetMs: '120000' })).toMatchObject({ judgeTimeoutMs: 60000, judgeBudgetMs: 120000 })
    expect(readConfig({ judgeTimeoutMs: '50' })).toMatchObject({ judgeTimeoutMs: 50 })
    expect(readConfig({})).toMatchObject({ judgeTimeoutMs: 4000, judgeBudgetMs: 8000 })
    expect(timingWarnings({})).toEqual([])
    expect(timingWarnings({ judgeTimeoutMs: '', judgeBudgetMs: ' ' })).toEqual([])
    expect(timingWarnings({ judgeTimeoutMs: '12000', judgeBudgetMs: '120000' })).toEqual([])
    for (const bad of ['0', '-5', 'abc', '1.5', '1e4', '99999999999999999999']) {
      expect(readConfig({ judgeTimeoutMs: bad, judgeBudgetMs: bad })).toMatchObject({ judgeTimeoutMs: 4000, judgeBudgetMs: 8000 })
      expect(timingWarnings({ judgeTimeoutMs: bad, judgeBudgetMs: bad })).toEqual([
        `judgeTimeoutMs "${bad}" is not a positive whole number of ms; using 4000`,
        `judgeBudgetMs "${bad}" is not a positive whole number of ms; using 8000`,
      ])
    }
  })

  test('a bad judge timing is named in a toast when the session starts', { options: { judgeBudgetMs: 'abc' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const said = toasts(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    expect(said).toContain('effortless: judgeBudgetMs "abc" is not a positive whole number of ms; using 8000')
  })

  test('a 12 s per-model timeout is waited out in full: past the old 9 s cap no judge is asked yet, after it Haiku judges', { options: { decisionModels: 'opencode/jev-1.13-free', judgeTimeoutMs: '12000', judgeBudgetMs: '20000' } } as never, async ($, on) => {
    engine(on)
    const mocked = mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    on('http.fetch', () => new Promise(() => undefined) as never)
    const sent = recordSteps(on)

    const submitted = $.prompt.submit({ text: 'designa om hela relayn', wait: false, origin: { kind: 'composer' } })
    await mocked.advance(9500)
    expect(asked.length).toBe(0)
    await mocked.advance(2600)
    await submitted
    await step($, 'high')

    expect(asked.length).toBe(1)
    expect(sent[0]?.effort).toBe('low')
  })

  test('the band says which decision model answered', { options: { decisionModels: 'openrouter/typesafe/jev-1.13', openrouterKey: 'or-k', hide: '', layout: 'default' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    toasts(on)
    decisions(on, () => ({ status: 200, text: decisionReply('max') }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.prompt.submit({ text: 'designa om hela relayn', wait: false, origin: { kind: 'composer' } })
    const band = await $.ui.mount(DESK_BAND)
    expect(await drawn(band)).toContain('jev-1.13: ')
    await band.unmount()
  })

  test('the reason line names a decision model by its short name', () => {
    const short = (id: string) => routeShortName(parseDecisionModels(id)[0])
    expect(short('openrouter/inception/mercury-decide:free')).toBe('mercury-decide')
    expect(short('openrouter/typesafe/jev-1.13')).toBe('jev-1.13')
    expect(short('opencode/jev-1.13-free')).toBe('jev-1.13-free')
    expect(short('typesafe/jev-latest')).toBe('jev-latest')
  })

  test('each hop gets its timeout cut to what is left of the budget, and none once it is spent', () => {
    expect(hopTimeout(0, 0, 4000, 8000)).toBe(4000)
    expect(hopTimeout(0, 6000, 4000, 8000)).toBe(2000)
    expect(hopTimeout(0, 7900, 4000, 8000)).toBeUndefined()
    expect(hopTimeout(0, 0, 12000, 10000)).toBe(10000)
    expect(hopTimeout(0, 0, 60000, 120000)).toBe(60000)
  })

  test('Zen first, with no key; when it fails OpenRouter answers with its key, and Haiku is not asked', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const said = toasts(on)
    const calls = decisions(on, url => (url.includes('opencode.ai') ? { status: 500, text: 'down' } : { status: 200, text: decisionReply('max') }))
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'designa om hela relayn', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.map(c => c.url)).toEqual(['https://opencode.ai/zen/v1/systemone', 'https://openrouter.ai/api/alpha/decisions'])
    expect(calls[0].auth).toBeUndefined()
    expect(calls[0].body.model).toBe('jev-1.13-free')
    expect(calls[1].auth).toBe('Bearer or-k')
    expect(calls[1].body.model).toBe('typesafe/jev-1.13')
    expect(calls[1].body.questions.effort_opus.type).toBe('choice')
    // Only OpenRouter is told which app is calling: it names the app in its logs.
    expect(calls[1].headers).toMatchObject({ 'HTTP-Referer': 'https://github.com/capyBearista/effortless', 'X-OpenRouter-Title': 'effortless', 'X-OpenRouter-App-Visibility': 'hidden' })
    expect(Object.keys(calls[0].headers).some(h => /referer|openrouter/i.test(h))).toBe(false)
    expect(asked.length).toBe(0)
    expect(said.length).toBe(0)
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'max' })
  })

  test('an OpenRouter model with no key is skipped without a request; Zen answers', { options: { decisionModels: 'openrouter/typesafe/jev-1.13, opencode/jev-1.13-free' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const calls = decisions(on, () => ({ status: 200, text: decisionReply('low') }))
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'byt namn på en variabel', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.map(c => c.url)).toEqual(['https://opencode.ai/zen/v1/systemone'])
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'low' })
  })

  test('OPENROUTER_API_KEY stands in when no key is set', { options: { decisionModels: 'openrouter/typesafe/jev-1.13' } } as never, async ($, on) => {
    engine(on, { OPENROUTER_API_KEY: 'env-k' })
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const calls = decisions(on, () => ({ status: 200, text: decisionReply('high') }))
    recordSteps(on)

    await $.prompt.submit({ text: 'refaktorera parsern', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.length).toBe(1)
    expect(calls[0].auth).toBe('Bearer env-k')
  })

  test('when every decision model fails, Haiku judges and one toast names the last reason', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"medium","sonnet":"medium","opus":"medium","why":"x"}')
    const said = toasts(on)
    const calls = decisions(on, url => (url.includes('opencode.ai') ? { status: 500, text: 'down' } : { status: 429, text: 'slow down' }))
    const sent = recordSteps(on)

    await $.prompt.submit({ text: 'fixa buggen', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.length).toBe(2)
    expect(asked.length).toBe(1)
    expect(said).toEqual(['effortless: OpenRouter typesafe/jev-1.13 is rate limited (429). Haiku judges for now.'])
    expect(sent[0]).toEqual({ model: 'claude-opus-5-5', effort: 'medium' })
  })

  test('an unsure answer ends the chain: Haiku decides and the next model is not asked', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}')
    const calls = decisions(on, () => ({ status: 200, text: decisionReply('low', 0.3) }))
    recordSteps(on)

    await $.prompt.submit({ text: 'kanske', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.length).toBe(1)
    expect(asked.length).toBe(1)
  })

  test('unsure only for another model than the one in use: no second opinion, the answer for this model stands', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}')
    decisions(on, () => ({ status: 200, text: decisionReply({ haiku: 'max', sonnet: 'xhigh', opus: 'low' }, { sonnet: 0.2 }) }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'kanske', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(asked.length).toBe(0)
    expect(sent[0].effort).toBe('low')
  })

  test('unsure, and Haiku gives no answer either: the effort in force is kept and the band says so', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    let says = decisionReply('high', 0.95)
    decisions(on, () => ({ status: 200, text: says }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await step($)
    says = decisionReply('low', 0.3)
    await $.prompt.submit({ text: 'and what about the lexer', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(sent.map(s => s.effort)).toEqual(['high', 'high'])
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    expect(await drawn(ui)).toContain('unsure, keeping')
    await ui.unmount()
  })

  test('a kept level says kept in the word, so it does not read as a verdict that never came', { options: { decisionModels: CHAIN, openrouterKey: 'or-k', layout: 'default' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    let says = decisionReply('high', 0.95)
    decisions(on, () => ({ status: 200, text: says }))
    recordSteps(on)
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const guide = await $.ui.mount(DESK_BAND)
    await guide.press({ key: 'setup-close' })
    await guide.unmount()
    const band = await $.ui.mount(DESK_BAND)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(band)).toContain('"children":["High"]')

    says = decisionReply('low', 0.3)
    await $.prompt.submit({ text: 'and what about the lexer', wait: false, origin: { kind: 'composer' } })
    expect(await drawn(band)).toContain('"children":["High · kept"]')
    await band.unmount()
  })

  test('a kept level says kept on its button in the minimal look', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    let says = decisionReply('high', 0.95)
    decisions(on, () => ({ status: 200, text: says }))
    recordSteps(on)
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    expect(JSON.stringify(await ui.find({ key: 'e-high' }))).toContain('"label":"high"')

    says = decisionReply('low', 0.3)
    await $.prompt.submit({ text: 'and what about the lexer', wait: false, origin: { kind: 'composer' } })
    expect(JSON.stringify(await ui.find({ key: 'e-high' }))).toContain('"label":"high · kept"')
    await ui.unmount()
  })

  test('unsure on the first prompt: the effort kept is the app\'s own, within Min and Max', { options: { decisionModels: CHAIN, openrouterKey: 'or-k', effortFloor: 'high' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    decisions(on, () => ({ status: 200, text: decisionReply('low', 0.3) }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await step($, 'medium')
    expect(sent[0].effort).toBe('high')
  })

  test('a switch away from an unsure pick takes the new model\'s sure answer, and says how sure', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('classic.PostModelSwitch', () => ({}) as never)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    decisions(on, () => ({ status: 200, text: decisionReply({ sonnet: 'xhigh', opus: 'low' }, { sonnet: 0.8, opus: 0.3 }) }))
    const sent = recordSteps(on)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await $.classic.PostModelSwitch({ from_model: 'claude-opus-5-5', to_model: 'claude-sonnet-5-5', requested_model: null, source: 'picker', context_tokens: 0 } as never)
    // The app already on xhigh, so the band's note is the reason, not "/effort shows …".
    await stepOn($, 'claude-sonnet-5-5', 'xhigh')
    expect(sent[0].effort).toBe('xhigh')
    const ui = await $.ui.mount({ plugin: 'effortless', surface: 'terminal', ...BAND })
    const text = await drawn(ui)
    expect(text).toContain('80% sure')
    expect(text).not.toContain('unsure, keeping')
    await ui.unmount()
  })

  /** The last verdict line from /effortless debug, and the judge's counts from /effortless stats. */
  const debugLine = async ($: Engine) => String((await $.command.run({ command: 'effortless', args: 'debug' })).text)
  const statsLine = async ($: Engine) => String((await $.command.run({ command: 'effortless', args: 'stats' })).text)

  test('a decision model sure of its answer decides alone: Haiku is not asked, and the stats count a decision', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    decisions(on, () => ({ status: 200, text: decisionReply('low', 0.9) }))
    recordSteps(on)
    await $.prompt.submit({ text: 'rename it', wait: false, origin: { kind: 'composer' } })
    expect(asked.length).toBe(0)
    expect(await statsLine($)).toContain('Judge: decision models 1, Haiku after unsure 0, after no answer 0, Haiku only 0')
  })

  test('no decision model listed: Haiku is the judge alone, the verdict line says only judge, and the stats count it', async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    recordSteps(on)
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: haiku (only judge): ')
    expect(await statsLine($)).toContain('Judge: decision models 0, Haiku after unsure 0, after no answer 0, Haiku only 1')
  })

  test('a decision model unsure of the effort: Haiku decides, the verdict line gives the sureness, and the stats count Haiku after unsure', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}')
    decisions(on, () => ({ status: 200, text: decisionReply('low', 0.3) }))
    recordSteps(on)
    await $.prompt.submit({ text: 'kanske', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: haiku (unsure 0.30): ')
    expect(await statsLine($)).toContain('Judge: decision models 0, Haiku after unsure 1, after no answer 0, Haiku only 0')
  })

  test('a decision model silent on the model in use: Haiku decides, the verdict line says no answer for it, and the stats count Haiku after unsure', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"high","sonnet":"high","opus":"high","why":"x"}')
    decisions(on, () => ({ status: 200, text: decisionReply({ haiku: 'low' }) }))
    recordSteps(on)
    await $.prompt.submit({ text: 'kanske', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: haiku (no answer for opus): ')
    expect(await statsLine($)).toContain('Judge: decision models 0, Haiku after unsure 1, after no answer 0, Haiku only 0')
  })

  test('every decision model fails: Haiku decides, the verdict line gives the last reason, and the stats count Haiku after no answer', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    judgeSays(on, '{"haiku":"medium","sonnet":"medium","opus":"medium","why":"x"}')
    decisions(on, url => (url.includes('opencode.ai') ? { status: 500, text: 'down' } : { status: 429, text: 'slow down' }))
    recordSteps(on)
    await $.prompt.submit({ text: 'fixa buggen', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: haiku (chain: OpenRouter typesafe/jev-1.13 is rate limited (429)): ')
    expect(await statsLine($)).toContain('Judge: decision models 0, Haiku after unsure 0, after no answer 1, Haiku only 0')
  })

  test('a decision model unsure of the effort and Haiku with no answer: the decision model counts, and the line says Haiku gave no answer', { options: { decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    decisions(on, () => ({ status: 200, text: decisionReply('low', 0.3) }))
    recordSteps(on)
    await $.prompt.submit({ text: 'kanske', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: jev-1.13-free: ')
    expect(await debugLine($)).toContain(' (unsure 0.30, Haiku gave no answer) -> ')
    expect(await statsLine($)).toContain('Judge: decision models 1, Haiku after unsure 0, after no answer 0, Haiku only 0')
  })

  test('Haiku the only judge gives no answer: nothing is counted, and the line says no verdict', async ($, on) => {
    engine(on)
    mock.clock(on)
    on('model.complete', () => ({ value: { isAnswered: false as const } }) as never)
    recordSteps(on)
    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    expect(await debugLine($)).toContain('last verdict: no verdict')
    expect(await statsLine($)).toContain('nothing measured yet')
  })

  test('with the haiku judge picked, decision models are not asked',{ options: { judge: 'haiku', decisionModels: CHAIN, openrouterKey: 'or-k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    const asked = judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const calls = decisions(on, () => ({ status: 200, text: decisionReply('max') }))
    recordSteps(on)

    await $.prompt.submit({ text: 'hej', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(calls.length).toBe(0)
    expect(asked.length).toBe(1)
  })
})

describe('decision models in the settings and the guide (fork)', () => {
  const start = async ($: Engine, on: On) => {
    on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
  }
  function configSet(on: On) {
    const set: { key: string; value: unknown }[] = []
    on('config.set', (_$, e) => {
      set.push({ key: e.key, value: e.value })
      return { value: e.value } as never
    })
    return set
  }
  /** Files under a home folder, read and written by the mod; chmod runs are recorded. */
  function home(on: On, files: Record<string, string> = {}) {
    const ran: string[][] = []
    on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }) as never)
    on('fs.write', (_$, e) => {
      files[e.path] = e.text
      return { value: undefined } as never
    })
    on('process.run', (_$, e) => {
      ran.push(e.argv)
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    })
    return { files, ran }
  }
  function toasts(on: On) {
    on('ui.toast', () => ({ value: undefined }) as never)
  }
  async function openPanel($: Engine) {
    const guide = await $.ui.mount(DESK_BAND)
    if (await guide.find({ key: 'setup-close' })) await guide.press({ key: 'setup-close' })
    await guide.unmount()
    await $.command.run({ command: 'effortless', args: 'settings' } as never)
    return $.ui.mount(DESK_BAND)
  }
  const ZEN = 'opencode/jev-1.13-free'
  const LIQUID = 'openrouter/liquid/d1-ultra'

  test('a setting saved from the panel keeps the decision models: the next prompt still goes to Zen', { options: { decisionModels: ZEN } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    toasts(on)
    configSet(on)
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const urls: string[] = []
    on('http.fetch', (_$, e) => {
      urls.push(e.url)
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('high') } }
    })
    recordSteps(on)
    await start($, on)
    const panel = await openPanel($)
    await panel.press({ key: 'settings-card-effort' })
    await panel.press({ key: 'settings-helpers-switch' })
    await panel.press({ key: 'settings-save' })
    await panel.unmount()

    await $.prompt.submit({ text: 'refaktorera parsern', wait: false, origin: { kind: 'composer' } })
    await step($)

    expect(urls.filter(u => u.includes('systemone') || u.includes('decisions'))).toEqual(['https://opencode.ai/zen/v1/systemone'])
  })

  test('the Judge part shows the chain; Models adds, moves and removes; Save writes the new order', { options: { decisionModels: ZEN } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    toasts(on)
    home(on)
    const set = configSet(on)
    await start($, on)
    const panel = await openPanel($)
    expect(await drawn(panel)).toContain('Haiku + 1 model')
    await panel.press({ key: 'settings-card-judge' })
    expect(await drawn(panel)).toContain('jev-1.13-free → Haiku')
    // Zen needs no key: no key field until an OpenRouter model is listed.
    expect(await panel.find({ key: 'settings-or-key' })).toBeUndefined()
    expect(await panel.find({ key: 'settings-key' })).toBeUndefined()
    await panel.press({ key: 'settings-models-open' })
    expect(await drawn(panel)).toContain('Judge ›')
    expect(await drawn(panel)).toContain('OpenCode')
    await panel.select({ key: 'settings-model-add', value: LIQUID })
    expect(await drawn(panel)).toContain('2 liquid/d1-ultra')
    expect(await drawn(panel)).toContain('OpenRouter')
    await panel.press({ key: `model-earlier-${LIQUID}` })
    expect(await drawn(panel)).toContain('1 liquid/d1-ultra')
    await panel.press({ key: `model-remove-${ZEN}` })
    expect(await panel.find({ key: `model-chip-${ZEN}` })).toBeUndefined()
    await panel.select({ key: 'settings-model-each', value: '3000' })
    // Back goes to the Judge part, which now asks for the OpenRouter key.
    await panel.press({ key: 'settings-back' })
    expect(await drawn(panel)).toContain('liquid/d1-ultra → Haiku')
    expect(await panel.find({ key: 'settings-or-key' })).toBeDefined()
    expect(set).toEqual([])
    await panel.press({ key: 'settings-save' })
    expect(set).toContainEqual({ key: 'effortless.decisionModels', value: LIQUID })
    expect(set).toContainEqual({ key: 'effortless.judgeTimeoutMs', value: '3000' })
    await panel.unmount()
  })

  test('an id that is not a model says so and adds nothing', { options: { decisionModels: ZEN } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    toasts(on)
    await start($, on)
    const panel = await openPanel($)
    await panel.press({ key: 'settings-card-judge' })
    await panel.press({ key: 'settings-models-open' })
    await panel.select({ key: 'settings-model-add', value: 'other' })
    await panel.input({ key: 'settings-model-other', text: 'gpt-5' })
    expect(await drawn(panel)).toContain('Not a model id')
    // A real id is added and the field goes away.
    await panel.input({ key: 'settings-model-other', text: 'openrouter/acme/decider' })
    expect(await drawn(panel)).not.toContain('Not a model id')
    expect(await panel.find({ key: 'settings-model-other' })).toBeUndefined()
    expect(await drawn(panel)).toContain('2 acme/decider')
    await panel.unmount()
  })

  test('an OpenRouter key pasted in the panel goes to ~/.config/openrouter/effortless.env, owner-only, and is used over an older one', { options: { decisionModels: LIQUID, openrouterKey: 'old-k' } } as never, async ($, on) => {
    engine(on, { HOME: '/h' })
    mock.clock(on)
    toasts(on)
    configSet(on)
    const { files, ran } = home(on, { '/h/.config/openrouter/effortless.env': 'OTHER=1\n' })
    judgeSays(on, '{"haiku":"low","sonnet":"low","opus":"low","why":"x"}')
    const auth: (string | undefined)[] = []
    on('http.fetch', (_$, e) => {
      auth.push((e.init?.headers as Record<string, string> | undefined)?.authorization)
      return { value: { status: 200, ok: true, headers: {}, text: decisionReply('high') } }
    })
    recordSteps(on)
    await start($, on)
    const panel = await openPanel($)
    await panel.press({ key: 'settings-card-judge' })
    await panel.input({ key: 'settings-or-key', text: ' or-new ' })
    await panel.press({ key: 'settings-save' })
    await panel.unmount()
    expect(files['/h/.config/openrouter/effortless.env']).toBe('OTHER=1\nOPENROUTER_API_KEY=or-new\n')
    expect(ran).toContainEqual(['chmod', '600', '/h/.config/openrouter/effortless.env'])

    await $.prompt.submit({ text: 'refaktorera parsern', wait: false, origin: { kind: 'composer' } })
    await step($)
    expect(auth.at(-1)).toBe('Bearer or-new')
  })

  test('Test names the model that answered and the ones that did not', { options: { decisionModels: `openrouter/x/nope, ${ZEN}`, openrouterKey: 'k' } } as never, async ($, on) => {
    engine(on)
    mock.clock(on)
    toasts(on)
    on('http.fetch', (_$, e) =>
      e.url.includes('openrouter') ? { value: { status: 404, ok: false, headers: {}, text: 'no' } } : { value: { status: 200, ok: true, headers: {}, text: decisionReply('low') } })
    await start($, on)
    const panel = await openPanel($)
    await panel.press({ key: 'settings-card-judge' })
    await panel.press({ key: 'settings-judge-test' })
    const text = await drawn(panel)
    expect(text).toContain('jev-1.13-free answered: haiku low')
    expect(text).toContain('x/nope: failed (404)')
    await panel.unmount()
  })

  test('the guide: Jev on Zen needs no key and sets the chain', async ($, on) => {
    engine(on)
    mock.clock(on)
    toasts(on)
    const set = configSet(on)
    await start($, on)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'setup-decision' })
    expect(await drawn(band)).toContain('Where should the decision model run?')
    expect(await drawn(band)).toContain('OpenCode')
    await band.press({ key: 'setup-zen' })
    expect(await band.find({ key: 'setup-bias2' })).toBeDefined()
    await band.press({ key: 'setup-close' })
    expect(set).toContainEqual({ key: 'effortless.decisionModels', value: ZEN })
    await band.unmount()
  })

  test('the guide: an OpenRouter key is saved and Jev on OpenRouter follows Zen', async ($, on) => {
    engine(on, { HOME: '/h' })
    mock.clock(on)
    toasts(on)
    const set = configSet(on)
    const { files } = home(on)
    await start($, on)
    const band = await $.ui.mount(DESK_BAND)
    await band.press({ key: 'setup-decision' })
    await band.press({ key: 'setup-openrouter' })
    expect(await drawn(band)).toContain('openrouter.ai')
    await band.press({ key: 'setup-back' })
    expect(await band.find({ key: 'setup-zen' })).toBeDefined()
    await band.press({ key: 'setup-openrouter' })
    await band.input({ key: 'setup-or-key', text: 'or-k' })
    expect(files['/h/.config/openrouter/effortless.env']).toBe('OPENROUTER_API_KEY=or-k\n')
    await band.press({ key: 'setup-close' })
    expect(set).toContainEqual({ key: 'effortless.decisionModels', value: `${ZEN}, openrouter/liquid/d1-ultra` })
    await band.unmount()
  })

  test('the guide steps: both key steps are step 1 and go back to where the decision model runs', () => {
    expect(setupNext('decision-openrouter')).toBe('lean')
    expect(setupNext('decision-typesafe')).toBe('lean')
    expect(setupBack('decision-openrouter')).toBe('decision')
    expect(setupBack('decision-typesafe')).toBe('decision')
    expect(setupCounter('decision-openrouter')).toBe('1/4')
  })

  test('list edits, labels and env lines', () => {
    expect(withRoute(ZEN, LIQUID)).toBe(`${ZEN}, ${LIQUID}`)
    expect(withRoute(ZEN, ZEN)).toBe(ZEN)
    expect(withRoute(ZEN, 'gpt-5')).toBe(ZEN)
    expect(withoutRoute(`${ZEN}, ${LIQUID}`, ZEN)).toBe(LIQUID)
    expect(movedEarlier(`${ZEN}, ${LIQUID}`, LIQUID)).toBe(`${LIQUID}, ${ZEN}`)
    expect(movedEarlier(`${ZEN}, ${LIQUID}`, ZEN)).toBe(`${ZEN}, ${LIQUID}`)
    expect(routeLabel(parseDecisionModels(LIQUID)[0])).toBe('liquid/d1-ultra')
    expect(routeLabel(parseDecisionModels('openrouter/acme/decider')[0])).toBe('acme/decider')
    expect(routeLabel(parseDecisionModels('opencode/jev-1.13-free')[0])).toBe('jev-1.13-free')
    expect(withEnvLine('A=1\nOPENROUTER_API_KEY=old\n', 'OPENROUTER_API_KEY', 'n$&w')).toBe('A=1\nOPENROUTER_API_KEY=n$&w\n')
    expect(withEnvLine('A=1', 'OPENROUTER_API_KEY', 'k')).toBe('A=1\nOPENROUTER_API_KEY=k\n')
  })
})
