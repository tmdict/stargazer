// Charm data integrity: the generated structural map and locale files must
// stay mutually consistent, and every referenced hero must exist in the
// roster. Guards the import-charms outputs the UI consumes without runtime
// checks.
import { describe, expect, it } from 'vitest'

import {
  getCharmForHero,
  getSkillCharms,
  loadAppLocales,
  loadCharacters,
  loadCharms,
  loadCharmTags,
} from '@/utils/dataLoader'
import { taggedCharmTiers } from '@/utils/guideTags'

describe('charm data', () => {
  const charms = loadCharms()
  const slugs = Object.keys(charms)

  // A season can ship before its charm feed, so an empty map is legitimate
  // (import:charms --retire); a structural map without text, or text without
  // a map, is a half-written import.
  it('is either fully present or fully retired', () => {
    for (const lang of ['en', 'zh'] as const) {
      expect(getSkillCharms(lang) !== null, `${lang} _charms.json vs charms.json`).toBe(
        slugs.length > 0,
      )
    }
  })

  it.runIf(slugs.length > 0)(
    'references only roster heroes, each hero on at most one charm',
    () => {
      const roster = new Set(loadCharacters().map((c) => c.name))
      const seen = new Set<string>()
      for (const slug of slugs) {
        for (const hero of charms[slug]!.heroes) {
          expect(roster.has(hero), `${slug}: ${hero} not in roster`).toBe(true)
          expect(seen.has(hero), `${hero} appears on two charms`).toBe(false)
          seen.add(hero)
        }
      }
    },
  )

  it.runIf(slugs.length > 0)('derives the inverse hero lookup', () => {
    const [slug] = slugs
    const hero = charms[slug!]!.heroes[0]!
    expect(getCharmForHero(hero)).toEqual({ slug, heroes: charms[slug!]!.heroes })
    expect(getCharmForHero('no-such-hero')).toBeNull()
  })

  it.runIf(slugs.length > 0)('has en and zh locale entries with four tiers for every charm', () => {
    for (const lang of ['en', 'zh'] as const) {
      const dict = getSkillCharms(lang)
      expect(dict, `${lang} _charms.json missing`).not.toBeNull()
      expect(dict!.tiers).toHaveLength(4)
      for (const slug of slugs) {
        const tiers = dict!.charms[slug]
        expect(tiers, `[${lang}] ${slug} missing`).toBeDefined()
        expect(tiers).toHaveLength(4)
        for (const t of tiers!) expect(t.trim().length).toBeGreaterThan(0)
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
          expect(taggedCharmTiers(character, tag), `${hero} ${tag}`).toEqual(
            [...tiers].sort((a, b) => a - b),
          )
        }
      }
    }
  })
})
