import type { EngineInterface } from 'claude-code'
import type { Effort } from '../types'
import { MARK_SVG } from './brand-mark'
import { config, EFFORT_LABELS } from './config'
import { type DecisionRoute } from './decisions'
import { accent, setLight, setMatchApp, setTheme, tintHex } from './theme'
import { tokens } from './stats'
import { cacheLabel, ICE } from './usage'

// The accent the effort in the footer is written in: the brand violet, or Claude orange when the theme says so.
export let ACCENT = accent()
/** Takes the theme the settings name; the accent and every drawing follow it. */
export function applyTheme() {
  setTheme(config.theme)
  ACCENT = accent()
  BRAND_BG = tintHex('#15121f')
  BRAND_EDGE = tintHex('#4a3f80')
  FLASH_COLOR = tintHex('#9b7bff')
  // The panel greys lean blue beside the violet; with Claude orange they are the app's own neutral greys.
  const neutral = config.theme !== 'violet'
  DASH_BG = neutral ? '#151515' : '#141416'
  DASH_EDGE = neutral ? '#2a2a2a' : '#2a2a2f'
  DASH_HEAD = neutral ? '#191919' : '#18181b'
  CARD_HOVER = neutral ? '#1c1c1c' : '#1c1c20'
  CARD_HOVER_EDGE = neutral ? '#3b3b3b' : '#3b3b42'
  HOVER_BOX = neutral ? '#2b2b2b' : '#2b2b2f'
  applyAppearance()
}

// Claude Code's own theme, read from its /config row: a light one turns everything light when appearance is auto.
let claudeIsLight = false
let appearanceCheckedAt = -Infinity
function applyAppearance() {
  setLight(config.appearance === 'light' || (config.appearance === 'auto' && claudeIsLight))
  // Where the band draws images the app's own light or dark is followed instead (theme.ts, setMatchApp).
  setMatchApp(config.appearance === 'auto')
}
/** Reads Claude Code's theme row (at most every few seconds) and redraws when light or dark changed. */
export async function refreshAppearance($: EngineInterface) {
  const now = await $.clock.now().catch(() => Date.now())
  if (now - appearanceCheckedAt < 4000) return
  appearanceCheckedAt = now
  const rows = await $.config.list().catch(() => [])
  const value = rows.find(row => row.key === 'theme')?.value
  const lightNow = typeof value === 'string' && value.startsWith('light')
  if (lightNow === claudeIsLight) return
  claudeIsLight = lightNow
  applyAppearance()
  $.ui.invalidate('ui.render')
}
export let BRAND_BG = '#15121f'
export let BRAND_EDGE = '#4a3f80'
// The box behind the level while it is hovered: the grey of the app's own pills.
export let HOVER_BOX = '#2b2b2f'
export const ICE_BG = '#0e1820'
export const ICE_EDGE = '#2f5c80'
export const BOG = '#a7c98f'
export const BOG_BG = '#111710'
export const BOG_EDGE = '#3e5a33'
export const EMBER = '#f08a3c'
export const EMBER_BG = '#1a110c'
export const EMBER_EDGE = '#6a3418'
export const SLATE = '#b4b8c4'
export const SLATE_BG = '#12141b'
export const SLATE_EDGE = '#39415a'
export const COMPACT_FADE_MS = 450
/** The swamped band's colours over the compact bar, fading to nothing: the band seems to turn from green to violet. */
export function compactFadeSvg(elapsedMs: number): string {
  return inPhase(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" preserveAspectRatio="none"><style>.f{animation:f ${COMPACT_FADE_MS / 1000}s ease-out forwards}@keyframes f{from{opacity:1}to{opacity:0}}</style><rect class="f" width="1600" height="240" fill="${BOG_BG}"/></svg>`, elapsedMs)
}
// The handoff card's art while it is written: sparkles carried from left to right.
export const HANDOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.d{fill:#d9d1ff;opacity:0;animation-name:go;animation-timing-function:ease-in-out;animation-iteration-count:infinite}@keyframes go{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}85%{opacity:.7}100%{opacity:0;transform:translate(190px,0)}}.br{animation:br 2.4s ease-in-out infinite}@keyframes br{0%,100%{opacity:.75}50%{opacity:1}}</style><defs><linearGradient id="bg" x1="0" x2="1"><stop offset=".43" stop-color="#7c6cf0" stop-opacity="0"/><stop offset=".7" stop-color="#7c6cf0" stop-opacity=".2"/><stop offset="1" stop-color="#b3a6ff" stop-opacity=".46"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#bg)"/><circle class="d" cx="170" cy="9.2" r="0.83" style="animation-duration:2.7s;animation-delay:-2.2s"/><circle class="d" cx="170" cy="17.8" r="0.54" style="animation-duration:2.2s;animation-delay:-3.0s"/><circle class="d" cx="170" cy="9.7" r="0.64" style="animation-duration:3.6s;animation-delay:-1.7s"/><circle class="d" cx="170" cy="22.4" r="0.79" style="animation-duration:3.1s;animation-delay:-0.5s"/><circle class="d" cx="170" cy="18.0" r="1.02" style="animation-duration:2.9s;animation-delay:-2.7s"/><circle class="d" cx="170" cy="18.8" r="0.54" style="animation-duration:3.3s;animation-delay:-2.1s"/><circle class="d" cx="170" cy="10.6" r="0.52" style="animation-duration:3.4s;animation-delay:-1.7s"/><circle class="d" cx="170" cy="19.8" r="1.03" style="animation-duration:3.2s;animation-delay:-3.3s"/><circle class="d" cx="170" cy="12.7" r="0.98" style="animation-duration:2.8s;animation-delay:-3.4s"/><circle class="d" cx="170" cy="23.3" r="0.56" style="animation-duration:2.4s;animation-delay:-0.8s"/><circle class="d" cx="170" cy="25.2" r="0.76" style="animation-duration:3.1s;animation-delay:-1.1s"/><circle class="d" cx="170" cy="15.2" r="0.73" style="animation-duration:2.7s;animation-delay:-2.1s"/><circle class="d" cx="170" cy="16.9" r="1.04" style="animation-duration:3.2s;animation-delay:-3.3s"/><circle class="d" cx="170" cy="22.8" r="1.09" style="animation-duration:3.1s;animation-delay:-0.6s"/><rect width="360" height="30" fill="url(#grain)"/></g></svg>`

// The band above the prompt when the cache has gone cold: an icy gradient with snowflakes drifting down.
export const FROST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.f path{stroke:#eaf6ff;stroke-width:.5;stroke-linecap:round;fill:none}.f{transform-box:fill-box;transform-origin:center;animation:spin linear infinite;opacity:.75}@keyframes spin{to{transform:rotate(360deg)}}.fr{stroke:#dff1ff;stroke-width:.4;fill:none;stroke-linecap:round;opacity:.5}.gl{fill:#fff;opacity:0;animation:tw 3.6s ease-in-out infinite}@keyframes tw{0%,70%,100%{opacity:0}80%{opacity:.9}}.br{animation:br 6s ease-in-out infinite}@keyframes br{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="ice" x1="0" x2="1"><stop offset=".43" stop-color="#5aa9e6" stop-opacity="0"/><stop offset=".62" stop-color="#5aa9e6" stop-opacity=".12"/><stop offset=".85" stop-color="#8fd0ff" stop-opacity=".28"/><stop offset="1" stop-color="#cdeaff" stop-opacity=".42"/></linearGradient><radialGradient id="cold" cx="330" cy="15" r="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e9f6ff" stop-opacity=".22"/><stop offset="1" stop-color="#e9f6ff" stop-opacity="0"/></radialGradient><linearGradient id="rime" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#ice)"/><rect width="360" height="30" fill="url(#cold)"/><rect width="360" height="30" fill="url(#rime)"/><rect width="360" height="30" fill="url(#grain)"/><path class="fr" d="M360.0 3.0L354.1 2.1M354.1 2.1L349.8 1.8M349.8 1.8L346.7 2.1M346.7 2.1L344.4 2.2M348.2 1.9L347.5 3.2M351.9 1.9L350.3 3.1M350.3 3.1L349.2 3.8M357.0 2.5L355.1 0.6M355.1 0.6L353.5 -0.5M353.5 -0.5L352.4 -1.4M356.1 1.6L354.9 1.4M360.0 27.0L354.1 27.9M354.1 27.9L349.8 28.5M349.8 28.5L346.9 29.6M346.9 29.6L345.0 30.8M348.3 29.0L347.1 28.4M351.9 28.2L350.9 29.9M350.9 29.9L350.3 31.1M357.0 27.5L355.2 29.4M355.2 29.4L353.9 30.9M353.9 30.9L352.8 31.8M356.1 28.4L354.9 28.5M350.0 30.0L348.8 26.2M348.8 26.2L347.9 23.4M347.9 23.4L347.6 21.4M347.6 21.4L347.7 19.9M348.4 24.8L348.9 23.6M349.4 28.1L350.2 26.5M350.2 26.5L350.8 25.3M352.0 0.0L351.0 3.9M351.0 3.9L350.4 6.7M350.4 6.7L349.6 8.6M349.6 8.6L349.0 10.0M350.7 5.3L349.6 5.9M351.5 1.9L352.2 3.6M352.2 3.6L352.9 4.7"/><circle class="gl" cx="228" cy="26" r="0.5" style="animation-delay:0s"/><circle class="gl" cx="205" cy="4" r="0.45" style="animation-delay:1.3s"/><circle class="gl" cx="186" cy="26" r="0.4" style="animation-delay:2.4s"/><circle class="gl" cx="262" cy="6" r="0.5" style="animation-delay:0.7s"/><circle class="gl" cx="300" cy="25" r="0.45" style="animation-delay:3.1s"/><circle class="gl" cx="330" cy="6" r="0.5" style="animation-delay:1.9s"/><g class="f" style="animation-duration:10s;animation-delay:0s"><path d="M236.0 9.0L236.0 13.2M236.0 10.9L237.0 11.8M236.0 10.9L235.0 11.8M236.0 11.9L236.7 12.6M236.0 11.9L235.3 12.6M236.0 9.0L232.4 11.1M234.4 9.9L234.0 11.2M234.4 9.9L233.1 9.6M233.5 10.5L233.2 11.4M233.5 10.5L232.6 10.2M236.0 9.0L232.4 6.9M234.4 8.1L233.1 8.4M234.4 8.1L234.0 6.8M233.5 7.5L232.6 7.8M233.5 7.5L233.2 6.6M236.0 9.0L236.0 4.8M236.0 7.1L235.0 6.2M236.0 7.1L237.0 6.2M236.0 6.1L235.3 5.4M236.0 6.1L236.7 5.4M236.0 9.0L239.6 6.9M237.6 8.1L238.0 6.8M237.6 8.1L238.9 8.4M238.5 7.5L238.8 6.6M238.5 7.5L239.4 7.8M236.0 9.0L239.6 11.1M237.6 9.9L238.9 9.6M237.6 9.9L238.0 11.2M238.5 10.5L239.4 10.2M238.5 10.5L238.8 11.4"/></g><g class="f" style="animation-duration:12s;animation-delay:-4s"><path d="M214.0 21.0L214.0 24.2M214.0 22.4L214.7 23.2M214.0 22.4L213.3 23.2M214.0 23.2L214.5 23.7M214.0 23.2L213.5 23.7M214.0 21.0L211.2 22.6M212.8 21.7L212.5 22.7M212.8 21.7L211.8 21.5M212.1 22.1L211.9 22.8M212.1 22.1L211.4 21.9M214.0 21.0L211.2 19.4M212.8 20.3L211.8 20.5M212.8 20.3L212.5 19.3M212.1 19.9L211.4 20.1M212.1 19.9L211.9 19.2M214.0 21.0L214.0 17.8M214.0 19.6L213.3 18.8M214.0 19.6L214.7 18.8M214.0 18.8L213.5 18.3M214.0 18.8L214.5 18.3M214.0 21.0L216.8 19.4M215.2 20.3L215.5 19.3M215.2 20.3L216.2 20.5M215.9 19.9L216.1 19.2M215.9 19.9L216.6 20.1M214.0 21.0L216.8 22.6M215.2 21.7L216.2 21.5M215.2 21.7L215.5 22.7M215.9 22.1L216.6 21.9M215.9 22.1L216.1 22.8"/></g><g class="f" style="animation-duration:11s;animation-delay:-7s"><path d="M194.0 8.0L194.0 10.6M194.0 9.2L194.6 9.8M194.0 9.2L193.4 9.8M194.0 9.8L194.4 10.2M194.0 9.8L193.6 10.2M194.0 8.0L191.7 9.3M193.0 8.6L192.8 9.4M193.0 8.6L192.2 8.4M192.4 8.9L192.3 9.5M192.4 8.9L191.9 8.8M194.0 8.0L191.7 6.7M193.0 7.4L192.2 7.6M193.0 7.4L192.8 6.6M192.4 7.1L191.9 7.2M192.4 7.1L192.3 6.5M194.0 8.0L194.0 5.4M194.0 6.8L193.4 6.2M194.0 6.8L194.6 6.2M194.0 6.2L193.6 5.8M194.0 6.2L194.4 5.8M194.0 8.0L196.3 6.7M195.0 7.4L195.2 6.6M195.0 7.4L195.8 7.6M195.6 7.1L195.7 6.5M195.6 7.1L196.1 7.2M194.0 8.0L196.3 9.3M195.0 8.6L195.8 8.4M195.0 8.6L195.2 9.4M195.6 8.9L196.1 8.8M195.6 8.9L195.7 9.5"/></g><g class="f" style="animation-duration:13s;animation-delay:-2s"><path d="M176.0 19.0L176.0 21.2M176.0 20.0L176.5 20.5M176.0 20.0L175.5 20.5M176.0 20.5L176.3 20.9M176.0 20.5L175.7 20.9M176.0 19.0L174.1 20.1M175.1 19.5L175.0 20.2M175.1 19.5L174.5 19.3M174.7 19.8L174.5 20.2M174.7 19.8L174.2 19.6M176.0 19.0L174.1 17.9M175.1 18.5L174.5 18.7M175.1 18.5L175.0 17.8M174.7 18.2L174.2 18.4M174.7 18.2L174.5 17.8M176.0 19.0L176.0 16.8M176.0 18.0L175.5 17.5M176.0 18.0L176.5 17.5M176.0 17.5L175.7 17.1M176.0 17.5L176.3 17.1M176.0 19.0L177.9 17.9M176.9 18.5L177.0 17.8M176.9 18.5L177.5 18.7M177.3 18.2L177.5 17.8M177.3 18.2L177.8 18.4M176.0 19.0L177.9 20.1M176.9 19.5L177.5 19.3M176.9 19.5L177.0 20.2M177.3 19.8L177.8 19.6M177.3 19.8L177.5 20.2"/></g><g class="f" style="animation-duration:14s;animation-delay:-9s"><path d="M252.0 22.0L252.0 24.4M252.0 23.1L252.5 23.6M252.0 23.1L251.5 23.6M252.0 23.7L252.4 24.1M252.0 23.7L251.6 24.1M252.0 22.0L249.9 23.2M251.1 22.5L250.9 23.3M251.1 22.5L250.3 22.3M250.5 22.8L250.4 23.4M250.5 22.8L250.0 22.7M252.0 22.0L249.9 20.8M251.1 21.5L250.3 21.7M251.1 21.5L250.9 20.7M250.5 21.2L250.0 21.3M250.5 21.2L250.4 20.6M252.0 22.0L252.0 19.6M252.0 20.9L251.5 20.4M252.0 20.9L252.5 20.4M252.0 20.3L251.6 19.9M252.0 20.3L252.4 19.9M252.0 22.0L254.1 20.8M252.9 21.5L253.1 20.7M252.9 21.5L253.7 21.7M253.5 21.2L253.6 20.6M253.5 21.2L254.0 21.3M252.0 22.0L254.1 23.2M252.9 22.5L253.7 22.3M252.9 22.5L253.1 23.3M253.5 22.8L254.0 22.7M253.5 22.8L253.6 23.4"/></g></g></svg>`
// The frost is drawn larger than the band and cut by it: wide enough for the right side, tall enough for any band.
export const FROST_WIDTH = 440
export const FROST_HEIGHT = 64
// TypeSafe's mark (from typesafe.ai), drawn beside the decision model button: a Button holds text only.
export const TYPESAFE_MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="18" viewBox="0 0 16.487 24"><style>svg{background:transparent;display:block}</style><path d="M 12.756 2.928 L 12.756 7.067 L 16.486 9.487 L 16.487 18.652 L 8.244 24 L 3.732 21.073 L 3.732 16.82 L 0 14.399 L 0 5.35 L 0.355 5.118 L 8.244 0 Z M 5.94 20.65 L 8.242 22.144 L 14.275 18.227 L 11.975 16.735 Z M 9.022 10.332 L 9.022 14.4 L 5.29 16.822 L 5.29 19.216 L 11.197 15.383 L 11.197 8.921 Z M 12.756 15.384 L 14.928 16.794 L 14.928 10.332 L 12.756 8.922 Z M 2.21 13.976 L 4.511 15.47 L 6.812 13.976 L 4.512 12.485 Z M 1.559 6.193 L 1.559 12.544 L 3.731 11.134 L 3.731 7.066 L 7.464 4.643 L 7.464 2.36 L 1.56 6.193 Z M 5.291 11.132 L 7.463 12.542 L 7.463 10.332 L 5.292 8.921 L 5.292 11.132 Z M 5.94 7.487 L 8.244 8.981 L 10.544 7.488 L 8.244 5.994 Z M 9.024 4.643 L 11.196 6.054 L 11.196 3.774 L 9.024 2.359 Z" fill="#ffffff"/></svg>`
// Fork: OpenCode's mark (opencode.ai/favicon.svg, its frame and inner block) in white, cropped to the frame, beside Zen.
export const OPENCODE_MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="16" viewBox="128 96 256 320"><style>svg{background:transparent;display:block}</style><path d="M320 224V352H192V224H320Z" fill="#ffffff" opacity=".4"/><path fill-rule="evenodd" clip-rule="evenodd" d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z" fill="#ffffff"/></svg>`
// Fork: OpenRouter's glyph (openrouter.ai/brand/v2/openrouter-glyph-light.svg) in white, beside OpenRouter.
export const OPENROUTER_MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 401.4 293.7"><style>svg{background:transparent;display:block}</style><path d="M303.9475,17.19926c42.79734,0,77.48933,34.69327,77.48933,77.48933s-34.69199,77.48933-77.48933,77.48933l76.86166,76.86244c9.76367,9.76313,2.84903,26.45667-10.95697,26.45667h-220.88335c-71.32686,0-129.14889-57.82202-129.14889-129.14889S77.64197,17.19926,148.96884,17.19926h154.97866ZM148.96884,68.85881c-42.79607,0-77.48933,34.69327-77.48933,77.48933s34.69327,77.48933,77.48933,77.48933,77.48933-34.69327,77.48933-77.48933-34.69327-77.48933-77.48933-77.48933Z" fill="#ffffff"/></svg>`
// Claude's mark (from claude.ai) in white, drawn beside the Haiku button.
export const CLAUDE_MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 248 248"><style>svg{background:transparent;display:block}</style><path d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z" fill="#ffffff"/></svg>`
/** Fork: the mark drawn beside a decision model: its provider's. Each with its own size, as drawn. */
export const providerMark = (route: DecisionRoute) =>
  route.provider === 'zen' ? { source: OPENCODE_MARK, alt: 'OpenCode', width: 13, height: 16 }
  : route.provider === 'openrouter' ? { source: OPENROUTER_MARK, alt: 'OpenRouter', width: 16, height: 12 }
  : { source: TYPESAFE_MARK, alt: 'TypeSafe', width: 12, height: 18 }
// The band when the context is swamped: murky green, bubbles rising, slow ripples.
export const SWAMP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.b{fill:none;stroke:#cfe8b8;stroke-width:.5;opacity:0;animation-name:rise;animation-timing-function:ease-in;animation-iteration-count:infinite}@keyframes rise{0%{opacity:0;transform:translate(0,0)}15%{opacity:.7}80%{opacity:.5}100%{opacity:0;transform:translate(3px,-30px)}}.rp{fill:none;stroke:#a7c98f;stroke-width:.4;stroke-linecap:round;opacity:.25;animation:drift 7s ease-in-out infinite}@keyframes drift{0%,100%{transform:translate(0,0);opacity:.15}50%{transform:translate(4px,0);opacity:.4}}.mk{animation:mk 8s ease-in-out infinite}@keyframes mk{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="bog" x1="0" x2="1"><stop offset=".43" stop-color="#4f7a3a" stop-opacity="0"/><stop offset=".62" stop-color="#4f7a3a" stop-opacity=".16"/><stop offset=".85" stop-color="#6f9a4f" stop-opacity=".32"/><stop offset="1" stop-color="#9cc27a" stop-opacity=".42"/></linearGradient><linearGradient id="silt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#2b3a1f" stop-opacity=".18"/><stop offset="1" stop-color="#1c2614" stop-opacity=".45"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".06"/></pattern></defs><g mask="url(#m)"><rect class="mk" width="360" height="30" fill="url(#bog)"/><rect width="360" height="30" fill="url(#silt)"/><rect width="360" height="30" fill="url(#grain)"/><path class="rp" style="animation-delay:-0s" d="M190 22 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-2.5s" d="M226 9 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-5s" d="M250 18 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-1.5s" d="M300 24 q6 -2 12 0 t12 0"/><path class="rp" style="animation-delay:-3.8s" d="M322 7 q6 -2 12 0 t12 0"/><circle class="b" cx="168" cy="32" r="1.6" style="animation-duration:6.5s;animation-delay:-0s"/><circle class="b" cx="182" cy="32" r="1.1" style="animation-duration:8s;animation-delay:-2.1s"/><circle class="b" cx="197" cy="32" r="2.0" style="animation-duration:7s;animation-delay:-4.2s"/><circle class="b" cx="210" cy="32" r="1.3" style="animation-duration:9s;animation-delay:-1.0s"/><circle class="b" cx="224" cy="32" r="1.7" style="animation-duration:7.5s;animation-delay:-3.3s"/><circle class="b" cx="238" cy="32" r="1.0" style="animation-duration:8.5s;animation-delay:-5.1s"/><circle class="b" cx="252" cy="32" r="1.4" style="animation-duration:6.8s;animation-delay:-2.6s"/><circle class="b" cx="176" cy="32" r="0.9" style="animation-duration:9.5s;animation-delay:-6.0s"/><circle class="b" cx="232" cy="32" r="0.8" style="animation-duration:10s;animation-delay:-0.5s"/></g></svg>`
// The band when a usage limit is close: embers, sparks rising.
export const EMBER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.s{fill:#ffb06a;opacity:0;animation-name:up;animation-timing-function:ease-out;animation-iteration-count:infinite}@keyframes up{0%{opacity:0;transform:translate(0,0)}12%{opacity:.95}70%{opacity:.6}100%{opacity:0;transform:translate(4px,-30px)}}.br{animation:br 3.4s ease-in-out infinite}@keyframes br{0%,100%{opacity:.8}50%{opacity:1}}.br2{animation:br2 2.2s ease-in-out infinite}@keyframes br2{0%,100%{opacity:.7}40%{opacity:1}70%{opacity:.8}}</style><defs><linearGradient id="heat" x1="0" x2="1"><stop offset=".43" stop-color="#b8461b" stop-opacity="0"/><stop offset=".62" stop-color="#b8461b" stop-opacity=".16"/><stop offset=".85" stop-color="#d9622a" stop-opacity=".32"/><stop offset="1" stop-color="#f08a3c" stop-opacity=".42"/></linearGradient><linearGradient id="glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#e2581f" stop-opacity=".08"/><stop offset="1" stop-color="#ff7a2e" stop-opacity=".32"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".06"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#heat)"/><rect class="br2" width="360" height="30" fill="url(#glow)"/><circle class="s" cx="166" cy="31" r="0.7" style="animation-duration:3.2s;animation-delay:-0s"/><circle class="s" cx="178" cy="31" r="0.5" style="animation-duration:4.1s;animation-delay:-1.2s"/><circle class="s" cx="191" cy="31" r="0.8" style="animation-duration:3.6s;animation-delay:-2.4s"/><circle class="s" cx="203" cy="31" r="0.5" style="animation-duration:4.6s;animation-delay:-0.7s"/><circle class="s" cx="216" cy="31" r="0.7" style="animation-duration:3.9s;animation-delay:-3.0s"/><circle class="s" cx="228" cy="31" r="0.6" style="animation-duration:4.3s;animation-delay:-1.8s"/><circle class="s" cx="241" cy="31" r="0.8" style="animation-duration:3.4s;animation-delay:-0.4s"/><circle class="s" cx="254" cy="31" r="0.5" style="animation-duration:4.8s;animation-delay:-2.9s"/><circle class="s" cx="184" cy="31" r="0.4" style="animation-duration:5.0s;animation-delay:-3.6s"/><circle class="s" cx="236" cy="31" r="0.4" style="animation-duration:4.4s;animation-delay:-2.1s"/><rect width="360" height="30" fill="url(#grain)"/></g></svg>`
// The band when the judge the person picked is failing: signal lost, a blip sweeping along a flat line.
export const DOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.tr{fill:none;stroke:#e6ecf8;stroke-width:.6;stroke-linecap:round;stroke-linejoin:round}.gw{fill:none;stroke:#9fb0d6;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.35}.hd{animation:hd 4.8s linear infinite}@keyframes hd{0%{transform:translate(150px,0)}88%,100%{transform:translate(372px,0)}}.gl{animation:gl 4.8s ease-in-out infinite}@keyframes gl{0%,100%{opacity:.75}50%{opacity:1}}</style><defs><linearGradient id="steel" x1="0" x2="1"><stop offset=".43" stop-color="#5d6a86" stop-opacity="0"/><stop offset=".65" stop-color="#5d6a86" stop-opacity=".16"/><stop offset=".88" stop-color="#7d8aa8" stop-opacity=".32"/><stop offset="1" stop-color="#a3afca" stop-opacity=".42"/></linearGradient><radialGradient id="glow" cx="330" cy="15" r="80" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c4cee6" stop-opacity=".22"/><stop offset="1" stop-color="#8d9ab8" stop-opacity="0"/></radialGradient><pattern id="grid" width="7.5" height="7.5" patternUnits="userSpaceOnUse"><path d="M7.5 0 L0 0 L0 7.5" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width=".25"/></pattern><linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><mask id="sweep"><g class="hd"><rect x="-110" y="0" width="110" height="30" fill="url(#trail)"/></g></mask></defs><g mask="url(#m)"><rect class="gl" width="360" height="30" fill="url(#steel)"/><rect width="360" height="30" fill="url(#glow)"/><rect width="360" height="30" fill="url(#grid)"/><g mask="url(#sweep)"><g transform="translate(0 3.5)"><path class="gw" d="M150 15 L196 15 L196.0 15.0 L199.0 13.8 L202.0 15.0 L204.0 15.0 L205.5 16.5 L208.0 5.0 L210.5 19.0 L212.0 15.0 L216.0 15.0 L220.0 13.0 L224.0 15.0 L238 15 L238.0 15.0 L241.0 14.2 L244.0 15.0 L246.0 15.0 L247.5 16.1 L250.0 8.0 L252.5 17.8 L254.0 15.0 L258.0 15.0 L262.0 13.6 L266.0 15.0 L278 15 L278.0 15.0 L281.0 14.5 L284.0 15.0 L286.0 15.0 L287.5 15.6 L290.0 11.2 L292.5 16.5 L294.0 15.0 L298.0 15.0 L302.0 14.2 L306.0 15.0 L316 15 L316.0 15.0 L319.0 14.9 L322.0 15.0 L324.0 15.0 L325.5 15.2 L328.0 13.8 L330.5 15.5 L332.0 15.0 L336.0 15.0 L340.0 14.8 L344.0 15.0 L360 15"/><path class="tr" d="M150 15 L196 15 L196.0 15.0 L199.0 13.8 L202.0 15.0 L204.0 15.0 L205.5 16.5 L208.0 5.0 L210.5 19.0 L212.0 15.0 L216.0 15.0 L220.0 13.0 L224.0 15.0 L238 15 L238.0 15.0 L241.0 14.2 L244.0 15.0 L246.0 15.0 L247.5 16.1 L250.0 8.0 L252.5 17.8 L254.0 15.0 L258.0 15.0 L262.0 13.6 L266.0 15.0 L278 15 L278.0 15.0 L281.0 14.5 L284.0 15.0 L286.0 15.0 L287.5 15.6 L290.0 11.2 L292.5 16.5 L294.0 15.0 L298.0 15.0 L302.0 14.2 L306.0 15.0 L316 15 L316.0 15.0 L319.0 14.9 L322.0 15.0 L324.0 15.0 L325.5 15.2 L328.0 13.8 L330.5 15.5 L332.0 15.0 L336.0 15.0 L340.0 14.8 L344.0 15.0 L360 15"/></g></g></g></svg>`
// The right of the setup guide, pure decoration (the name is on the left): a purple gradient with a soft glow,
// faint light streaks and grain, a still star, and small sparkles that twinkle in and out here and there. One constant source, so the app never rebuilds its frame (a changing source flickers); the
// motion is CSS inside it.
export const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="64" viewBox="0 0 360 30" preserveAspectRatio="xMaxYMid slice"><style>:root{color-scheme:light dark}html,body{margin:0}svg{background:transparent;display:block}.sp{fill:#fff;opacity:0;transform:scale(0);animation-name:gl;animation-timing-function:ease-in-out;animation-iteration-count:infinite}@keyframes gl{0%,72%,100%{opacity:0;transform:scale(0) rotate(0deg)}82%{opacity:.9;transform:scale(1) rotate(30deg)}92%{opacity:0;transform:scale(.2) rotate(60deg)}}.br{animation:br 6s ease-in-out infinite}@keyframes br{0%,100%{opacity:.85}50%{opacity:1}}</style><defs><linearGradient id="bg" x1="0" x2="1"><stop offset=".43" stop-color="#7c6cf0" stop-opacity="0"/><stop offset=".62" stop-color="#7c6cf0" stop-opacity=".16"/><stop offset=".85" stop-color="#8f7ff0" stop-opacity=".34"/><stop offset="1" stop-color="#b3a6ff" stop-opacity=".48"/></linearGradient><radialGradient id="glow" cx="320" cy="15" r="70" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c9bdff" stop-opacity=".28"/><stop offset="1" stop-color="#9a86ff" stop-opacity="0"/></radialGradient><linearGradient id="fade" x1="0" x2="1"><stop offset=".43" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="1"/></linearGradient><mask id="m"><rect width="360" height="30" fill="url(#fade)"/></mask><pattern id="grain" width="2" height="2" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#fff" fill-opacity=".07"/></pattern></defs><g mask="url(#m)"><rect class="br" width="360" height="30" fill="url(#bg)"/><rect width="360" height="30" fill="url(#glow)"/><rect width="360" height="30" fill="url(#grain)"/><line x1="186" y1="32" x2="198" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="3"/><line x1="204" y1="32" x2="216" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="1.2"/><line x1="226" y1="32" x2="238" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="4"/><line x1="262" y1="32" x2="274" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="1.5"/><line x1="290" y1="32" x2="302" y2="-2" stroke="#fff" stroke-opacity="0.05" stroke-width="3"/><line x1="320" y1="32" x2="332" y2="-2" stroke="#fff" stroke-opacity="0.04" stroke-width="1.2"/><path class="sp" style="transform-origin:168px 8px;animation-duration:4.2s;animation-delay:0.3s" d="M168 6.4 L168.34 7.66 L169.6 8 L168.34 8.34 L168 9.6 L167.66 8.34 L166.4 8 L167.66 7.66 Z"/><path class="sp" style="transform-origin:182px 22px;animation-duration:5.1s;animation-delay:2.1s" d="M182 20.7 L182.27 21.73 L183.3 22 L182.27 22.27 L182 23.3 L181.73 22.27 L180.7 22 L181.73 21.73 Z"/><path class="sp" style="transform-origin:196px 6px;animation-duration:3.8s;animation-delay:1.2s" d="M196 4.2 L196.38 5.62 L197.8 6 L196.38 6.38 L196 7.8 L195.62 6.38 L194.2 6 L195.62 5.62 Z"/><path class="sp" style="transform-origin:208px 19px;animation-duration:4.6s;animation-delay:3.4s" d="M208 17.8 L208.25 18.75 L209.2 19 L208.25 19.25 L208 20.2 L207.75 19.25 L206.8 19 L207.75 18.75 Z"/><path class="sp" style="transform-origin:221px 9px;animation-duration:5.4s;animation-delay:0.9s" d="M221 7.5 L221.31 8.69 L222.5 9 L221.31 9.31 L221 10.5 L220.69 9.31 L219.5 9 L220.69 8.69 Z"/><path class="sp" style="transform-origin:232px 23px;animation-duration:4.0s;animation-delay:2.7s" d="M232 21.9 L232.23 22.77 L233.1 23 L232.23 23.23 L232 24.1 L231.77 23.23 L230.9 23 L231.77 22.77 Z"/><path class="sp" style="transform-origin:244px 7px;animation-duration:4.8s;animation-delay:1.8s" d="M244 5.7 L244.27 6.73 L245.3 7 L244.27 7.27 L244 8.3 L243.73 7.27 L242.7 7 L243.73 6.73 Z"/><path class="sp" style="transform-origin:176px 15px;animation-duration:5.8s;animation-delay:4.0s" d="M176 14.0 L176.21 14.79 L177.0 15 L176.21 15.21 L176 16.0 L175.79 15.21 L175.0 15 L175.79 14.79 Z"/><path class="sp" style="transform-origin:214px 26px;animation-duration:4.4s;animation-delay:3.0s" d="M214 25.0 L214.21 25.79 L215.0 26 L214.21 26.21 L214 27.0 L213.79 26.21 L213.0 26 L213.79 25.79 Z"/><path class="sp" style="transform-origin:238px 15px;animation-duration:3.6s;animation-delay:0.1s" d="M238 14.0 L238.21 14.79 L239.0 15 L238.21 15.21 L238 16.0 L237.79 15.21 L237.0 15 L237.79 14.79 Z"/></g></svg>`

// The handoff card once it has landed: the brand's art in green, with a big dark checkmark on the right.
// The dashboard sits there all the time, so it is grey: purple is kept for the moments that ask for attention. Its
// art is the brand's, in grey and at 40% of its strength; only the ✦ keeps the accent.
export const DASH_SVG = BRAND_SVG.replace(/stop-opacity="([0-9.]+)"/g, (_m, v: string) => `stop-opacity="${(Number(v) * 0.4).toFixed(3)}"`)
  .replace(/#(7c6cf0|8f7ff0|b3a6ff|c9bdff|9a86ff)/g, '#9a9aa2')
export let DASH_BG = '#141416'
export let DASH_EDGE = '#2a2a2f'
/** The settings title's word in the website hero's style: crisp, going soft and grainy at its bottom right (a radial
 * mask fades the crisp copy out there and a copy through the site's #grainy filter takes over). The app gives the image
 * the band's font. */
// The word is held to the image's width (textLength): an image draws in its own fallback font, wider than the app's,
// and "effortless" was cut to "effortles".
export const SETTINGS_TITLE = `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="28" viewBox="0 0 92 28"><defs><radialGradient id="c" cx="1" cy="1" r=".75" gradientTransform="matrix(.7 0 0 2.3 .3 -1.3)"><stop offset=".35" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient><radialGradient id="s" cx=".9" cy=".85" r=".55" gradientTransform="matrix(.7 0 0 2.3 .27 -1.1)"><stop offset=".4" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient><mask id="mc"><rect width="92" height="28" fill="url(#c)"/></mask><mask id="ms"><rect width="92" height="28" fill="url(#s)"/></mask><filter id="g" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="moved"/><feGaussianBlur in="moved" stdDeviation="0.35" result="soft"/><feComponentTransfer in="noise" result="dots"><feFuncA type="discrete" tableValues="0 1 1 1 1"/></feComponentTransfer><feComposite in="soft" in2="dots" operator="in"/></filter></defs><g font-size="21" font-weight="600" letter-spacing="-.5"><text x="1" y="20" textLength="89" lengthAdjust="spacingAndGlyphs" fill="#ffffff" mask="url(#mc)">effortless</text><g mask="url(#ms)"><text x="1" y="20" textLength="89" lengthAdjust="spacingAndGlyphs" fill="#ffffff" filter="url(#g)">effortless</text></g></g></svg>`
/** The mark as the settings bar shows it: big, tilted and faint, cut off by the bar. */
export const SETTINGS_MARK = MARK_SVG.replace('<g mask=', '<g opacity=".2" transform="rotate(9 50 50)" mask=')
// The dashboard's mark (see dash-mark): its size, and its look with Auto off.
export const DASH_MARK_SIZE = 18
export const DASH_MARK_OFF = MARK_SVG.replace('<g mask=', '<g opacity=".35" mask=')
/** Whether the band of `kind` is still in its entrance: true for INTRO_MS after it replaced another band. */
/** An animated Svg drawn `elapsedMs` into its animations. Every redraw rebuilds the band and starts its images' CSS
 * animations over; with this, a redraw mid-animation picks it up where it was instead of jumping back. */
export function inPhase(svg: string, elapsedMs: number): string {
  return svg.replace('</svg>', `<style>svg *{animation-delay:${(-Math.max(0, elapsedMs) / 1000).toFixed(3)}s !important}</style></svg>`)
}
/** The settings panel's top bar: a shade above the band. */
export let DASH_HEAD = '#18181b'
export const DASH_TEXT = '#d4d4d8'
/** The dashboard's quieter figures: the cache countdown while it has time left. */
export const DASH_DIM = '#8b8b93'
// A settings card under the pointer: a shade up from the band, its edge a shade up from that.
export let CARD_HOVER = '#1c1c20'
export let CARD_HOVER_EDGE = '#3b3b42'
export const DONE_SVG = BRAND_SVG
  .replace(/#7c6cf0/g, '#2fae62').replace(/#8f7ff0/g, '#3cc472').replace(/#b3a6ff/g, '#7fe0a4')
  .replace(/#c9bdff/g, '#b4f0c8').replace(/#9a86ff/g, '#4fd486')
  .replace('</g></svg>', '<path d="M323 15.5 L330 22 L345 7.5" fill="none" stroke="#0c3a20" stroke-opacity=".8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>')
export const DONE_ACCENT = '#7fe0a4'
export const DONE_BG = '#0f1c15'
export const DONE_EDGE = '#2f7a4c'
// The mark in the done green, for the titles of cards that have landed.
export const DONE_MARK_SVG = MARK_SVG.replace(/#7566d8/g, '#2f9a5e').replace(/#a79cf7/g, '#7fe0a4').replace(/#cfc7ff/g, '#c8f4d8')

/** The Enter mark as Claude's prompt box draws it: a return arrow, down the right side and back left. */
export function enterSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5V7.2A1.8 1.8 0 0 1 9.7 9H2.8"/><path d="M5.3 6.4 2.7 9l2.6 2.6"/></g></svg>`
}
export const GO_CELLS = 12
export const GO_W = Math.round(GO_CELLS * 7.9)
export function goPillSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GO_W}" height="20" viewBox="0 0 ${GO_W} 20"><rect width="${GO_W}" height="20" rx="5" fill="#ffffff"/></svg>`
}

/** A small ring filled to `percent`, for the context in the swamp band. */
export function ringSvg(percent: number, color: string): string {
  const p = Math.max(0, Math.min(100, percent))
  const c = 2 * Math.PI * 6
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="2.2"/><circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 8 8)"/></svg>`
}

/** The dashboard's settings icon: an outlined cog of eight teeth, drawn rather than a glyph, since the gear character
 * is a different shape in every font. */
export function settingsSvg(color: string): string {
  const step = (2 * Math.PI) / 8
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = i * step
    const at = (f: number, r: number) => `${(7 + r * Math.cos(a + f * step)).toFixed(2)},${(7 + r * Math.sin(a + f * step)).toFixed(2)}`
    pts.push(at(-0.42, 4.6), at(-0.27, 4.6), at(-0.2, 6.1), at(0.2, 6.1), at(0.27, 4.6), at(0.42, 4.6))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round" shape-rendering="geometricPrecision"><path d="M${pts.join('L')}Z"/><circle cx="7" cy="7" r="2"/></g></svg>`
}

/** The settings rows' icons, drawn in the cog's outline style (14 px, 1.3 stroke) rather than font glyphs, which
 * differ per font. */
export function rowIconSvg(kind: 'effort' | 'judge' | 'handoff' | 'show' | 'quick' | 'full', color: string, onKnobToo = false): string {
  const shapes = {
    // A gauge: an open arc with a needle.
    effort: '<path d="M2.6 10.4A5 5 0 1 1 11.4 10.4"/><path d="M7 8.2L9.6 5.2"/><circle cx="7" cy="8.6" r=".9"/>',
    // Scales: a beam on a post, two pans.
    judge: '<path d="M7 2.4V11.6M4.4 11.6H9.6M2.6 4.2H11.4"/><path d="M2.6 4.2L1.2 7.6A1.5 1.5 0 0 0 4 7.6Z"/><path d="M11.4 4.2L10 7.6A1.5 1.5 0 0 0 12.8 7.6Z"/>',
    // An arrow into a bar: hand off.
    handoff: '<path d="M1.8 7H9.4M6.6 4.2L9.4 7L6.6 9.8"/><path d="M11.8 2.6V11.4"/>',
    // A pencil: customize. The tip down left, a line across the ferrule.
    show: '<path d="M9.6 2.1 11.9 4.4 4.9 11.4 2.1 11.9 2.6 9.1Z"/><path d="M8.1 3.6 10.4 5.9"/>',
    // Quick and Full are drawn solid below: an outline at 14 px was too thin to read.
    quick: '',
    full: '',
  }[kind]
  if (kind === 'quick' || kind === 'full') {
    const solid = kind === 'quick'
      // A bolt: the quick handoff, done in seconds.
      ? 'M8.6 1 2.8 8.2H6.6L5.4 13 11.2 5.8H7.4Z'
      // A pen: the full handoff, written out by your skill.
      : 'M10.2 1.5 12.5 3.8 5.3 11 2.3 11.7 3 8.7ZM9 2.7 11.3 5'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path${onKnobToo ? ' data-keep="1"' : ''} d="${solid}" fill="${color}" stroke="${color}" stroke-width="0.6" stroke-linejoin="round"/></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${shapes}</g></svg>`
}

/** A band's entrance: a soft violet wash that fades and a light sweep passing left to right, once, as the band
 * appears. The app has no transitions for a band (its tree is swapped at once), but a plain Svg's CSS animation starts
 * when the image is first drawn and is not restarted by a redraw with the same source. Stretched to the band
 * (preserveAspectRatio none: the app scales a Svg down to its box's width but keeps its height), behind the content. */
export const INTRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="240" viewBox="0 0 1600 240" preserveAspectRatio="none"><style>.w{opacity:0;animation:w .7s ease-out}.s{opacity:0;animation:s 1.1s cubic-bezier(.2,.7,.2,1)}@keyframes w{from{opacity:.16}to{opacity:0}}@keyframes s{from{transform:translateX(-520px);opacity:1}80%{opacity:1}to{transform:translateX(1700px);opacity:0}}</style><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#b9a7ff" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect class="w" width="1600" height="240" fill="#8b6cff"/><rect class="s" width="480" height="240" fill="url(#g)"/></svg>`

/** The dashboard's two lines: the effort with the cache and the context, then the judge's reason and the last reply. */
export function dashboardLines(d: {
  auto: boolean
  paused: boolean
  judging: boolean
  effort: Effort | undefined
  cacheNow: number | null
  contextPercent: number | null
  reason: string
  last: { cost: number; ms: number } | null
  /** The person picked this level by hand: it runs whether Auto is on or off. */
  manual?: boolean
  /** The judge was unsure, so the level in force was kept from the last prompt. */
  kept?: boolean
}): { head: string; what: string; rest: string; detail: string } {
  const level = d.effort ? EFFORT_LABELS[d.effort] : 'Auto'
  // Auto on or off is the button's to say (and the terminal's effort row's), not the text's. A kept level says so in
  // the word: otherwise it reads as a verdict that never came.
  const what = d.judging
    ? 'Deciding…'
    : d.manual && d.effort
      ? `${level} · manual`
      : !d.auto
        ? 'Off'
        : d.kept
          ? `${level} · kept`
          : d.paused
            ? `${level} · Auto paused`
            : level
  const head = [
    `✦ ${what}`,
    d.cacheNow === null ? null : `cache ${cacheLabel(d.cacheNow)}`,
    d.contextPercent === null ? null : `${Math.round(d.contextPercent)}% context`,
  ]
  const last = d.last ? `last reply ≈${tokens(Math.round(d.last.cost))} tokens · ${Math.max(1, Math.round(d.last.ms / 1000))}s` : null
  const shown = head.filter(Boolean) as string[]
  return {
    head: shown.join(' · '),
    what,
    rest: shown.slice(1).map(part => ` · ${part}`).join(''),
    detail: [d.reason, last].filter(Boolean).join(' · '),
  }
}

/** How long the effort word glows after it changes: held at full colour, then faded out; and the step of the fade. */
const FLASH_HOLD_MS = 1000
export const FLASH_MS = 1800
/** The fade's steps, [ms, share of the way to white]: five, so it reads as a fade without a tick. Each step is a redraw,
 * and every redraw rebuilds the band (images restart, buttons under a pointer are swapped), so keep them few. */
export const FLASH_STEPS: readonly (readonly [number, number])[] = [[1000, 0.15], [1160, 0.35], [1320, 0.55], [1480, 0.75], [1640, 0.9]]
/** The glow: a stronger violet than the accent, so a switch is seen at a glance. */
let FLASH_COLOR = '#9b7bff'
/** The effort word's colour `ms` after it changed: the glow, held, then easing out to the band's white. */
export function flashColor(ms: number | null): string {
  if (ms === null || ms >= FLASH_MS) return DASH_TEXT
  if (ms < FLASH_HOLD_MS) return FLASH_COLOR
  const k = [...FLASH_STEPS].reverse().find(([at]) => ms >= at)?.[1] ?? 0
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(ch(FLASH_COLOR, i) + (ch(DASH_TEXT, i) - ch(FLASH_COLOR, i)) * k).toString(16).padStart(2, '0')).join('')}`
}
/** A bin: the lid and its handle, the can with two ribs. */
export function binSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><g fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 3.8H11.8M5.4 3.8V2.4H8.6V3.8M3.4 3.8L4 12H10L10.6 3.8M5.9 6V9.8M8.1 6V9.8"/></g></svg>`
}
/** Context share from which the dashboard's Handoff button turns white: below it a handoff saves little. */
const HANDOFF_LOUD_AT = 30
/** Handoff's box: it fades in, grey, up to HANDOFF_BOX_AT, then lightens to white by HANDOFF_LOUD_AT, where the glow
 * takes over (it grows to 80%). A glow only ever sits around the white box. */
export const HANDOFF_BOX_AT = 15
export const HANDOFF_PILL_W = 66
export const HANDOFF_PILL_H = 19
/** Handoff's look at `percent` of context, a step each percent: no box at 0, the grey box by HANDOFF_BOX_AT, white by
 * HANDOFF_LOUD_AT. The label goes from dim to white, and dark once the box is light enough to need it. */
export function handoffLook(percent: number, hovered = false): { fill: string; opacity: number; edge: string; label: string } {
  // Hovered, the box is there even on a fresh chat and a few steps lighter.
  const p = Math.max(hovered ? HANDOFF_BOX_AT : 0, Math.min(HANDOFF_LOUD_AT, Math.round(percent) + (hovered ? 5 : 0)))
  const mix = (a: string, b: string, k: number) => {
    const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
    return `#${[0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0')).join('')}`
  }
  if (p <= HANDOFF_BOX_AT) {
    const k = p / HANDOFF_BOX_AT
    return { fill: HOVER_BOX, opacity: k, edge: mix(DASH_BG, '#3a3a40', k), label: mix(DASH_DIM, '#ececf0', k) }
  }
  const k = (p - HANDOFF_BOX_AT) / (HANDOFF_LOUD_AT - HANDOFF_BOX_AT)
  return { fill: mix(HOVER_BOX, '#ececf0', k), opacity: 1, edge: mix('#3a3a40', '#ffffff', k), label: k > 0.45 ? '#141416' : '#ececf0' }
}
/** Handoff's box as drawn (see handoffLook). */
export function handoffPillSvg(percent: number, hovered = false): string {
  const l = handoffLook(percent, hovered)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HANDOFF_PILL_W}" height="${HANDOFF_PILL_H}" viewBox="0 0 ${HANDOFF_PILL_W} ${HANDOFF_PILL_H}"><rect x=".5" y=".5" width="${HANDOFF_PILL_W - 1}" height="${HANDOFF_PILL_H - 1}" rx="6" fill="${l.fill}" fill-opacity="${l.opacity.toFixed(3)}" stroke="${l.edge}" stroke-opacity="${l.opacity.toFixed(3)}"/></svg>`
}
/** How hard the glow behind Handoff pulls: 0 below HANDOFF_LOUD_AT, then 1 to 5, one step per 10% of context. */
export function handoffGlowStep(percent: number): number {
  return percent < HANDOFF_LOUD_AT ? 0 : Math.min(5, 1 + Math.floor((percent - HANDOFF_LOUD_AT) / 10))
}
/** The glow behind the Handoff button, one design per step, drawn on a screenshot of the real bar: a tight violet rim
 * just past the button (about 121 by 32 px there), wider, softer and brighter each step, pulsing between a low and a
 * peak. Centred on the button by the layer the dashboard puts it in. */
const GLOW_LEVELS: ReadonlyArray<{ spread: number; blur: number; peak: number; low: number; period: number }> = [
  { spread: 0, blur: 0, peak: 0, low: 0, period: 0 },
  { spread: 1.5, blur: 1.2, peak: 0.55, low: 0.2, period: 3.4 },
  { spread: 2, blur: 1.5, peak: 0.65, low: 0.25, period: 2.8 },
  { spread: 2.5, blur: 1.8, peak: 0.75, low: 0.3, period: 2.3 },
  { spread: 3, blur: 2.1, peak: 0.85, low: 0.35, period: 1.9 },
  { spread: 3.5, blur: 2.4, peak: 0.95, low: 0.4, period: 1.5 },
]
/** The glow's drawing in CSS px, measured on a faithful render of the desktop band (tools/render-band): the primary
 * Handoff button is 77 by 20 with a 6 px radius, and the band leaves 8 px above and below it. The drawing is no wider
 * than the layer it sits in, so the app never scales it (a Svg is at most as wide as its box). */
export const GLOW_W = HANDOFF_PILL_W + 16
export const GLOW_H = HANDOFF_PILL_H + 16
const GLOW_BUTTON = { w: HANDOFF_PILL_W, h: HANDOFF_PILL_H, r: 6 }
export function handoffGlowSvg(step: number, nowMs = 0): string {
  const { spread: e, blur, peak, low, period } = GLOW_LEVELS[step]
  // The pulse's place from the clock, so a redraw does not restart it from the low point.
  const lock = (svg: string) => inPhase(svg, nowMs % (period * 1000))
  const x = (GLOW_W - GLOW_BUTTON.w) / 2 - e
  const y = (GLOW_H - GLOW_BUTTON.h) / 2 - e
  return lock(`<svg xmlns="http://www.w3.org/2000/svg" width="${GLOW_W}" height="${GLOW_H}" viewBox="0 0 ${GLOW_W} ${GLOW_H}"><style>.g{animation:p ${period}s ease-in-out infinite}@keyframes p{0%,100%{opacity:${low}}50%{opacity:${peak}}}</style><defs><filter id="b" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g class="g" filter="url(#b)"><rect x="${x}" y="${y}" width="${GLOW_BUTTON.w + 2 * e}" height="${GLOW_BUTTON.h + 2 * e}" rx="${GLOW_BUTTON.r + e}" fill="${ACCENT}"/></g></svg>`)
}

/** How long the switch's knob takes to slide after a click. */
const AUTO_SLIDE_MS = 260
/** Auto as a switch: a pill with its knob right and violet when on, left and grey when off. `slide` draws the move from
 * the other side, for the redraw right after a click only (every redraw replays an image's animation). */
export function autoSwitchSvg(on: boolean, slideMs: number | null = null): string {
  const slide = slideMs !== null && slideMs < AUTO_SLIDE_MS
  const t = `${AUTO_SLIDE_MS / 1000}s cubic-bezier(.3,.7,.2,1)`
  const css = slide
    ? `<style>.k{animation:k ${t}}.p{animation:p ${t}}@keyframes k{from{transform:translateX(${on ? -11 : 11}px);fill:${on ? '#8b8b93' : '#ffffff'}}}@keyframes p{from{fill:${on ? '#2c2c31' : ACCENT};stroke:${on ? '#4a4a52' : ACCENT}}}</style>`
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15" viewBox="0 0 26 15">${css}<rect class="p" x=".5" y=".5" width="25" height="14" rx="7" fill="${on ? ACCENT : '#2c2c31'}" stroke="${on ? ACCENT : '#4a4a52'}"/><circle class="k" data-keep="1" cx="${on ? 18.5 : 7.5}" cy="7.5" r="5" fill="${on ? '#ffffff' : '#8b8b93'}"/></svg>`
  return slide ? inPhase(svg, slideMs) : svg
}
/** How long the bar's edges glow after Auto is switched on. */
export const AUTO_GLOW_MS = 2600
export const AUTO_GLOW_W = 1100
export const AUTO_GLOW_H = 37
/** The image starts inside the band's side borders but over its top and bottom ones (the layer's top and bottom are the
 * band's outer edge, its sides the inner), so the line is inset 0.75 px at the sides and 1.75 px at top and bottom: 1 px
 * inside the border all round.
 * The glow inside the bar's edges as Auto comes on: a violet light that rises along the rim, holds, and fades once. Drawn
 * for AUTO_GLOW_MS only (every redraw would replay it). Stretched across the band's width (preserveAspectRatio none: the
 * app scales a Svg to its box's width and keeps its height); drawn at about the band's real width so the sides stay
 * as thick as the top and bottom. Clipped to the bar's inside, so the light falls inward. */
/** The cold band's rim: the Auto glow's light in ice, breathing slowly for as long as the band shows, so a cold chat
 * looks alive rather than parked. Placed by the clock (inPhase), so a redraw picks up where the breath was. */
export const COLD_GLOW_MS = 4200

/** The rim in the brand's violet while the judge decides: it lights up and stays at full while it thinks, then fades from
 * full once the verdict is in. Two images, each placed by the clock on every draw (inPhase): the app swaps the whole
 * band on every redraw and a new image starts its animation over, so nothing here may depend on an image surviving.
 * The rise ends at full and holds there (forwards); the fade starts at full. The fade waits for the rise to finish, so
 * a quick verdict never fades from half-way. */
export const JUDGE_RISE_MS = 500
export const JUDGE_FADE_MS = 450
const JUDGE_GLOW_MAX = 0.85
/** CSS's ease-in-out, cubic-bezier(.42,0,.58,1): the progress at time t (0 to 1), by bisection on the curve's x. */
export function easeInOut(t: number): number {
  const at = (a: number, b: number, u: number) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u
  let lo = 0, hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (at(0.42, 0.58, mid) < t) lo = mid
    else hi = mid
  }
  return at(0, 1, (lo + hi) / 2)
}
/** The rim's brightness `elapsedMs` into its rise or fade, read off the same curve the browser draws. */
export function judgeBrightnessAt(kind: 'rise' | 'fade', elapsedMs: number): number {
  const p = Math.min(1, Math.max(0, elapsedMs / (kind === 'rise' ? JUDGE_RISE_MS : JUDGE_FADE_MS)))
  return kind === 'rise' ? JUDGE_GLOW_MAX * easeInOut(p) : JUDGE_GLOW_MAX * (1 - easeInOut(p))
}
/** The rim as one short piece: from its brightness now to its brightness JUDGE_STEP_MS later, in a straight line, then held.
 * The app draws old copies of the band again at moments the mod does not see (measured on a screen recording: a copy
 * from 130 ms into a fade came back 570 ms in, and the fade started over from full). A long animation replayed from a
 * stale copy jumps far; a piece this short is wrong for at most one step, and the schedule draws the next one. The rim
 * at full is a still image with no animation, so a replay changes nothing. */
export const JUDGE_STEP_MS = 50
/** How far each piece runs: longer than the gap between the app's redraws (measured 100 to 120 ms, however often the mod
 * asks), so a piece never ends and stands still before the next one is drawn. A piece of 50 ms did, in visible steps. */
export const JUDGE_PIECE_MS = 150
export function judgeGlowSvg(kind: 'rise' | 'fade', elapsedMs = 0): string {
  const W = AUTO_GLOW_W, H = AUTO_GLOW_H
  const dur = kind === 'rise' ? JUDGE_RISE_MS : JUDGE_FADE_MS
  const from = judgeBrightnessAt(kind, elapsedMs)
  // Five points along the true curve, so the piece is where the curve is at every moment and the next one starts on it.
  const span = Math.max(1, Math.min(JUDGE_PIECE_MS, dur - elapsedMs))
  const points = [0, 0.25, 0.5, 0.75, 1].map(k => `${(k * 100).toFixed(0)}%{opacity:${judgeBrightnessAt(kind, elapsedMs + k * span).toFixed(3)}}`).join('')
  const still = kind === 'rise' && elapsedMs >= dur
  const css = still
    ? `.r{opacity:${JUDGE_GLOW_MAX}}`
    : `.r{opacity:${from.toFixed(3)};animation:r ${(span / 1000).toFixed(3)}s linear forwards}@keyframes r{${points}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>${css}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ACCENT}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#b9a7ff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
/** What the glow is at `now`: nothing, rising or holding, or fading. `endedAt` is null while the judge decides. */
export function judgeGlowAt(startedAt: number, endedAt: number | null, now: number): string | null {
  if (now < startedAt) return null
  const fadeFrom = endedAt === null ? Infinity : Math.max(endedAt, startedAt + JUDGE_RISE_MS)
  if (now < fadeFrom) return judgeGlowSvg('rise', now - startedAt)
  if (now < fadeFrom + JUDGE_FADE_MS) return judgeGlowSvg('fade', now - fadeFrom)
  return null
}

export function coldGlowSvg(): string {
  const W = AUTO_GLOW_W, H = AUTO_GLOW_H
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:.15;animation:r ${COLD_GLOW_MS / 1000}s ease-in-out infinite}@keyframes r{0%,100%{opacity:.15}50%{opacity:.6}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter></defs><g class="r"><rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="none" stroke="${ICE}" stroke-width="4" opacity=".16" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="#cfeeff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
export function autoGlowSvg(on: boolean): string {
  const W = AUTO_GLOW_W, H = AUTO_GLOW_H
  const rim = `x="0" y="0" width="${W}" height="${H}" rx="8"`
  const [wash, line, strength] = on ? [ACCENT, '#b9a7ff', 0.9] : ['#8b8b93', '#c8c8d0', 0.6]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><style>.r{opacity:0;animation:r ${AUTO_GLOW_MS / 1000}s ease-in-out}@keyframes r{0%{opacity:0}15%{opacity:${strength}}45%{opacity:${(strength * 0.85).toFixed(2)}}100%{opacity:0}}</style><defs><filter id="b" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="1.5"/></filter><filter id="s" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation=".8"/></filter></defs><g class="r"><rect ${rim} fill="none" stroke="${wash}" stroke-width="4" opacity=".14" filter="url(#b)"/><rect x=".75" y="1.75" width="${W - 1.5}" height="${H - 3.5}" rx="8.25" fill="none" stroke="${line}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g></svg>`
}
