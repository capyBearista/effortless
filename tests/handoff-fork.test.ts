import { describe, expect, mock, test as baseTest } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { HANDOFF_FULL_PROMPT, HANDOFF_PROMPT, handoffArgs, handoffMessage, withFocus } from '../hooks/register'

// The fork's handoff: a detailed Full prompt, an optional focus for the next session, and Full's turn at medium.
// Like effortless.test.ts, the tests run in the minimal look.
type Opts = Parameters<typeof baseTest>[1]
const minimal = (o?: Record<string, unknown>) => ({ ...(o ?? {}), options: { layout: 'minimal', ...((o?.options as object) ?? {}) } })
const test = ((name: string, a: unknown, b?: unknown) =>
  b === undefined
    ? baseTest(name, minimal() as Opts, a as never)
    : baseTest(name, minimal(a as Record<string, unknown>) as Opts, b as never)) as typeof baseTest

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const FOOTER = { plugin: 'effortless', surface: 'desktop', component: 'SessionMode', props: { modes: [] } } as never
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const
const DESK_BAND = { plugin: 'effortless', surface: 'desktop', ...BAND } as never
const TERM_BAND = { plugin: 'effortless', surface: 'terminal', ...BAND } as never

/** A session for handoffs: records forks, commands, prompts sent and each main request's effort. The judge says `judged`. */
function handoffEngine(on: On, model = 'claude-opus-5-5', judged = 'low') {
  mock.store(on)
  mock.env(on, { EFFORTLESS_MODEL_UI: '1' })
  on('ui.status', () => ({ value: undefined }))
  on('session.messages', () => ({ value: [] }) as never)
  on('session.model', () => ({ value: model }))
  on('command.list', () => ({ value: [{ name: 'model' }, { name: 'effort' }, { name: 'session-handoff', source: 'user' }] as never }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  const forked: string[] = []
  on('model.fork', (_$, e) => {
    forked.push(e.prompt)
    return { value: { isAnswered: true, text: 'Goal: quick.', usage: USAGE } } as never
  })
  on('model.complete', () => ({ value: { isAnswered: true as const, text: `{"model":"opus","effort":"${judged}","why":"x"}`, usage: USAGE } }))
  const ran: { command: string; args: string }[] = []
  on('command.run', (_$, e) => {
    ran.push({ command: e.command, args: e.args })
    return { text: 'ok' }
  })
  const submitted: string[] = []
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const efforts: unknown[] = []
  on('turn.step', async function* (_$, e) {
    efforts.push(e.effort)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  return { forked, ran, submitted, efforts }
}

/** One main-conversation request, sent with the app's effort `effort`. */
async function request($: Engine, turnId: string, effort = 'high', model = 'claude-opus-5-5') {
  for await (const _ of $.turn.step({ turnId, index: 0, model, effort, messageCount: 1 } as never)) {
    // drain
  }
}

/** Opens the handoff bar from the footer, picks the kind, then types the focus (Enter is Go) or presses Go. */
async function handOff($: Engine, kind: 'quick' | 'full', focus?: string, at = DESK_BAND) {
  const footer = await $.ui.mount(FOOTER)
  await footer.press({ key: 'handoff' })
  await footer.unmount()
  const bar = await $.ui.mount(at)
  await bar.press({ key: `handoff-${kind}` })
  if (focus !== undefined) await bar.input({ key: 'handoff-focus', text: focus })
  else await bar.press({ key: 'handoff-go' })
  await bar.unmount()
}

const done = (turnId: string, answer: string, reason = 'answer') =>
  ({ turnId, answer, durationMs: 1, isAborted: reason !== 'answer', reason }) as never

describe('full handoff prompt (fork)', () => {
  test('saves HANDOFF.md under docs/ in order, else the root, never making a folder', () => {
    expect(HANDOFF_FULL_PROMPT).toContain('HANDOFF.md in the first of these folders that exists in the project: docs/internal/, docs/local/, docs/.')
    expect(HANDOFF_FULL_PROMPT).toContain('If none exists, save it in the project root. Never create a folder.')
  })

  test('Markdown sections in order, detail first, no subagent, the whole reply', () => {
    const headings = ['## Original task', '## Work completed', '## Work remaining', '## Attempted approaches', '## Critical context', '## Current state', '## Suggested skills']
    const at = headings.map(h => HANDOFF_FULL_PROMPT.indexOf(h))
    expect(at.every(i => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(HANDOFF_FULL_PROMPT).toContain('No XML tags')
    expect(HANDOFF_FULL_PROMPT).toContain('Detail and precision come before brevity')
    expect(HANDOFF_FULL_PROMPT).toContain('Never hand it to a subagent')
    expect(HANDOFF_FULL_PROMPT).toContain('Reply with the whole handoff, its path on the first line')
    expect(HANDOFF_FULL_PROMPT).toContain('git status')
    expect(HANDOFF_FULL_PROMPT).toContain('Redact secrets')
    expect(HANDOFF_FULL_PROMPT).not.toContain('40 lines')
    expect(HANDOFF_FULL_PROMPT).not.toContain('80 lines')
  })

  test('the focus is added only when given; the command keeps its case', () => {
    expect(withFocus(HANDOFF_PROMPT)).toBe(HANDOFF_PROMPT)
    expect(withFocus(HANDOFF_PROMPT, '   ')).toBe(HANDOFF_PROMPT)
    expect(withFocus(HANDOFF_FULL_PROMPT, ' Ship the CLI ')).toContain('The next session is for: Ship the CLI\n')
    expect(handoffArgs('handoff')).toEqual({ full: false, focus: '' })
    expect(handoffArgs('handoff full')).toEqual({ full: true, focus: '' })
    expect(handoffArgs('handoff Full Finish The Parser')).toEqual({ full: true, focus: 'Finish The Parser' })
    expect(handoffArgs('handoff fullscreen bug')).toEqual({ full: false, focus: 'fullscreen bug' })
    expect(handoffMessage('x', 'continue')).not.toContain('This session is for')
    expect(handoffMessage('x', 'continue', undefined, 'Ship it')).toContain('This session is for: Ship it\n\nContinue with the next step.')
    expect(handoffMessage('x', 'confirm', 'session-handoff', 'Ship it')).toContain('This session is for: Ship it\n\nFirst read the handoff')
  })
})

describe('handoff focus (fork)', () => {
  test('Quick: the focus typed in the bar reaches the fork and opens the new chat', async ($, on) => {
    const { forked, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, 'quick', 'Write the parser tests')
    await mocked.advance(2500)
    expect(forked).toEqual([withFocus(HANDOFF_PROMPT, 'Write the parser tests')])
    expect(submitted.at(-1)).toContain('Goal: quick.')
    expect(submitted.at(-1)).toContain('This session is for: Write the parser tests')
  })

  test('Quick with no focus sends the prompt as it was', async ($, on) => {
    const { forked, submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, 'quick')
    await mocked.advance(2500)
    expect(forked).toEqual([HANDOFF_PROMPT])
    expect(submitted.at(-1)).not.toContain('This session is for')
  })

  test('the field starts empty each time the bar opens', async ($, on) => {
    const { forked } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const footer = await $.ui.mount(FOOTER)
    await footer.press({ key: 'handoff' })
    const bar = await $.ui.mount(DESK_BAND)
    expect(await bar.find({ key: 'handoff-focus' })).toBeDefined()
    await bar.press({ key: 'handoff-close' })
    await bar.unmount()
    await footer.unmount()
    await handOff($, 'quick')
    await mocked.advance(2500)
    expect(forked).toEqual([HANDOFF_PROMPT])
  })

  test('Full: the focus reaches the built-in prompt', async ($, on) => {
    const { submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, 'full', 'Release 2.0')
    await mocked.advance(2500)
    expect(submitted.at(-1)).toBe(withFocus(HANDOFF_FULL_PROMPT, 'Release 2.0'))
  })

  test('Full with a skill: the focus is the skill\'s argument', { options: { handoffSkill: 'session-handoff' } } as never, async ($, on) => {
    const { ran } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, 'full', 'Release 2.0')
    await mocked.advance(2500)
    expect(ran).toContainEqual({ command: 'session-handoff', args: 'Release 2.0' })
  })

  test('the terminal bar has the field too', async ($, on) => {
    const { submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'terminal', isInteractive: true } as never)
    // The bar's state is the session's: opened from the footer, the terminal draws it above the prompt.
    await handOff($, 'full', 'Docs pass', TERM_BAND)
    await mocked.advance(2500)
    expect(submitted.at(-1)).toBe(withFocus(HANDOFF_FULL_PROMPT, 'Docs pass'))
  })

  test('/effortless handoff full <focus> keeps the focus as typed', async ($, on) => {
    const { submitted } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    const said = String((await $.command.run({ command: 'effortless', args: 'handoff full Finish The Parser' })).text)
    expect(said).toContain('full handoff for: Finish The Parser')
    await mocked.advance(2500)
    expect(submitted.at(-1)).toBe(withFocus(HANDOFF_FULL_PROMPT, 'Finish The Parser'))
  })
})

describe('full handoff effort (fork)', () => {
  test('runs at medium after a prompt judged low, then the next chat goes back to the pick', async ($, on) => {
    const { submitted, efforts } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await request($, 't1')
    expect(efforts.at(-1)).toBe('low')
    await handOff($, 'full')
    await mocked.advance(2500)
    await request($, 't2')
    await request($, 't2')
    expect(efforts.slice(-2)).toEqual(['medium', 'medium'])
    await $.turn.complete(done('t2', 'docs/HANDOFF.md\n# Handoff'))
    await mocked.advance(2500)
    expect(submitted.at(-1)).toContain('# Handoff')
    await request($, 't3')
    expect(efforts.at(-1)).toBe('low')
    const debug = String((await $.command.run({ command: 'effortless', args: 'debug' })).text)
    expect(debug).toContain('full handoff: medium')
  })

  test('medium with Auto off too, then the app\'s own effort again', async ($, on) => {
    const { efforts } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.command.run({ command: 'effortless', args: 'auto' })
    await request($, 't1', 'xhigh')
    expect(efforts.at(-1)).toBe('xhigh')
    await handOff($, 'full')
    await mocked.advance(2500)
    await request($, 't2', 'xhigh')
    expect(efforts.at(-1)).toBe('medium')
    await $.turn.complete(done('t2', 'docs/HANDOFF.md\n# Handoff'))
    await mocked.advance(2500)
    await request($, 't3', 'xhigh')
    expect(efforts.at(-1)).toBe('xhigh')
  })

  test('a handoff turn that is stopped gives the effort back', async ($, on) => {
    const { efforts } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await request($, 't1')
    await handOff($, 'full')
    await mocked.advance(2500)
    await request($, 't2')
    expect(efforts.at(-1)).toBe('medium')
    await $.turn.complete(done('t2', '', 'aborted'))
    await request($, 't3')
    expect(efforts.at(-1)).toBe('low')
  })

  test('Quick is not pinned: it runs as before', async ($, on) => {
    const { efforts } = handoffEngine(on)
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await $.prompt.submit({ text: 'refactor the parser', wait: false, origin: { kind: 'composer' } })
    await request($, 't1')
    await handOff($, 'quick')
    await mocked.advance(2500)
    await request($, 't2')
    expect(efforts.at(-1)).toBe('low')
  })

  test('on a model where an effort change rewrites the cache, Full keeps the effort in use', async ($, on) => {
    const { efforts } = handoffEngine(on, 'claude-opus-4-7')
    const mocked = mock.clock(on)
    await $.session.start({ cwd: '.', surface: 'desktop', isInteractive: true } as never)
    await handOff($, 'full')
    await mocked.advance(2500)
    await request($, 't2', 'xhigh', 'claude-opus-4-7')
    expect(efforts.at(-1)).toBe('xhigh')
  })
})
