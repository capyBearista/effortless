import { describe, expect, test } from 'claude-code/testing'

import { matchAppColor, matchAppProps, matchAppSvg, setTheme } from '../hooks/theme'

// Fork: Match app. Desktop draws theme keys and an Svg's prefers-color-scheme in its own light or dark; everything the
// mod paints is turned into one of those.
describe('match app (fork)', () => {
  test('text hexes become the theme key of their kind', () => {
    expect(matchAppColor('#d4d4d8', 'text')).toBe('text')
    expect(matchAppColor('#8b8b93', 'text')).toBe('inactive')
    expect(matchAppColor('#a79cf7', 'text')).toBe('merged')
    expect(matchAppColor('#d97757', 'text')).toBe('claude')
    expect(matchAppColor('#e5534b', 'text')).toBe('error')
    expect(matchAppColor('#e0a33a', 'text')).toBe('warning')
    expect(matchAppColor('#7fd49b', 'text')).toBe('success')
    expect(matchAppColor('#7cc4ff', 'text')).toBe('suggestion')
    expect(matchAppColor('#2a2a2f', 'border')).toBe('subtle')
    expect(matchAppColor('#3b3b42', 'hover-border')).toBe('inactive')
    // Pink has no key: a middle lightness that reads on black and white.
    expect(matchAppColor('#ff8fb8', 'text')).toMatch(/^#[0-9a-f]{6}$/)
  })

  test("a painted surface is the app's own; a hover fill and an undefined prop are left out", () => {
    setTheme('violet')
    const out = matchAppProps({ backgroundColor: '#141416', borderColor: '#2a2a2f', color: '#d4d4d8', hover: { backgroundColor: '#2b2b2f', color: '#a79cf7' } })
    expect(out).toEqual({ backgroundColor: 'inverseText', borderColor: 'subtle', color: 'text', hover: { color: 'merged' } })
    expect(matchAppProps({ hover: { backgroundColor: '#00000000' } })).toEqual({ hover: { backgroundColor: '#00000000' } })
  })

  test('a drawing keeps its dark colours and adds its light form in a media query; a data-keep shape keeps its own', () => {
    setTheme('violet')
    const src = '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#d4d4d8}</style><rect fill="#141416"/><circle data-keep="" fill="#ffffff"/></svg>'
    const out = matchAppSvg(src)
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#d4d4d8}</style><rect fill="#141416"/>')).toBe(true)
    expect(out).toContain('@media (prefers-color-scheme: light){')
    expect(out).toContain('[fill="#141416"]:not([data-keep]){fill:#')
    expect(out).toMatch(/\.a\{fill:#(?!d4d4d8)[0-9a-f]{6}\}/)
    expect(out.endsWith('</style></svg>')).toBe(true)
    // Nothing to turn: unchanged.
    expect(matchAppSvg('<svg><path fill="#fff"/></svg>')).toBe('<svg><path fill="#fff"/></svg>')
  })
})
