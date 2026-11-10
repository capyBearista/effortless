import type { Effort } from '../types'
import { EFFORTS } from './config'

// The prompt cache lives this long after the last request read or wrote it. A response may say which lifetime its
// cache writes got (usage.cache_creation: ephemeral_1h / ephemeral_5m); until one does, 1 hour is assumed: 99% of
// the cache writes in 80k requests of real Claude Code use (289k of 292k) were 1 hour.
export const CACHE_TTL = { '5m': 5 * 60_000, '1h': 60 * 60_000 } as const

// Under this much time left the countdown turns amber: send now, or pay to write the whole context again.
// Shown minutes at or under these turn the countdown yellow, then red: grey while there is time, yellow at 20, red at 5.
const CACHE_YELLOW_MIN = 20
const CACHE_RED_MIN = 5

export const ICE = '#7cc4ff'

const YELLOW = '#e0a33a'
const RED = '#e5534b'

/** The cache lifetime a response's writes got, when it says; nothing when it wrote nothing or does not say. */
export function cacheTtlOf(usage: unknown): keyof typeof CACHE_TTL | undefined {
  const c = (usage as { cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number } } | null)
    ?.cache_creation
  if ((c?.ephemeral_1h_input_tokens ?? 0) > 0) return '1h'
  if ((c?.ephemeral_5m_input_tokens ?? 0) > 0) return '5m'
  return undefined
}

/** Most of the prompt came from the cache: it was still warm. */
export function mostlyCached(usage: unknown): boolean {
  const u = (usage ?? {}) as { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  const read_ = u.cache_read_input_tokens ?? 0
  const all = read_ + (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
  return all > 0 && read_ / all > 0.5
}

/** The countdown's colour for whole minutes left (rounded up, as cacheMinutes gives): none (grey), yellow or red. */
export function cacheColor(minutesLeft: number): string | undefined {
  const shown = minutesLeft - 1
  if (minutesLeft <= 0) return ICE
  if (shown > CACHE_YELLOW_MIN) return undefined
  return shown <= CACHE_RED_MIN ? RED : YELLOW
}

/** The footer's words for the time left: "58m", "<1m", or "Cold". */
export function cacheLabel(minutesLeft: number): string {
  if (minutesLeft <= 0) return '❄ Cold'
  if (minutesLeft === 1) return '<1m'
  return `${minutesLeft - 1}m`
}

/** The dashboard's countdown to the second: "58:41", or "Cold" once it ran out. */
export function cacheClock(msLeft: number): string {
  if (msLeft <= 0) return '❄ Cold'
  const s = Math.ceil(msLeft / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** How many seconds the countdown image carries: the band is redrawn once a minute, with some slack. */
const CLOCK_FRAMES = 75
/** The dashboard's countdown as an image that ticks by itself: one frame per second, each shown for its second by a
 * CSS animation. The band is redrawn only once a minute: every redraw rebuilds the band, which restarts every image's
 * animation (the Handoff glow restarted each second while the band was redrawn for the seconds). The app sets the
 * image's font and colour to the band's, so the digits match the text around them. */
export function cacheClockSvg(msLeft: number, color: string): string {
  const start = Math.max(0, Math.ceil(msLeft / 1000))
  const frames: string[] = []
  for (let j = 0; j < CLOCK_FRAMES && start - j > 0; j++) {
    const left = start - j
    const label = `cache ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
    frames.push(`<text x="0" y="12.5" style="animation-delay:${j}s">${label}</text>`)
  }
  frames.push(`<text x="0" y="12.5" style="animation-delay:${frames.length}s;animation-duration:100000s">❄ Cold</text>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="17" viewBox="0 0 84 17"><style>text{font-size:13px;fill:${color};opacity:0;animation:f 1s step-end 1}@keyframes f{0%{opacity:1}100%{opacity:0}}</style>${frames.join('')}</svg>`
}

// Closed, the running-hot band stays away for the rest of its window, and comes back once at this many percent.
export const HOT_FINAL = 95

/** The running-hot band closed with its cross: the window (kind and reset time) and how full it was then. */
export type HotClosed = { window: string; percent: number }
export const hotWindow = (heat: { kind: string; resetsAt: string | null }) =>
  // To the quarter hour: the reset time the app reports can shift by seconds between checks.
  `${heat.kind} ${heat.resetsAt ? Math.round(new Date(heat.resetsAt).getTime() / 900_000) : ''}`

/** Whether the running-hot band shows: always until closed; closed, not again in that window unless it passes HOT_FINAL. */
export function hotVisible(heat: { kind: string; percent: number; resetsAt: string | null }, closed: HotClosed | null): boolean {
  if (!closed || closed.window !== hotWindow(heat)) return true
  return heat.percent >= HOT_FINAL && closed.percent < HOT_FINAL
}

/** "14:20" for a reset time today, "Mon 14:20" further out. */
export function resetLabel(iso: string | null, now: number): string {
  if (!iso) return ''
  const at = new Date(iso)
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return at.getTime() - now < 20 * 3600_000 ? hm : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.getDay()]} ${hm}`
}

/**
 * The effort slider tips close calls only: a verdict the judge was unsure of moves one step toward cheaper or smarter.
 * The outer stops count more calls as close. A sure verdict, or one without a confidence, stays as it is.
 */
export function tipped(effort: Effort, sure: number | undefined, bias: number): Effort {
  if (!bias || sure === undefined || sure >= (Math.abs(bias) === 1 ? 0.65 : 0.85)) return effort
  const i = Math.max(0, Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort) + Math.sign(bias)))
  return EFFORTS[i]
}

/** Floor and ceiling from the settings: what Auto picks stays between them. */
export function bounded(effort: Effort, floor: Effort, ceiling: Effort): Effort {
  const lo = EFFORTS.indexOf(floor)
  const hi = Math.max(lo, EFFORTS.indexOf(ceiling))
  return EFFORTS[Math.max(lo, Math.min(hi, EFFORTS.indexOf(effort)))]
}

/** Save mode caps what Auto picks at medium; a higher pick comes down to it. */
export function capped(effort: Effort, saving: boolean): Effort {
  return saving && EFFORTS.indexOf(effort) > EFFORTS.indexOf('medium') ? 'medium' : effort
}
