import { describe, expect, it } from 'vitest'

import {
  artifactStructure,
  phantimalStructure,
  type FeedArtifact,
  type FeedPhantimal,
} from '../../scripts/lib/structure'

const artifact = (slug: string, id: number, extra: Partial<FeedArtifact> = {}) => ({
  slug,
  set: 'season',
  name: `${slug} Spell`,
  id,
  season: 8,
  statBonuses: [
    { stat: 'atk', value: 18.7 },
    { stat: 'vitality', value: 14 },
  ],
  ...extra,
})

const phantimal = (slug: string, id: number, extra: Partial<FeedPhantimal> = {}) => ({
  slug,
  faction: 'Mauler',
  id,
  factions: ['mauler'],
  damage: 'magic',
  range: 20,
  season: 8,
  ...extra,
})

describe('artifactStructure', () => {
  const en = {
    b: artifact('b', 8),
    a: artifact('a', 7),
    old: artifact('old', 1, { set: 'pre-season', season: 0 }),
  }
  const zh = { a: { ...en.a, name: '甲' }, b: { ...en.b, name: '乙' } }
  const ko = { a: { ...en.a, name: '가' }, b: { ...en.b, name: '나' } }
  const feeds = { en, zh, ko }

  it("writes the season's set with the feed's ids, leaving the permanent artifacts out", () => {
    const out = artifactStructure(feeds, {})
    expect(out.problems).toEqual([])
    expect(out.data).toEqual({
      a: { id: 7, name: 'a', season: 8, stats: { atk: 18.7, vitality: 14 } },
      b: { id: 8, name: 'b', season: 8, stats: { atk: 18.7, vitality: 14 } },
    })
    expect(out.names.a).toEqual({ en: 'a', zh: '甲', ko: '가' })
  })

  it('refuses to renumber within a season, but not across seasons', () => {
    const renumbered = artifactStructure(feeds, { a: { id: 9, name: 'a', season: 8 } })
    expect(renumbered.problems[0]).toContain('decide by hand')
    const lastSeason = artifactStructure(feeds, { a: { id: 9, name: 'a', season: 7 } })
    expect(lastSeason.problems).toEqual([])
  })
})

describe('phantimalStructure', () => {
  it('writes id, range, damage and faction, and both factions for one that counts for two', () => {
    const out = phantimalStructure(
      {
        m: phantimal('m', 2, {
          damage: 'physical',
          range: 1,
          faction: 'Wilder',
          factions: ['wilder'],
        }),
        w: phantimal('w', 5, { faction: 'Celestial', factions: ['hypogean', 'celestial'] }),
      },
      {},
    )
    expect(out.data).toEqual({
      m: { id: 2, name: 'm', season: 8, range: 1, damage: 'physical', faction: 'wilder' },
      w: {
        id: 5,
        name: 'w',
        season: 8,
        range: 20,
        damage: 'magic',
        faction: 'celestial',
        qualifyingFactions: ['hypogean', 'celestial'],
      },
    })
  })

  it('keeps curated fields and an existing qualifyingFactions within a season', () => {
    const out = phantimalStructure(
      { p: phantimal('p', 3) },
      { p: { id: 3, name: 'p', season: 8, targeting: true, qualifyingFactions: ['mauler'] } },
    )
    expect(out.data.p).toEqual({
      id: 3,
      name: 'p',
      season: 8,
      range: 20,
      damage: 'magic',
      faction: 'mauler',
      qualifyingFactions: ['mauler'],
      targeting: true,
    })
    expect(Object.keys(out.data.p!)).toEqual([
      'id',
      'name',
      'season',
      'range',
      'damage',
      'faction',
      'qualifyingFactions',
      'targeting',
    ])
    const returning = phantimalStructure(
      { p: phantimal('p', 3) },
      {
        p: {
          id: 3,
          name: 'p',
          season: 7,
          targeting: true,
          tags: ['debuff'],
          qualifyingFactions: ['mauler'],
        },
      },
    )
    expect(returning.data.p).toEqual({
      id: 3,
      name: 'p',
      season: 8,
      range: 20,
      damage: 'magic',
      faction: 'mauler',
    })
  })
})
