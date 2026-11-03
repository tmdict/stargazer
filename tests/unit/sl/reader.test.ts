import { describe, expect, it } from 'vitest'

import type { Side } from '@/lib/pvp/sl/data/sides'
import { readSlFile } from '@/lib/pvp/sl/model/reader'
import { splitChance } from '@/lib/pvp/sl/model/reasons'
import type { Explanation, ReasonItem } from '@/lib/pvp/sl/model/types'
import { madeUpData, madeUpModel } from '../fixtures/slSeason'

// The worked example of the file's published format, every value worked out
// by hand there.
const { model, records } = readSlFile(
  madeUpData(
    [],
    madeUpModel({
      gap: 0.001,
      emptySlot: -1.5,
      typicalHeroes: 0.4,
      typicalArtifact: 0.02,
      fieldAgainst: { 0: 0.03 },
      heroes: {
        1: [0.2, 30, 21, 0.01],
        2: [0.1, 25, 25, 0.01],
        3: [-0.1, 18, 22, 0.01],
        4: [0.05, 12, 11, 0.01],
        5: [0.05, 9, 9, 0.01],
        6: [0.3, 40, 20, -0.02],
        7: [0.1, 15, 14, 0],
        8: [-0.2, 10, 19, 0],
        9: [0.1, 12, 10, 0],
      },
      lineups: { '1/2/3/4/5': [0.15, 9, 4] },
      counters: { '1:1': [0.1, 14, 9], '6:0': [-0.05, 8, 10] },
      artifacts: { 3: [0.06, 20, 15] },
      artifactsOnKind: { '3:0': [0.02, 11, 8] },
    }),
    [],
  ),
)

const line = (
  side: 'a' | 'b',
  subject: ReasonItem['subject'],
  id: number | null,
  value: number,
): ReasonItem => ({ side, subject, id, value: expect.closeTo(value, 12) })

const parts = (values: Explanation['parts']): Explanation['parts'] =>
  Object.fromEntries(
    Object.entries(values).map(([reason, value]) => [reason, expect.closeTo(value, 12)]),
  ) as Explanation['parts']

describe('the model the file carries', () => {
  const a: Side = { heroes: [1, 2, 3, 4, 5], kind: 0, artifact: 3 }
  const b: Side = { heroes: [6, 7, 8, 9], kind: 1, artifact: null }

  it('finds each row’s record under the format’s keys', () => {
    expect(records.hero(1)).toEqual({ wins: 30, losses: 21 })
    expect(records.lineup([5, 4, 3, 2, 1])).toEqual({ wins: 9, losses: 4 })
    expect(records.heroAgainst(1, 1)).toEqual({ wins: 14, losses: 9 })
    expect(records.artifactOn(3, 0)).toEqual({ wins: 11, losses: 8 })
    expect(records.artifact(99)).toEqual({ wins: 0, losses: 0 })
  })

  it('adds up a match-up as the format’s worked example does', () => {
    const answer = model.explain({ a, b, gap: 20 })
    expect(answer.parts).toEqual(
      parts({ heroes: 1.65, counters: 0.15, artifacts: 0.06, upgrades: 0.02 }),
    )
    expect(splitChance(answer.parts).shown).toBe(868)
    expect(answer.items).toEqual({
      heroes: [
        line('a', 'hero', 1, 0.2),
        line('a', 'hero', 2, 0.1),
        line('a', 'hero', 3, -0.1),
        line('a', 'hero', 4, 0.05),
        line('a', 'hero', 5, 0.05),
        line('a', 'lineup', null, 0.15),
        line('b', 'hero', 6, 0.3),
        line('b', 'hero', 7, 0.1),
        line('b', 'hero', 8, -0.2),
        line('b', 'hero', 9, 0.1),
        line('b', 'empty', null, -1.5),
      ],
      counters: [
        line('a', 'hero', 1, 0.1),
        line('a', 'hero', 2, 0),
        line('a', 'hero', 3, 0),
        line('a', 'hero', 4, 0),
        line('a', 'hero', 5, 0),
        line('b', 'hero', 6, -0.05),
        line('b', 'hero', 7, 0),
        line('b', 'hero', 8, 0),
        line('b', 'hero', 9, 0),
      ],
      artifacts: [line('a', 'artifact', 3, 0.06)],
    })
    expect(model.againstTypical(a, -10)).toBeCloseTo(0.12, 12)
  })

  it('counts a hero or an artifact with no row as 0, and a team outside every group meets no counter', () => {
    const c: Side = { heroes: [1, 2, 6, 7, 10], kind: null, artifact: 99 }
    const d: Side = { heroes: [3, 4, 5, 8, 9], kind: 0, artifact: 3 }
    const answer = model.explain({ a: c, b: d, gap: 0 })
    expect(answer.parts).toEqual(
      parts({ heroes: 0.8, counters: -0.05, artifacts: -0.06, upgrades: 0 }),
    )
    expect(splitChance(answer.parts).shown).toBe(666)
    expect(answer.items).toEqual({
      heroes: [
        line('a', 'hero', 1, 0.2),
        line('a', 'hero', 2, 0.1),
        line('a', 'hero', 6, 0.3),
        line('a', 'hero', 7, 0.1),
        line('a', 'hero', 10, 0),
        line('b', 'hero', 3, -0.1),
        line('b', 'hero', 4, 0.05),
        line('b', 'hero', 5, 0.05),
        line('b', 'hero', 8, -0.2),
        line('b', 'hero', 9, 0.1),
      ],
      counters: [
        line('a', 'hero', 1, 0),
        line('a', 'hero', 2, 0),
        line('a', 'hero', 6, -0.05),
        line('a', 'hero', 7, 0),
        line('a', 'hero', 10, 0),
      ],
      artifacts: [line('a', 'artifact', 99, 0), line('b', 'artifact', 3, 0.06)],
    })
    expect(model.againstTypical(c, 0)).toBeCloseTo(0.3, 12)
  })
})
