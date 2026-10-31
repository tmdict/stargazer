// Charm data integrity: the generated charm files and locale files must
// stay mutually consistent, and every referenced hero must exist in the
// hero list. Guards the data export's charm outputs the UI consumes without
// runtime checks.
import { beforeAll, describe, expect, it } from 'vitest'

import { pinnedLevels } from '@/lib/tags'
import { APP_LOCALES } from '@/lib/types/i18n'
import type { CharmData } from '@/lib/types/skill'
import { getSkillCharms, loadAppLocales, loadCharacters, loadSkillLocale } from '@/utils/dataLoader'

// A season between charm feeds has no charm file.
const charmFiles = import.meta.glob<CharmData>('@/data/seasonal/charm/*.json', {
  eager: true,
  import: 'default',
})

describe('charm data', () => {
  const charms = Object.entries(charmFiles)

  beforeAll(async () => {
    await Promise.all(APP_LOCALES.map((lang) => loadSkillLocale(lang)))
  })

  // A season can ship before its charm text, so no charm file is legitimate
  // (the export retires charms with their season); charm files without text, or
  // text without charm files, is a half-written export.
  it('is either fully present or fully retired', () => {
    for (const lang of APP_LOCALES) {
      expect(getSkillCharms(lang) !== null, `${lang} _charms.json vs the charm files`).toBe(
        charms.length > 0,
      )
    }
  })

  it.runIf(charms.length > 0)(
    'names each file by its id, with known heroes, each hero on at most one charm',
    () => {
      const heroNames = new Set(loadCharacters().map((c) => c.name))
      const seen = new Set<string>()
      for (const [path, charm] of charms) {
        expect(path.endsWith(`/${charm.id}.json`), `${path} holds ${charm.id}`).toBe(true)
        for (const hero of charm.heroes) {
          expect(heroNames.has(hero), `${charm.id}: ${hero} not in the hero list`).toBe(true)
          expect(seen.has(hero), `${hero} appears on two charms`).toBe(false)
          seen.add(hero)
        }
      }
    },
  )
})

describe('charm tags', () => {
  const tagged = Object.values(charmFiles).filter((charm) => charm.tags)

  it.runIf(tagged.length > 0)('have labelled tags and real tiers', () => {
    const labels = loadAppLocales()
    for (const { id, tags } of tagged) {
      for (const [tag, { tiers }] of Object.entries(tags!)) {
        expect(labels[tag], `${tag} has no app locale label`).toBeDefined()
        for (const tier of tiers) expect([1, 2, 3, 4], `${id} ${tag}`).toContain(tier)
      }
    }
  })

  it.runIf(tagged.length > 0)(
    'joins every sharing hero, pinned to the charm tiers with the modifiers',
    () => {
      const characters = new Map(loadCharacters().map((c) => [c.name, c]))
      for (const { heroes, tags } of tagged) {
        for (const hero of heroes) {
          const character = characters.get(hero)!
          for (const [tag, { tiers, mods = [] }] of Object.entries(tags!)) {
            const pinned = pinnedLevels(character.tags, [{ tag, mods }], 'charm')
            expect(pinned, `${hero} ${tag}`).toEqual([...tiers].sort((a, b) => a - b))
          }
        }
      }
    },
  )
})
