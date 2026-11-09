import { describe, expect, it } from 'vitest'

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
    fit.record(job!, { home: 8, board: 6 })
    expect(fit.known(on(0), heroes)).toBe(0.75)
  })
})
