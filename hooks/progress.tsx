import { tintHex } from './theme'

import type { Progress, ProgressStep } from '../types'

// The task's step list (from the todo and task tools) and the drawing the agent panel and the judge's wait take from the
// progress bar: each phase's look, its art and track, and the thinking dots.

/** Past this many steps the bar is one continuous fill instead of a segment per step. */
const SEGMENTS_MAX = 12

// The brand purple, as in register.tsx, and the two signal sets: yellow when Claude asks, green when it is done.
/** A phase's look in the current theme: the violet ones turn orange, the signal greens and yellows stay. */
export const looks = (phase: Progress['phase']) => {
  const l = LOOKS[phase]
  return { color: tintHex(l.color), bg: tintHex(l.bg), edge: tintHex(l.edge) }
}
export const LOOKS: Record<Progress['phase'], { color: string; bg: string; edge: string }> = {
  planning: { color: '#a79cf7', bg: '#15121f', edge: '#4a3f80' },
  working: { color: '#a79cf7', bg: '#15121f', edge: '#4a3f80' },
  paused: { color: '#7d76a8', bg: '#15121f', edge: '#3a3360' },
  asking: { color: '#e0a33a', bg: '#1c1608', edge: '#6b5218' },
  done: { color: '#6fcf8e', bg: '#0e1a12', edge: '#2f6b45' },
}

type Todo = { content: string; status: ProgressStep['status']; activeForm?: string }

/** The steps of a TodoWrite list, the whole list each time. */
export function stepsFromTodos(todos: readonly Todo[]): ProgressStep[] {
  return todos.map((t, i) => ({ id: `todo-${i}`, label: t.content, doing: t.activeForm || t.content, status: t.status }))
}

/** The steps with a task TaskCreate made added at the end, pending. */
export function withTaskCreated(steps: readonly ProgressStep[], id: string, task: { subject: string; activeForm?: string }): ProgressStep[] {
  return [...steps.filter(s => s.id !== id), { id, label: task.subject, doing: task.activeForm || task.subject, status: 'pending' }]
}

/** The steps after a TaskUpdate: a new status, subject or running form; deleted drops the step. */
export function withTaskUpdated(
  steps: readonly ProgressStep[],
  change: { taskId: string; status?: ProgressStep['status'] | 'deleted'; subject?: string; activeForm?: string },
): ProgressStep[] {
  if (change.status === 'deleted') return steps.filter(s => s.id !== change.taskId)
  return steps.map(s =>
    s.id !== change.taskId
      ? s
      : {
          ...s,
          ...(change.status ? { status: change.status } : {}),
          ...(change.subject ? { label: change.subject } : {}),
          ...(change.activeForm ? { doing: change.activeForm } : {}),
        },
  )
}

/** How far along the task is, 0 to 1: completed steps, and half of each one in progress. */
export function progressShare(steps: readonly ProgressStep[]): number {
  if (!steps.length) return 0
  const done = steps.filter(s => s.status === 'completed').length
  const doing = steps.filter(s => s.status === 'in_progress').length
  return Math.min(1, (done + doing / 2) / steps.length)
}

/** The thinking dots' size in pixels. */
export const THINK_W = 34

/**
 * Planning, before any step exists: three dots pulsing one after another, like thinking. No bar: nothing is measured
 * yet, so nothing pretends to fill. Fixed size, so its interactive frame fits it.
 */
export function thinkingSvg(phase: Progress['phase'], w = THINK_W, h = PILL_H): string {
  const look = looks(phase)
  const r = h / 2
  const dots = [0, 1, 2]
    .map(i => `<circle class="dot" style="animation-delay:${(i * 0.18).toFixed(2)}s" cx="${6 + i * 11}" cy="${r}" r="3" fill="${look.color}"/>`)
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    '<style>:root{color-scheme:light dark}html,body{margin:0;overflow:hidden}svg{background:transparent;display:block}' +
    '.dot{transform-box:fill-box;transform-origin:center;opacity:.3;animation:dot 1.1s ease-in-out infinite}' +
    '@keyframes dot{30%{opacity:1;transform:translateY(-2.5px) scale(1.15)}60%{opacity:.3;transform:none}}</style>' +
    dots +
    '</svg>'
  )
}

/** The thinking pill's height in pixels. */
export const PILL_H = 16

/**
 * The track as one image that scales to the band's width, so it fits any window: a pill per step. Done steps are
 * filled, pending steps a faint outline, and the step in progress is alive: soft light flows through it, a shine
 * passes over it now and then and its glow breathes. A small flag at the end turns into a ticked circle when the task
 * is done. Past SEGMENTS_MAX one continuous pill, filled to the share done. The image is not interactive (an
 * interactive one needs a fixed size); its CSS animation still runs where the surface animates images, and it reads
 * the same standing still.
 */
export function progressTrackSvg(p: Progress): string {
  const look = looks(p.phase)
  const id = p.phase
  const W = 1000
  const H = 24
  const end = 30
  const y = 4
  const h = 16
  const r = h / 2
  const n = (v: number) => v.toFixed(1)
  const finished = p.phase === 'done'
  const pending = (x: number, w: number) =>
    `<rect x="${n(x + 0.6)}" y="${y + 0.6}" width="${n(Math.max(0, w - 1.2))}" height="${h - 1.2}" rx="${r - 0.6}" fill="#ffffff" fill-opacity=".04" stroke="${look.color}" stroke-opacity=".3" stroke-width="1.2"/>`
  const filled = (x: number, w: number) => `<rect x="${n(x)}" y="${y}" width="${n(Math.max(0, w))}" height="${h}" rx="${r}" fill="url(#fill-${id})"/>`
  // The live pill: a breathing halo, a body of light flowing to the right, a shine that passes over it, a bright rim.
  const live = (x: number, w: number, share = 1) => {
    const lit = Math.max(r * 2, w * share)
    const flow = 160
    return (
      `<rect class="halo" x="${n(x)}" y="${y}" width="${n(lit)}" height="${h}" rx="${r}" fill="${look.color}" filter="url(#halo-${id})"/>` +
      (share < 1 ? `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${h}" rx="${r}" fill="${look.color}" fill-opacity=".1"/>` : '') +
      `<clipPath id="cut-${id}"><rect x="${n(x)}" y="${y}" width="${n(lit)}" height="${h}" rx="${r}"/></clipPath>` +
      `<g clip-path="url(#cut-${id})">` +
      `<rect x="${n(x)}" y="${y}" width="${n(lit)}" height="${h}" fill="${look.color}" fill-opacity=".78"/>` +
      `<g class="flow"><rect x="${n(x - flow)}" y="${y}" width="${n(lit + flow * 2)}" height="${h}" fill="url(#flow-${id})"/></g>` +
      `<rect x="${n(x)}" y="${y}" width="${n(lit)}" height="${h / 2}" fill="#ffffff" fill-opacity=".1"/>` +
      `<g class="shine"><rect x="${n(x - 60)}" y="${y - 4}" width="44" height="${h + 8}" transform="skewX(-25)" fill="url(#shine-${id})"/></g>` +
      '</g>' +
      `<rect x="${n(x + 0.6)}" y="${y + 0.6}" width="${n(lit - 1.2)}" height="${h - 1.2}" rx="${r - 0.6}" fill="none" stroke="#ffffff" stroke-opacity=".32" stroke-width="1.2"/>` +
      `<style>.shine{animation:shine-${id} 3.2s ease-in-out infinite}@keyframes shine-${id}{0%,35%{transform:translateX(0)}100%{transform:translateX(${n(lit + 140)}px)}}</style>`
    )
  }
  const total = p.steps.length
  const room = W - end
  const parts: string[] = []
  if (total > 0 && total <= SEGMENTS_MAX) {
    const gap = 10
    const seg = (room - gap * (total - 1)) / total
    p.steps.forEach((step, i) => {
      const x = i * (seg + gap)
      if (finished || step.status === 'completed') parts.push(filled(x, seg))
      else if (step.status === 'in_progress' && p.phase !== 'paused') parts.push(live(x, seg))
      else parts.push(pending(x, seg))
    })
  } else {
    parts.push(finished ? filled(0, room) : live(0, room, progressShare(p.steps)))
  }
  const fx = W - 12
  const flag = finished
    ? `<circle cx="${fx}" cy="12" r="9" fill="${look.color}"/><path d="M${fx - 4.4} 12.2L${fx - 1.4} 15.2L${fx + 4.2} 8.8" fill="none" stroke="${look.bg}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M${fx - 6} 21V3.5" stroke="${look.color}" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/><path d="M${fx - 5.2} 4L${fx + 7} 7.8L${fx - 5.2} 11.6Z" fill="${look.color}" fill-opacity=".75"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    '<style>svg{background:transparent;display:block;overflow:visible}' +
    '.flow{animation:flow 2.6s linear infinite}@keyframes flow{from{transform:translateX(0)}to{transform:translateX(160px)}}' +
    '.halo{opacity:.35;animation:halo 2.4s ease-in-out infinite}@keyframes halo{50%{opacity:.75}}</style>' +
    `<defs><linearGradient id="fill-${id}" x1="0" x2="1"><stop offset="0" stop-color="${look.color}" stop-opacity=".62"/><stop offset="1" stop-color="${look.color}"/></linearGradient>` +
    // A repeating band of light every 160 units, so moving it by one period loops without a seam.
    `<linearGradient id="flow-${id}" gradientUnits="userSpaceOnUse" x1="0" x2="160" spreadMethod="repeat"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset=".5" stop-color="#ffffff" stop-opacity=".26"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="shine-${id}" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".8"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<filter id="halo-${id}" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>` +
    parts.join('') + flag + '</svg>'
  )
}

/** The background art's size in pixels: wider than any band, cut by it on the right. */
export const ART_W = 1600
export const ART_H = 64

/**
 * The band's whole background, in its colour, in layers: a faint dot grid, soft aurora clouds drifting and breathing,
 * two flowing lines of light, a slow streak passing across, twinkling sparkles, and one layer by state. Planning:
 * points of a constellation lighting up and linking. Working: particles streaming right. Asking: ripples spreading and
 * question marks rising. Done: confetti falling and checkmarks rising. Fixed size, anchored left and cut by the band,
 * so its interactive frame always fits; one source per state.
 */
export function progressArtSvg(phase: Progress['phase']): string {
  const c = looks(phase).color
  // A fixed pseudo-random spread, so the same state always draws the same art.
  const spread = (count: number, salt: number) =>
    Array.from({ length: count }, (_, i) => {
      const a = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
      const b = Math.sin((i + 1) * 39.3467 + salt * 11.135) * 24634.6345
      return [(i + (a - Math.floor(a))) * (ART_W / count), 8 + (b - Math.floor(b)) * (ART_H - 16), a - Math.floor(a)] as const
    })
  const f = (v: number) => v.toFixed(1)
  const sparks = spread(26, 1)
    .map(([x, y, k]) => {
      const s = 2 + k * 2.6
      return (
        `<path class="sp" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${(k * 4.2).toFixed(2)}s" ` +
        `d="M${f(x)} ${f(y - s)}L${f(x + s * 0.28)} ${f(y - s * 0.28)}L${f(x + s)} ${f(y)}L${f(x + s * 0.28)} ${f(y + s * 0.28)}L${f(x)} ${f(y + s)}L${f(x - s * 0.28)} ${f(y + s * 0.28)}L${f(x - s)} ${f(y)}L${f(x - s * 0.28)} ${f(y - s * 0.28)}Z" fill="#fff"/>`
      )
    })
    .join('')
  const clouds = spread(6, 5)
    .map(([x, , k], i) =>
      `<ellipse class="cl" style="animation-delay:-${(k * 9).toFixed(2)}s;animation-duration:${(9 + k * 6).toFixed(2)}s" cx="${f(x)}" cy="${i % 2 ? 50 : 14}" rx="${f(120 + k * 90)}" ry="26" fill="${c}"/>`,
    )
    .join('')
  // Two sine lines across the band; their dashes travel, so light runs along them.
  const wave = (amp: number, period: number, phase0: number, cls: string, op: number) => {
    let d = ''
    for (let x = 0; x <= ART_W; x += 20) d += `${x ? 'L' : 'M'}${x} ${f(ART_H / 2 + amp * Math.sin((x / period) * Math.PI * 2 + phase0))}`
    return `<path class="${cls}" d="${d}" fill="none" stroke="${c}" stroke-opacity="${op}" stroke-width="1.2" stroke-linecap="round"/>`
  }
  const rising = (count: number, glyph: (x: number) => string) =>
    spread(count, 7)
      .map(([x, , k]) => `<g class="up" style="animation-delay:${(k * 3).toFixed(2)}s;animation-duration:${(3 + k * 1.5).toFixed(2)}s">${glyph(x)}</g>`)
      .join('')
  let extra = ''
  if (phase === 'done') {
    const hues = [c, '#ffffff', '#f2d16b', '#a79cf7']
    extra =
      spread(34, 11)
        .map(([x, , k], i) =>
          `<rect class="cf" style="animation-delay:-${(k * 4).toFixed(2)}s;animation-duration:${(2.6 + k * 2).toFixed(2)}s" x="${f(x)}" y="-8" width="${(3 + k * 3).toFixed(1)}" height="${(2 + k * 2).toFixed(1)}" rx=".6" fill="${hues[i % hues.length]}"/>`,
        )
        .join('') +
      rising(14, x => `<path d="M${f(x - 5)} 56L${f(x - 1.5)} 59.5L${f(x + 5.5)} 52" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`)
  } else if (phase === 'asking') {
    extra =
      spread(5, 9)
        .map(([x, y, k]) => `<circle class="rp" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${(k * 3).toFixed(2)}s" cx="${f(x)}" cy="${f(y)}" r="22" fill="none" stroke="${c}" stroke-width="1.2"/>`)
        .join('') +
      rising(10, x => `<text x="${f(x)}" y="60" font-size="13" font-family="sans-serif" font-weight="700" fill="${c}">?</text>`)
  } else if (phase === 'planning') {
    const pts = spread(16, 4)
    extra =
      pts
        .slice(1)
        .map(([x, y], i) => {
          const [px, py] = pts[i]
          return `<line class="lk" style="animation-delay:${(i * 0.35).toFixed(2)}s" x1="${f(px)}" y1="${f(py)}" x2="${f(x)}" y2="${f(y)}" stroke="${c}" stroke-width="1" stroke-dasharray="140" stroke-dashoffset="140"/>`
        })
        .join('') +
      pts.map(([x, y], i) => `<circle class="nd" style="animation-delay:${(i * 0.35).toFixed(2)}s" cx="${f(x)}" cy="${f(y)}" r="2.2" fill="${c}"/>`).join('')
  } else {
    extra = spread(30, 3)
      .map(([x, y, k]) => `<circle class="pt" style="animation-delay:-${(k * 3).toFixed(2)}s;animation-duration:${(1.8 + k * 2.2).toFixed(2)}s" cx="${f(x)}" cy="${f(y)}" r="${(0.8 + k * 1.4).toFixed(1)}" fill="${c}"/>`)
      .join('') +
      spread(9, 6)
        .map(([x, y, k]) => `<rect class="ln" style="animation-delay:${(k * 2.4).toFixed(2)}s" x="${f(x)}" y="${f(y)}" width="${f(40 + k * 50)}" height="1.2" rx=".6" fill="${c}"/>`)
        .join('')
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_W}" height="${ART_H}" viewBox="0 0 ${ART_W} ${ART_H}">` +
    '<style>:root{color-scheme:light dark}html,body{margin:0;overflow:hidden}svg{background:transparent;display:block}' +
    '.sp{opacity:0;transform:scale(0);animation:tw 4.2s ease-in-out infinite}' +
    '@keyframes tw{0%,70%,100%{opacity:0;transform:scale(0) rotate(0)}82%{opacity:.85;transform:scale(1) rotate(30deg)}92%{opacity:0;transform:scale(.2) rotate(60deg)}}' +
    '.cl{opacity:.1;animation-name:cl;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}' +
    '@keyframes cl{from{opacity:.06;transform:translateX(-60px)}to{opacity:.2;transform:translateX(60px)}}' +
    '.w1{stroke-dasharray:90 260;animation:w 7s linear infinite}.w2{stroke-dasharray:50 330;animation:w 11s linear infinite reverse}' +
    '@keyframes w{to{stroke-dashoffset:-1400}}' +
    '.up{opacity:0;animation-name:up;animation-timing-function:ease-out;animation-iteration-count:infinite}' +
    '@keyframes up{0%{opacity:0;transform:translateY(0)}20%{opacity:.6}100%{opacity:0;transform:translateY(-52px)}}' +
    '.ln{opacity:0;animation:ln 2.4s ease-in infinite}@keyframes ln{0%{opacity:0;transform:translateX(-60px)}30%{opacity:.35}100%{opacity:0;transform:translateX(220px)}}' +
    '.pt{opacity:0;animation-name:pt;animation-timing-function:linear;animation-iteration-count:infinite}' +
    '@keyframes pt{0%{opacity:0;transform:translateX(0)}15%{opacity:.6}100%{opacity:0;transform:translateX(160px)}}' +
    '.rp{opacity:0;transform:scale(.2);animation:rp 3s ease-out infinite}@keyframes rp{0%{opacity:.6;transform:scale(.2)}100%{opacity:0;transform:scale(1.6)}}' +
    '.cf{animation-name:cf;animation-timing-function:linear;animation-iteration-count:infinite}' +
    '@keyframes cf{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:.85}100%{opacity:0;transform:translateY(80px) rotate(540deg)}}' +
    '.cf{transform-box:fill-box;transform-origin:center}' +
    '.lk{opacity:.4;animation:lk 5.6s ease-in-out infinite}@keyframes lk{0%{stroke-dashoffset:140;opacity:0}30%{opacity:.45}60%{stroke-dashoffset:0;opacity:.45}100%{stroke-dashoffset:0;opacity:0}}' +
    '.nd{transform-box:fill-box;transform-origin:center;opacity:.2;animation:nd 5.6s ease-in-out infinite}@keyframes nd{0%,100%{opacity:.15;transform:scale(.7)}25%{opacity:1;transform:scale(1.5)}50%{opacity:.5;transform:scale(1)}}' +
    `.sweep{animation:sweep 6s linear infinite}@keyframes sweep{from{transform:translateX(-400px)}to{transform:translateX(${ART_W + 100}px)}}</style>` +
    `<defs><linearGradient id="wash" x1="0" x2="1"><stop offset="0" stop-color="${c}" stop-opacity=".06"/><stop offset=".6" stop-color="${c}" stop-opacity=".1"/><stop offset="1" stop-color="${c}" stop-opacity=".2"/></linearGradient>` +
    '<linearGradient id="beam" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    `<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r=".8" fill="${c}" fill-opacity=".16"/></pattern>` +
    '<filter id="soft" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="16"/></filter></defs>' +
    `<rect width="${ART_W}" height="${ART_H}" fill="url(#wash)"/>` +
    `<rect width="${ART_W}" height="${ART_H}" fill="url(#dots)"/>` +
    `<g filter="url(#soft)">${clouds}</g>` +
    wave(9, 420, 0, 'w1', 0.5) + wave(6, 300, 2, 'w2', 0.35) +
    `<g class="sweep"><rect x="0" y="-20" width="300" height="${ART_H + 40}" transform="skewX(-20)" fill="url(#beam)"/></g>` +
    sparks + extra + '</svg>'
  )
}
