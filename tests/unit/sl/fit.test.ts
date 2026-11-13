import { describe, expect, it } from 'vitest'

import type { SlFitTable } from '@/lib/pvp/data/types'
import { slFit } from '@/lib/pvp/generator/fit'
import type { SlBoard } from '@/lib/pvp/generator/setType'
import { madeUpData, madeUpLayout, madeUpModel } from '../fixtures/slSeason'

describe('fit', () => {
  // A few games on a map do not show a team's effects work there, so a team
  // recorded on the board's map is measured against its lineup's main map.
  it('measures a team against the map it was played on most, also where it was recorded', () => {
    const data = madeUpData(
      [
        { map: 0, family: 0, heroes: [1, 2, 3, 4, 5], artifacts: [], decided: 2 },
        { map: 1, family: 0, heroes: [5, 4, 3, 2, 1], artifacts: [], decided: 3 },
      ],
      madeUpModel({}),
      [],
    )
    const heroes = [1, 2, 3, 4, 5]
    const on = (map: number): SlBoard => ({ layout: madeUpLayout(`map-${map}`), map, source: map })
    const fit = slFit(data)
    expect(fit.known(on(1), heroes)).toBe(1)
    expect(fit.known(on(0), heroes)).toBeUndefined()
    const [job] = fit.jobs([{ board: on(0), heroes }])
    expect(job!.from).toBe(1)
    fit.record(job!, { home: { points: 8, keeps: true }, board: { points: 6, keeps: true } })
    expect(fit.known(on(0), heroes)).toBe(0.75)
  })

  // Alna's rule is hard, so her lineup is placed on its main map too, and a
  // map where no placement keeps the rule is known for the visit, not kept.
  it('waits on a placement for a lineup with a hard rule, and refuses a map that breaks it', () => {
    const heroes = [100, 2, 3, 4, 5]
    const data = madeUpData(
      [{ map: 0, family: 0, heroes, artifacts: [], decided: 1 }],
      madeUpModel({}),
      [],
    )
    const home: SlBoard = { layout: madeUpLayout('map-0'), map: 0, source: 0 }
    const other: SlBoard = { layout: madeUpLayout('new'), map: 1, source: null }
    const fit = slFit(data)
    expect(fit.known(home, heroes)).toBeUndefined()
    const [atHome] = fit.jobs([{ board: home, heroes }])
    expect(atHome).toEqual({ heroes, from: 0 })
    expect(fit.record(atHome!, { home: { points: 8, keeps: true } })).toEqual({
      'map-0': { [heroes.join()]: 8 },
    })
    expect(fit.known(home, heroes)).toBe(1)

    const [away] = fit.jobs([{ board: other, heroes }])
    expect(fit.record(away!, { board: { points: 6, keeps: false } })).toEqual({})
    expect(fit.known(other, heroes)).toBeNull()
    expect(fit.refused('new')).toEqual([heroes])
    expect(fit.refused('map-0')).toEqual([])
  })

  // The fit table holds the placements a store would make, so a store given
  // one asks for a check only on a map the table lacks, with the main map's
  // points from the table.
  it('answers from the fit table, each set its own, and places only on a map it lacks', () => {
    const heroes = [100, 2, 3, 4, 5]
    const data = madeUpData(
      [{ map: 0, family: 0, heroes, artifacts: [], decided: 1 }],
      madeUpModel({}),
      [],
    )
    const table: SlFitTable = {
      stamp: '',
      maps: ['map-1', 'map-0'],
      seasonal: { points: [[6, 8]], refused: [] },
      plain: { points: [[6, 8]], refused: [[0, 0]] },
    }
    const home: SlBoard = { layout: madeUpLayout('map-0'), map: 0, source: 0 }
    const other: SlBoard = { layout: madeUpLayout('map-1'), map: 1, source: 1 }
    const edited: SlBoard = { layout: madeUpLayout('edited:tiles'), map: 2, source: null }

    const fit = slFit(data, false, table)
    expect(fit.known(home, heroes)).toBe(1)
    expect(fit.known(other, heroes)).toBe(0.75)
    expect(fit.jobs([home, other, edited].map((board) => ({ board, heroes })))).toEqual([
      { heroes, from: 0, home: 8, board: edited.layout },
    ])
    expect(fit.refused('map-1')).toEqual([])

    const plain = slFit(data, true, table)
    expect(plain.known(other, heroes)).toBeNull()
    expect(plain.refused('map-1')).toEqual([heroes])
  })
})
