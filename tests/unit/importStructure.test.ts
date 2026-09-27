import { describe, expect, it } from 'vitest'

import {
  artifactStructure,
  phantimalStructure,
  type FeedArtifact,
  type FeedPhantimal,
} from '../../scripts/lib/structure'

const artifact = (slug: string, fairyId: number, extra: Partial<FeedArtifact> = {}) => ({
  slug,
  set: 'season',
  name: `${slug} Spell`,
  fairyId,
  seasonType: 108,
  statBonuses: [
    { stat: 'ATK', value: 18.7 },
    { stat: 'HEAL', value: 14 },
  ],
  ...extra,
})

const phantimal = (slug: string, campSlot: number, extra: Partial<FeedPhantimal> = {}) => ({
  slug,
  faction: 'Mauler',
  campSlot,
  isMelee: false,
  seasonType: 108,
  ...extra,
})

describe('artifactStructure', () => {
  const en = {
    b: artifact('b', 8002),
    a: artifact('a', 8001),
    old: artifact('old', 1, { set: 'pre-season' }),
  }
  const zh = { a: { ...en.a, name: '甲' }, b: { ...en.b, name: '乙' } }

  it('numbers the season after the permanent six, by fairy id', () => {
    const out = artifactStructure(en, zh, {})
    expect(out.problems).toEqual([])
    expect(out.data).toEqual({
      a: { id: 7, name: 'a', season: 8, stats: { atk: 18.7, vitality: 14 } },
      b: { id: 8, name: 'b', season: 8, stats: { atk: 18.7, vitality: 14 } },
    })
    expect(out.names.a).toEqual({ en: 'a', zh: '甲' })
  })

  it('refuses to renumber within a season, but not across seasons', () => {
    const renumbered = artifactStructure(en, zh, { a: { id: 9, name: 'a', season: 8 } })
    expect(renumbered.problems[0]).toContain('decide by hand')
    const lastSeason = artifactStructure(en, zh, { a: { id: 9, name: 'a', season: 7 } })
    expect(lastSeason.problems).toEqual([])
  })

  it('reports an unmapped stat code and a feed without fairy ids', () => {
    const odd = { a: artifact('a', 8001, { statBonuses: [{ stat: 'NEW', value: 1 }] }) }
    expect(artifactStructure(odd, zh, {}).problems[0]).toContain('"NEW"')
    const old = { a: artifact('a', 8001, { fairyId: undefined }) }
    expect(artifactStructure(old, zh, {}).problems[0]).toContain('rebuild')
  })
})

describe('phantimalStructure', () => {
  it('derives id, range and faction, with both factions for camp 5', () => {
    const out = phantimalStructure(
      {
        m: phantimal('m', 2, { isMelee: true, faction: 'Wilder' }),
        w: phantimal('w', 5, { faction: 'Celestial' }),
      },
      {},
    )
    expect(out.data).toEqual({
      m: { id: 2, name: 'm', season: 8, range: 1, faction: 'wilder' },
      w: {
        id: 5,
        name: 'w',
        season: 8,
        range: 20,
        faction: 'celestial',
        qualifyingFactions: ['hypogean', 'celestial'],
      },
    })
  })

  it('keeps curated fields and an existing qualifyingFactions', () => {
    const out = phantimalStructure(
      { p: phantimal('p', 3) },
      { p: { id: 3, name: 'p', season: 8, targeting: true, qualifyingFactions: ['mauler'] } },
    )
    expect(out.data.p).toEqual({
      id: 3,
      name: 'p',
      season: 8,
      range: 20,
      faction: 'mauler',
      qualifyingFactions: ['mauler'],
      targeting: true,
    })
    expect(Object.keys(out.data.p!)).toEqual([
      'id',
      'name',
      'season',
      'range',
      'faction',
      'qualifyingFactions',
      'targeting',
    ])
  })
})
