import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useSkillSearch } from '@/composables/useSkillSearch'
import { loadSkillLocale } from '@/utils/dataLoader'

// Runs over the real locale corpora. pt is loaded explicitly because it holds
// the known cross-language collision: Alsa's pt kit ("rolando", "Pedregulho
// Rolante") text-matches the query "rolan". The query ref is never mutated,
// so the composable's warm-all watcher stays quiet and the test controls
// exactly which locales are warm.
describe('useSkillSearch ranking', () => {
  it('ranks a hero-name match above heroes with text-only hits', async () => {
    await loadSkillLocale('en')
    await loadSkillLocale('pt')

    const results = useSkillSearch(ref('rolan'), ref('en'), ref('en')).value
    expect(results).not.toBeNull()
    expect(results![0]!.slug).toBe('rolan')
    expect(results![0]!.hits[0]!.loc).toBe('name')

    // The collision hero still surfaces, below the name tier.
    expect(results!.some((r) => r.slug === 'alsa')).toBe(true)

    // Whole-list invariant: no text-only result precedes a name-matched one.
    const tiers = results!.map((r) => (r.hits[0]!.loc === 'name' ? 1 : 0))
    expect(tiers).toEqual([...tiers].sort((a, b) => b - a))
  })
})
