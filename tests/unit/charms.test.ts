// Charm data integrity: the data pack's list of each hero's charms, its charm
// text and the charm files written by hand must stay mutually consistent, and
// every listed hero must exist in the hero list. Guards what the UI consumes
// without runtime checks.
import { beforeAll, describe, expect, it } from 'vitest'

import { loadCharacters, loadCharms, loadHeroCharms } from '@/lib/dataLoader'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { pinnedLevels } from '@/lib/tags'
import { APP_LOCALES, SKILL_LOCALE_CODES } from '@/lib/types/i18n'
import type { CharmFile } from '@/lib/types/skill'
import { loadCharmTypeImages } from '@/utils/imageLoader'
import { loadAppLocales } from '@/utils/localeLoader'
import { getSkillCharms, getSkillLanguage, loadSkillLocale } from '@/utils/skillLocale'

const charmFiles = import.meta.glob<CharmFile>('@/data/seasonal/charm/*.json', {
  eager: true,
  import: 'default',
})

describe('charm data', () => {
  const charms = loadCharms()

  beforeAll(async () => {
    await Promise.all(APP_LOCALES.map((lang) => loadSkillLocale(lang)))
  })

  // A season can ship before its charm text, so no charms is legitimate (a
  // pack update retires them with their season); a hero list without text, or
  // The tab heads the charms with the current season, which only their ids
  // can confirm.
  it('belongs to the current season', () => {
    const prefix = `s${CURRENT_SEASON}-`
    expect(charms.map(({ id }) => id).filter((id) => !id.startsWith(prefix))).toEqual([])
  })

  // text without a hero list, is a half-applied pack update.
  it('is either fully present or fully retired', () => {
    for (const lang of APP_LOCALES) {
      expect(getSkillCharms(lang) !== null, `${lang} _charms.json vs the hero list`).toBe(
        charms.length > 0,
      )
    }
  })

  it('lists only known heroes', () => {
    const heroNames = new Set(loadCharacters().map((c) => c.name))
    for (const { id, heroes } of charms) {
      for (const hero of heroes) {
        expect(heroNames.has(hero), `${id}: ${hero} not in the hero list`).toBe(true)
      }
    }
  })

  // Charm ids change with the season, so a file left from the last one names
  // a charm the pack no longer lists and its tags and rules reach no hero.
  it('names each file by its id, a charm the pack lists, with tags or rules', () => {
    const listed = new Set(charms.map((charm) => charm.id))
    for (const [path, file] of Object.entries(charmFiles)) {
      expect(path.endsWith(`/${file.id}.json`), `${path} holds ${file.id}`).toBe(true)
      expect(listed.has(file.id), `${file.id} is not a charm of the pack's hero list`).toBe(true)
      expect(file.tags ?? file.rules, `${file.id} has neither tags nor rules`).toBeDefined()
    }
  })
})

describe('charm types', () => {
  beforeAll(async () => {
    await Promise.all(APP_LOCALES.map((lang) => loadSkillLocale(lang)))
  })

  it('give every hero types the type text names, with a picture, and a recommended one of them', () => {
    const pictures = loadCharmTypeImages()
    const types = getSkillLanguage('en')!.charmTypes
    for (const [hero, { types: own = [], recommended }] of Object.entries(loadHeroCharms())) {
      for (const type of own) {
        expect(types[type], `${hero}: ${type} has no text`).toBeDefined()
        expect(pictures[type], `${type} has no picture`).toBeDefined()
      }
      expect(recommended ? own : [undefined], `${hero}'s recommended type`).toContain(recommended)
    }
  })

  it('name the same types in every skill language', async () => {
    await Promise.all(SKILL_LOCALE_CODES.map((lang) => loadSkillLocale(lang)))
    const english = Object.keys(getSkillLanguage('en')!.charmTypes)
    for (const lang of SKILL_LOCALE_CODES) {
      expect({ lang, types: Object.keys(getSkillLanguage(lang)!.charmTypes) }).toEqual({
        lang,
        types: english,
      })
    }
  })
})

describe('charm tags', () => {
  const tagged = loadCharms().filter((charm) => charm.tags)

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
