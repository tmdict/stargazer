import { describe, expect, it } from 'vitest'

import skillHeroes from '@/data/skill/heroes.json'
import { loadSkillLocale } from '@/utils/dataLoader'

// Pages are pre-rendered from the locale dirs while `hasSkillLocale` answers
// from the importer's hero list, so the two must name the same heroes. The
// `_keywords` glossary ships in the same dirs and chunks and must stay out of
// the hero dicts, where the search index would surface it as a phantom hero.
describe('skill locale loading', () => {
  it('holds exactly the heroes the importer listed, no reserved underscore entries', async () => {
    expect(Object.keys(await loadSkillLocale('en')).sort()).toEqual(skillHeroes)
  })
})
