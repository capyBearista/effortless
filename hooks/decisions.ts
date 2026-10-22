// Fork: decision models (Jev and others like it) tried in order before Haiku. They all take the same body as Jev on
// TypeSafe ({ model, state, questions }) and answer the same way, so only the address, the model id and the key differ.

export const ZEN_URL = 'https://opencode.ai/zen/v1/systemone'
export const OPENROUTER_URL = 'https://openrouter.ai/api/alpha/decisions'
/** More than this many routes could not all be tried inside one prompt's budget anyway. */
export const MAX_ROUTES = 8

/** One decision model to ask: where, with which wire model id, and which key it needs (Zen's free models need none). */
export type DecisionRoute = {
  /** As the person wrote it, e.g. "openrouter/typesafe/jev-1.13". */
  id: string
  provider: 'zen' | 'openrouter' | 'typesafe'
  /** The model id the endpoint expects: "jev-1.13-free" on Zen, "typesafe/jev-1.13" on OpenRouter. */
  model: string
}

/**
 * The decisionModels setting as routes, in order. Comma- or newline-separated:
 * opencode/<model> (OpenCode Zen), openrouter/<publisher>/<model> (OpenRouter), typesafe/<model> (TypeSafe direct).
 * Anything else, repeats and entries past MAX_ROUTES are dropped.
 */
export function parseDecisionModels(raw: string): DecisionRoute[] {
  const routes: DecisionRoute[] = []
  for (const id of raw.split(/[,\n]/).map(part => part.trim())) {
    if (routes.length >= MAX_ROUTES) break
    if (!id || routes.some(r => r.id === id)) continue
    const route = routeOf(id)
    if (route) routes.push(route)
  }
  return routes
}

function routeOf(id: string): DecisionRoute | undefined {
  const slash = id.indexOf('/')
  if (slash < 1) return undefined
  const prefix = id.slice(0, slash)
  const model = id.slice(slash + 1)
  if (/\s/.test(model)) return undefined
  if (prefix === 'opencode' && /^[^/]+$/.test(model)) return { id, provider: 'zen', model }
  if (prefix === 'openrouter' && /^[^/]+\/[^/]+$/.test(model)) return { id, provider: 'openrouter', model }
  if ((prefix === 'typesafe' || prefix === 'typesafe-ai') && /^[^/]+$/.test(model)) return { id, provider: 'typesafe', model }
  return undefined
}

/** The models the settings offer to add, each with the short name it goes by there. Any other id can be typed in. */
export const DECISION_PRESETS: readonly { id: string }[] = [
  { id: 'opencode/jev-1.13-free' },
  { id: 'openrouter/inception/mercury-decide:free' },
  { id: 'openrouter/microsoft/microsoft-decision-1' },
  { id: 'openrouter/typesafe/jev-1.13' },
  { id: 'typesafe/jev-latest' },
]

/** The name the settings show: the model's own id, as its provider knows it (the provider shows as its logo). */
export function routeLabel(route: DecisionRoute): string {
  return route.model
}

/** Routes back as the setting's text. */
export function chainIds(routes: readonly DecisionRoute[]): string {
  return routes.map(r => r.id).join(', ')
}

/** The setting with one more model at the end, if it is a model id and not there yet. */
export function withRoute(raw: string, id: string): string {
  return chainIds(parseDecisionModels(`${raw},${id.trim()}`))
}

/** The setting without that model. */
export function withoutRoute(raw: string, id: string): string {
  return chainIds(parseDecisionModels(raw).filter(r => r.id !== id))
}

/** The setting with that model one place earlier: tried before the one it passes. */
export function movedEarlier(raw: string, id: string): string {
  const routes = parseDecisionModels(raw)
  const at = routes.findIndex(r => r.id === id)
  if (at > 0) [routes[at - 1], routes[at]] = [routes[at], routes[at - 1]]
  return chainIds(routes)
}

/** The name a route goes by in a toast or a test line. */
export function routeName(route: DecisionRoute): string {
  if (route.provider === 'zen') return `Zen ${route.model}`
  if (route.provider === 'openrouter') return `OpenRouter ${route.model}`
  return `Jev ${route.model}`
}

/**
 * How long the next route may take: its own timeout, cut to what is left of the whole chain's budget. Nothing when the
 * budget is spent (less than a quarter second left is not worth a request).
 */
export function hopTimeout(startMs: number, nowMs: number, timeoutMs: number, budgetMs: number): number | undefined {
  const left = budgetMs - (nowMs - startMs)
  return left < 250 ? undefined : Math.min(timeoutMs, left)
}
