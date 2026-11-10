import type { EngineInterface, ModelForkResult } from 'claude-code'
import type { HandoffAfter, HandoffChoice } from '../types'
import { HAIKU_MODEL } from './config'

// The handoff: one click writes a handoff, clears the chat and sends the handoff into it as the first message.
// The quick handoff is written by a fork, which has no tools: it says what the chat last saw and marks what it cannot
// check. The full handoff (the person's own skill) is the one that inspects git and saves files.
export const HANDOFF_PROMPT = [
  'Write a handoff so this work can continue in a fresh chat that has no other context.',
  '',
  'Start with the project, its folder and the branch. Then:',
  '- Goal: one or two lines.',
  '- Done: what changed, with file paths, and how each change was checked. Never present something planned, skipped or untested as done.',
  '- Not done: what is half done, and the concrete blocker (a failed check, a missing approval, an open question).',
  '- Git: local changes, local commits, pushed commits and open PRs, as last seen in this chat. You cannot check now, so say "as of last check".',
  '- Next steps in priority order. Make the first one runnable: a file path, a command or a specific decision. Mark every step that needs the user with "needs user".',
  '- To resume: the start command, the preview URL, and the limits on what is allowed (what needs the user\'s approval, test vs production).',
  '- Do not redo: decisions made and why, approaches that failed.',
  '',
  'Give only the final state of anything that changed during the chat. Point to specs, plans and files instead of ' +
    'copying them. Leave out what is finished and no longer matters. Never include secrets, environment values or raw ' +
    'logs. Write in the language the user writes in. Short bullets, at most about 40 lines. Do not use tools. Reply ' +
    'with the handoff only, no preamble or farewell.',
].join('\n')

/** The full handoff when no skill of the person's is picked: a turn that checks the real state, saves a detailed
 * HANDOFF.md and replies with all of it. Slower than the quick fork; detail over brevity, since the next chat has
 * nothing else. */
export const HANDOFF_FULL_PROMPT = [
  'Write a detailed handoff so this work can continue in a fresh chat that has no other context. Someone (or a fresh ' +
    'agent) must be able to pick up exactly where this chat left off, with nothing lost. Detail and precision come ' +
    'before brevity. Fit the detail to the kind of work (coding, research, configuration, writing), but cover every section.',
  '',
  'Write it yourself, in this chat. Never hand it to a subagent: a subagent starts empty and cannot rebuild this conversation.',
  '',
  '1. Check the real state with tools: git status, the last few commits, whether the branch is pushed, open PRs if gh is set up.',
  '2. Save it as HANDOFF.md in the first of these folders that exists in the project: docs/internal/, docs/local/, ' +
    'docs/. If none exists, save it in the project root. Never create a folder. Rewrite the file from scratch.',
  '3. Reply with the whole handoff, its path on the first line, no preamble or farewell.',
  '',
  'Use Markdown with these headings, in this order. No XML tags.',
  '',
  '# Handoff: <project>, <branch>',
  '## Original task',
  'What was asked at the start, precise about scope. Not side tasks or scope added later.',
  '## Work completed',
  '- Files created, changed or read, with paths and line numbers; what changed in each.',
  '- Commands run, APIs called, searches made, and what they showed.',
  '- Findings: answers, data points, patterns.',
  '- Decisions made, and why.',
  '- How each change was checked. Never present something planned, skipped or untested as done.',
  '## Work remaining',
  '- Concrete steps in priority order, each with exact paths, URLs or commands. Make the first one runnable.',
  '- Dependencies and the order they impose.',
  '- How to verify each step.',
  '- Mark every step that needs the user with "needs user".',
  '## Attempted approaches',
  '- What was tried and did not work, and why it failed.',
  '- Errors, blockers and limits hit; dead ends not to repeat.',
  '- Alternatives considered and not pursued.',
  '## Critical context',
  '- Constraints, requirements and limits on what is allowed (what needs the user\'s approval, test vs production).',
  '- Gotchas, edge cases and non-obvious behaviour found.',
  '- Environment, configuration and setup details; how to start or preview the work.',
  '- Assumptions still to be checked.',
  '- Docs, sources and references used.',
  '## Current state',
  '- Each deliverable: done, in progress or not started.',
  '- Git as checked in step 1: local changes, local commits, pushed or not, open PRs.',
  '- What is final and what is a draft, a temporary change or a workaround.',
  '- Open questions and decisions waiting.',
  '## Suggested skills',
  'The skills or slash commands the next chat should use, and when. Write "None" if none fit.',
  '',
  'Point to specs, plans, commits, PRs and files instead of copying them. Redact secrets, keys, passwords, environment ' +
    'values and personal information. Write in the language the user writes in.',
].join('\n')

/** A handoff prompt with the next session's focus, when the person gave one. */
export function withFocus(prompt: string, focus = ''): string {
  const f = focus.trim()
  if (!f) return prompt
  return `${prompt}\n\nThe next session is for: ${f}\nShape the handoff around that: what matters for it comes first, and the next steps start there.`
}

/** The first message of the fresh chat: the handoff, then what to do with it. */
export function handoffMessage(handoff: string, after: HandoffAfter, skill?: string, focus = ''): string {
  const ask =
    after === 'confirm'
      ? 'Read this, say in two lines where things stand and what is next, then wait for me.'
      : 'Continue with the next step. If it is marked "needs user", say what you need and wait.'
  const forWhat = focus.trim() ? `This session is for: ${focus.trim()}\n\n` : ''
  // A full handoff is the person's own skill: it saves the handoff (a file, memories), and its last words in the chat
  // are often only a note that it did. The new chat is told to read what the skill saved before anything else.
  if (skill)
    return (
      `Handoff from the previous chat: it ran /${skill}, which saved the handoff. Its last words there:\n\n${handoff.trim()}\n\n` +
      `${forWhat}First read the handoff /${skill} saved: the files named above, or HANDOFF.md in the project if none is named. ${ask}`
    )
  return `Handoff from the previous chat:\n\n${handoff.trim()}\n\n${forWhat}${ask}`
}

/** /effortless handoff's arguments: "full" first picks the full handoff; the rest is the focus, as typed. */
export function handoffArgs(args: string): { full: boolean; focus: string } {
  const rest = args.trim().replace(/^handoff\b/i, '').trim()
  const full = /^full\b/i.test(rest)
  return { full, focus: (full ? rest.replace(/^full\b/i, '') : rest).trim() }
}

/** What the handoff does, by the choice: who writes it, then what follows. */
export function handoffWhat(choice: HandoffChoice, skill: string): { by: string; then: string } {
  const by = choice.kind === 'full' ? (skill ? `/${skill}, slower` : 'Checks git, saves HANDOFF.md, slower') : 'Done in seconds'
  const then =
    choice.after === 'copy'
      ? 'Copied, chat stays.'
      : choice.after === 'confirm'
          ? 'Clears chat, then waits.'
          : 'Clears chat, carries on.'
  return { by, then }
}

/** What a handoff fork came to, in a few words for /effortless debug: its reason when it wrote nothing. */
export function forkOutcome(result: unknown, ms: number): string {
  const took = `${(ms / 1000).toFixed(1)}s`
  if (result instanceof Error) return `threw: ${result.message.slice(0, 120)} (${took})`
  const r = result as ModelForkResult | undefined
  if (!r || typeof r !== 'object' || !('isAnswered' in r)) return `threw: ${String(result).slice(0, 120)} (${took})`
  if (r.isAnswered) {
    const u = r.usage
    const input = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    const cached = input ? Math.round((u.cache_read_input_tokens / input) * 100) : 0
    return r.text.trim() ? `answered, ${u.output_tokens} out, ${cached}% cached (${took})` : `answered with blank text (${took})`
  }
  if (r.reason === 'api-error') return `api-error ${r.status ?? 'no response'} ${r.error} (${took})`
  return `${r.reason} (${took})`
}

// A compaction written by Haiku: Anthropic names compaction among the jobs it is built for, at a fraction of the
// chat model's price. Claude Code compacts with the chat's own model and has no setting for another, and the
// summarizer's request does not pass through turn.step, so the mod answers session.compact itself: the transcript as
// text, Haiku's summary back as the conversation. Anything that fails falls through to Claude Code's own compaction.
/** The transcript's most text sent to Haiku: about 600k tokens, inside its window with room for the summary. */
const COMPACT_MAX_CHARS = 2_400_000
const COMPACT_SYSTEM = `You compact a conversation between a user and Claude Code, an AI coding agent, so the work can continue
in a fresh context that holds only your summary. Whoever reads it next knows nothing else about the conversation.

Write a detailed summary with these sections:
1. Primary request and intent: everything the user asked for, in detail, including changes of mind.
2. Key technical concepts: technologies, frameworks, constraints and decisions.
3. Files and code: every file read, created or edited, why it matters, and the important snippets or signatures.
4. Errors and fixes: what went wrong, how it was fixed, and any feedback the user gave about it.
5. Problem solving: what was solved and what is still being worked out.
6. All user messages: every message the user wrote that is not a tool result, briefly and in order.
7. Pending tasks: what the user asked for that is not done.
8. Current work: exactly what was being done right before this summary, with file names and code. The last few
messages come nearly uncut: carry the code and errors from them over in full, since the next step builds on them.
9. Next step: the next step, only if it follows directly from the user's latest request, quoting that request.

Be precise: keep names, paths, numbers, commands and error messages exact. Leave out pleasantries.
Reply with the summary only.`

/** The transcript as plain text for the summarizer: each message, its tool calls and their results, the long ones cut. */
// The last messages go to Haiku nearly whole: the work in progress (the code just written, the error just seen) lives
// in their tool calls and results, and a 400-character cut lost it mid-task.
export const COMPACT_TAIL = 6
const COMPACT_TAIL_CHARS = 20_000
export function compactTranscript(messages: readonly { role: string; text: string; toolUses?: readonly { tool: string; input: unknown; text?: string }[]; toolResults?: readonly { text?: string }[] }[], toolChars = 2000, tailChars = COMPACT_TAIL_CHARS): string {
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} …[${s.length - n} more characters]` : s)
  const tailFrom = messages.length - COMPACT_TAIL
  return messages
    .map((m, i) => {
      const inTail = i >= tailFrom
      const inputChars = inTail ? tailChars : 400
      const resultChars = inTail ? tailChars : toolChars
      const lines = [`${m.role === 'user' ? 'USER' : 'CLAUDE'}: ${m.text}`.trimEnd()]
      for (const t of m.toolUses ?? []) {
        lines.push(`  [${t.tool} ${cut(JSON.stringify(t.input ?? {}), inputChars)}]`)
        if (t.text) lines.push(`  → ${cut(t.text, resultChars)}`)
      }
      if (!m.toolUses?.length) for (const r of m.toolResults ?? []) if (r.text) lines.push(`  → ${cut(r.text, resultChars)}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

/** Haiku's summary of the transcript, or why there is none. */
export async function haikuCompaction($: EngineInterface, messages: Parameters<typeof compactTranscript>[0], instructions?: string): Promise<{ text: string } | { fail: string }> {
  let transcript = compactTranscript(messages)
  if (transcript.length > COMPACT_MAX_CHARS) transcript = compactTranscript(messages, 300, 4000)
  if (transcript.length > COMPACT_MAX_CHARS) return { fail: 'the chat is too long for Haiku' }
  const r = await $.model.complete({
    model: HAIKU_MODEL,
    system: COMPACT_SYSTEM,
    prompt: `${transcript}\n\n---\nWrite the summary now.${instructions?.trim() ? `\nThe user asked the summary to keep or stress: ${instructions.trim()}` : ''}`,
    maxTokens: 16000,
    effort: 'medium',
    timeoutMs: 240_000,
  })
  if (!r.isAnswered) return { fail: 'reason' in r ? String(r.reason) : 'no answer' }
  return r.text.trim().length > 200 ? { text: r.text.trim() } : { fail: 'the summary came back empty' }
}

/** The quick handoff written by Haiku from the transcript, for a chat whose cache went cold; null when it fails. */
export async function haikuHandoff($: EngineInterface, messages: Parameters<typeof compactTranscript>[0], focus = ''): Promise<string | null> {
  let transcript = compactTranscript(messages)
  if (transcript.length > COMPACT_MAX_CHARS) transcript = compactTranscript(messages, 300, 4000)
  if (transcript.length > COMPACT_MAX_CHARS) return null
  const r = await $.model.complete({
    model: HAIKU_MODEL,
    system: 'You read a conversation between a user and Claude Code, an AI coding agent, and write the handoff the user asks for.',
    prompt: `${transcript}\n\n---\n${withFocus(HANDOFF_PROMPT, focus)}`,
    maxTokens: 4000,
    effort: 'medium',
    timeoutMs: 120_000,
  })
  return r.isAnswered && r.text.trim().length > 100 ? r.text.trim() : null
}
