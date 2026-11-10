// Environment and .env files: the variables the mod reads (each asked for once), the .env line helpers, the proof log and
// the render log. Imports nothing from register.tsx.
import type { EngineInterface } from 'claude-code'

/** The TypeSafe key in a ~/.config/jev/.env file's text. */
export function parseTypesafeKey(text: string): string | undefined {
  return parseEnvLine(text, 'TYPESAFE_API_KEY')
}

/** A typed or pasted TypeSafe key: a TYPESAFE_API_KEY=… line gives its value (none when empty), else the text itself. */
export function typedTypesafeKey(text: string): string | undefined {
  return /^\s*TYPESAFE_API_KEY\s*=/.test(text) ? parseTypesafeKey(text) : text
}

/** A NAME=value line's value in an .env file's text, quotes taken off. */
export function parseEnvLine(text: string, name: string): string | undefined {
  const value = text.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'))?.[1].replace(/^['"]|['"]$/g, '')
  return value || undefined
}

/** A TYPESAFE_API_KEY line set in an .env file's text: replaced where it is, added where it is not. */
export function withTypesafeKey(text: string, key: string): string {
  return withEnvLine(text, 'TYPESAFE_API_KEY', key)
}

/** A NAME=value line set in an .env file's text: replaced where it is, added where it is not. */
export function withEnvLine(text: string, name: string, value: string): string {
  const line = `${name}=${value}`
  const at = new RegExp(`^\\s*${name}\\s*=.*$`, 'm')
  if (at.test(text)) return text.replace(at, () => line)
  return `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`
}

// Proof log: every verdict, /effort and request effort, written to EFFORTLESS_LOG, or to
// %TEMP%/effortless-proof.log while the mod is loaded from a dev-mods folder. Off otherwise.
const proofLines: string[] = []
// An environment variable does not change while the session runs, so each one is asked for once. The
// engine wants the name spelled out in every $.env.get call, hence one small getter per variable.
export type EnvAsk = Promise<string | undefined> | undefined
let askLog: EnvAsk
let askTemp: EnvAsk
let askTmpdir: EnvAsk
let askTypesafeUrl: EnvAsk
let askTypesafeKey: EnvAsk
let askOpenRouterKey: EnvAsk
let askUserProfile: EnvAsk
let askHome: EnvAsk
function envLog($: EngineInterface) {
  return (askLog = askLog ?? $.env.get('EFFORTLESS_LOG'))
}
function envTemp($: EngineInterface) {
  return (askTemp = askTemp ?? $.env.get('TEMP'))
}
function envTmpdir($: EngineInterface) {
  return (askTmpdir = askTmpdir ?? $.env.get('TMPDIR'))
}
export function envTypesafeUrl($: EngineInterface) {
  return (askTypesafeUrl = askTypesafeUrl ?? $.env.get('TYPESAFE_URL'))
}
export function envTypesafeKey($: EngineInterface) {
  return (askTypesafeKey = askTypesafeKey ?? $.env.get('TYPESAFE_API_KEY'))
}
export function envOpenRouterKey($: EngineInterface) {
  return (askOpenRouterKey = askOpenRouterKey ?? $.env.get('OPENROUTER_API_KEY'))
}
export function envUserProfile($: EngineInterface) {
  return (askUserProfile = askUserProfile ?? $.env.get('USERPROFILE'))
}
export function envHome($: EngineInterface) {
  return (askHome = askHome ?? $.env.get('HOME'))
}

async function proofPath($: EngineInterface): Promise<string | undefined> {
  const named = await envLog($)
  if (named) return named
  if (!$.plugin.root.replace(/\\/g, '/').includes('/dev-mods/')) return undefined
  const tmp = (await envTemp($)) ?? (await envTmpdir($)) ?? '/tmp'
  return `${tmp}/effortless-proof.log`
}
export async function proof($: EngineInterface, line: string) {
  const path = await proofPath($).catch(() => undefined)
  if (!path) return
  proofLines.push(`${new Date().toISOString()} ${line}`)
  await $.fs.write(path, proofLines.slice(-200).join('\n') + '\n').catch(() => undefined)
}

// Every time the app asked for the band, with what it sent, written to ~/.claude/effortless-render-<chat>.log each second
// (the last 300): how often the band is really redrawn in the app, which the render rig cannot see (hover flicker).
export const renderLog: string[] = []
let renderLogWritten = 0
export async function writeRenderLog($: EngineInterface) {
  if (renderLog.length === renderLogWritten) return
  if (renderLog.length > 600) renderLog.splice(0, renderLog.length - 300)
  renderLogWritten = renderLog.length
  const home = (await envUserProfile($)) ?? (await envHome($))
  // One file per chat: a shared file was overwritten whole by whichever chat drew last.
  if (home) await $.fs.write(`${home}/.claude/effortless-render-${loadedSession}.log`, renderLog.slice(-300).join('\n') + '\n').catch(() => undefined)
}
// The chat this load serves. Imports cannot assign a binding, so session.start sets it through setLoadedSession.
export let loadedSession = '-'
export function setLoadedSession(chat: string) {
  loadedSession = chat
}
