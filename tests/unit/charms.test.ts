// Charm data integrity: the generated structural map and locale files must
// stay mutually consistent, and every referenced hero must exist in the
// hero list. Guards the import-charms outputs the UI consumes without runtime
// checks.
import { beforeAll, describe, expect, it } from 'vitest'

import { pinnedLevels } from '@/lib/tags'
import { APP_LOCALES } from '@/lib/types/i18n'
import {
  getSkillCharms,
  loadAppLocales,
  loadCharacters,
  loadCharms,
  loadCharmTags,
  loadSkillLocale,
} from '@/utils/dataLoader'

describe('charm data', () => {
  const charms = loadCharms()
  const slugs = Object.keys(charms)

  beforeAll(async () => {
    await Promise.all(APP_LOCALES.map((lang) => loadSkillLocale(lang)))
  })

  // A season can ship before its charm feed, so an empty map is legitimate
  // (import:charms --retire); a structural map without text, or text without
  // a map, is a half-written import.
  it('is either fully present or fully retired', () => {
    for (const lang of APP_LOCALES) {
      expect(getSkillCharms(lang) !== null, `${lang} _charms.json vs charms.json`).toBe(
        slugs.length > 0,
      )
    }
  })

  it.runIf(slugs.length > 0)('references only known heroes, each hero on at most one charm', () => {
    const heroNames = new Set(loadCharacters().map((c) => c.name))
    const seen = new Set<string>()
    for (const slug of slugs) {
      for (const hero of charms[slug]!.heroes) {
        expect(heroNames.has(hero), `${slug}: ${hero} not in the hero list`).toBe(true)
        expect(seen.has(hero), `${hero} appears on two charms`).toBe(false)
        seen.add(hero)
      }
    }
  })
})

describe('charm tags', () => {
  const charmTags = loadCharmTags()
  const tagged = Object.entries(charmTags)

  // import:charms checks the slugs at import time; this catches an edit made
  // between imports.
  it.runIf(tagged.length > 0)('tags only current charms, with labelled tags and real tiers', () => {
    const charms = loadCharms()
    const labels = loadAppLocales()
    for (const [slug, tags] of tagged) {
      expect(charms[slug], `${slug} is not a current charm`).toBeDefined()
      for (const [tag, tiers] of Object.entries(tags)) {
        expect(labels[tag], `${tag} has no app locale label`).toBeDefined()
        for (const tier of tiers) expect([1, 2, 3, 4], `${slug} ${tag}`).toContain(tier)
      }
    }
  })

  it.runIf(tagged.length > 0)('joins every sharing hero, pinned to the charm tiers', () => {
    const characters = new Map(loadCharacters().map((c) => [c.name, c]))
    const charms = loadCharms()
    for (const [slug, tags] of tagged) {
      for (const hero of charms[slug]!.heroes) {
        const character = characters.get(hero)!
        for (const [tag, tiers] of Object.entries(tags)) {
          const pinned = pinnedLevels(character.tags, [{ tag, mods: [] }], 'charm')
          expect(pinned, `${hero} ${tag}`).toEqual([...tiers].sort((a, b) => a - b))
        }
      }
    }
  })
})
