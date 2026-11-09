import { describe, expect, it } from 'vitest'

import { slFit } from '@/lib/pvp/generator/fit'
import type { SlBoard } from '@/lib/pvp/generator/setType'
import { mergeFits, parseStoredFits } from '@/lib/pvp/generator/storedFits'
import { madeUpData, madeUpLayout, madeUpModel } from '../fixtures/slSeason'

const lineups = (count: number): Record<string, number> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), i]))

describe('kept fits', () => {
  it('moves a map that gains points last and drops the oldest maps whole past the cap', () => {
    const stored = { a: { '1': 1, '2': 2 }, b: { '1': 3 }, c: { '1': 4, '2': 5 } }
    expect(Object.entries(mergeFits(stored, { a: { '3': 6 } }))).toEqual([
      ['b', { '1': 3 }],
      ['c', { '1': 4, '2': 5 }],
      ['a', { '1': 1, '2': 2, '3': 6 }],
    ])
    const big = { a: lineups(1500), b: lineups(500) }
    expect(Object.keys(mergeFits(big, { c: lineups(1) }))).toEqual(['b', 'c'])
    expect(Object.keys(mergeFits(big, { d: lineups(2500) }))).toEqual(['d'])
  })

  it('reads back only the shape it writes', () => {
    const fits = {
      build: 'sl.worker-B7x2kQ9a.js',
      maps: { arena4: { '68,74,94,116,121': 16.125 } },
    }
    expect(parseStoredFits(JSON.stringify(fits))).toEqual(fits)
    for (const text of [
      '{"build":"x","maps":[]}',
      '{"build":"x","maps":{"arena4":{"1":"2"}}}',
      '{"maps":{}}',
      '{"build":',
    ])
      expect(parseStoredFits(text)).toBeNull()
  })

  // The points a press gains seed a later visit's store, which then works out
  // the same fit without a check, and lends the home map's points to a check on
  // another board.
  it('knows the fits a store is seeded with', () => {
    const data = madeUpData(
      [{ map: 0, family: 0, heroes: [1, 2, 3, 4, 5], artifacts: [], decided: 1 }],
      madeUpModel({}),
      [],
    )
    const heroes = [1, 2, 3, 4, 5]
    const on = (key: string): SlBoard => ({ layout: madeUpLayout(key), map: 0, source: null })
    const first = slFit(data)
    const [job] = first.jobs([{ board: on('new'), heroes }])
    const gained = first.record(job!, { home: 8, board: 6 })
    expect(gained).toEqual({ 'map-0': { '1,2,3,4,5': 8 }, new: { '1,2,3,4,5': 6 } })
    expect(first.record(job!, { home: 8, board: 6 })).toEqual({})

    const later = slFit(data)
    later.seed(gained)
    expect(later.known(on('new'), heroes)).toBe(0.75)
    expect(later.jobs([{ board: on('new'), heroes }])).toEqual([])
    expect(later.jobs([{ board: on('other'), heroes }])[0]!.home).toBe(8)
  })
})
