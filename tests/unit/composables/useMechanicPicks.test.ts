import { describe, expect, it } from 'vitest'

import { useMechanicPicks } from '@/composables/useMechanicPicks'
import { tagVocabulary } from '@/lib/tags'

describe('useMechanicPicks', () => {
  it('returns a tag to how it was when its last modifier goes off', () => {
    const vocabulary = tagVocabulary([
      { tags: { 'temp-buff': [{ ultimate: 1 }, { skill3: 1, mods: ['opening'] }] } },
    ])
    const { picks, toggleTag, toggleModifier } = useMechanicPicks(vocabulary)

    toggleModifier('temp-buff', 'opening')
    expect(picks.value).toEqual([{ tag: 'temp-buff', mods: ['opening'] }])
    toggleModifier('temp-buff', 'opening')
    expect(picks.value).toEqual([])

    toggleTag('temp-buff')
    toggleModifier('temp-buff', 'opening')
    toggleModifier('temp-buff', 'opening')
    expect(picks.value).toEqual([{ tag: 'temp-buff', mods: [] }])
  })
})
