import { describe, expect, it } from 'vitest'

import { loadSkillLocale } from '@/utils/dataLoader'

// The per-language underscore files ship in the same folders and chunks as the
// hero files and must stay out of the hero dicts, where the search index would
// surface them as phantom heroes.
describe('skill locale loading', () => {
  it('keeps the reserved underscore entries out of the hero dict', async () => {
    const language = await loadSkillLocale('en')
    expect(Object.keys(language.heroes).filter((slug) => slug.startsWith('_'))).toEqual([])
    expect(language.terms).toBeDefined()
  })
})
