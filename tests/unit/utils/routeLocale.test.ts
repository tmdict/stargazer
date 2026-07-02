import { describe, expect, it } from 'vitest'

import { splitLocalePath } from '@/utils/routeLocale'

// Pins the load-bearing invariant: the regex is the APP-locale classifier, so
// skill-text prefixes (/ko, /zh-tw, ...) must parse as unprefixed. Widening it
// would silently break the chrome store sync and the header toggle rule.
describe('splitLocalePath', () => {
  it('splits app-locale prefixes', () => {
    expect(splitLocalePath('/en/skill/walker')).toEqual({ locale: 'en', rest: '/skill/walker' })
    expect(splitLocalePath('/zh/guide')).toEqual({ locale: 'zh', rest: '/guide' })
    expect(splitLocalePath('/en')).toEqual({ locale: 'en', rest: '' })
  })

  it('treats skill-text prefixes as unprefixed', () => {
    expect(splitLocalePath('/ko/skill/walker')).toEqual({
      locale: null,
      rest: '/ko/skill/walker',
    })
    expect(splitLocalePath('/zh-tw/skill/walker')).toEqual({
      locale: null,
      rest: '/zh-tw/skill/walker',
    })
  })

  it('does not partial-match prefixes', () => {
    expect(splitLocalePath('/english/skill/x')).toEqual({ locale: null, rest: '/english/skill/x' })
    expect(splitLocalePath('/skills')).toEqual({ locale: null, rest: '/skills' })
    expect(splitLocalePath('/')).toEqual({ locale: null, rest: '/' })
  })
})
