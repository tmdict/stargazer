import { describe, expect, it } from 'vitest'

import { getSkillKeywords, loadSkillLocales } from '@/utils/dataLoader'

// The `_keywords` glossary ships in the same dirs and chunks as the hero
// files; these pin that it never reaches the hero dicts (where the search
// index would surface it as a phantom hero).
describe('skill locale loading', () => {
  it('keeps reserved underscore entries out of the hero dicts', () => {
    const dicts = loadSkillLocales()
    for (const lang of ['en', 'zh'] as const) {
      const slugs = Object.keys(dicts[lang])
      expect(slugs.length).toBeGreaterThan(0)
      expect(slugs.filter((s) => s.startsWith('_'))).toEqual([])
    }
  })

  it('serves the keyword glossary from its own store', () => {
    for (const lang of ['en', 'zh'] as const) {
      const glossary = getSkillKeywords(lang)
      expect(glossary).toBeTruthy()
      expect(Object.keys(glossary!).length).toBeGreaterThan(0)
    }
  })
})
