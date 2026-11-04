import { describe, expect, it } from 'vitest'

import { presetLayout } from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { explainPlacement } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { PlacementScorer } from '@/lib/placement/score'
import type { PlacementData } from '@/lib/placement/types'

const ORION = 120
const SYLPHIRA = 116
const PERSEUS = 92
const DIONEL = 13
const SENEA = 128
const RAVION = 90
const GUNNAR = 106
const GWYNETH = 115

// arena2's ally tiles by diagonal row, back to front: 1 2 | 3 4 5 | 6 7 | 8 10 | 13.
const MAP = presetLayout('arena2')!

const DATA: PlacementData = {
  lists: { damage: [ORION, SYLPHIRA, DIONEL], gunnar: [GWYNETH] },
  leans: { front: [], back: [] },
  formationRules: [],
  weights: { aim: 10, buff: 3, lean: 0.2, margin: 1 },
  pickRates: {},
}

// The placement explained as the best there is.
function explained(at: Record<number, number>, data = DATA) {
  const team = { heroes: Object.keys(at).map(Number) }
  const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(board, team, data)
  const positions = board.units.map((unit) => at[unit]!)
  board.place(positions)
  const why = explainPlacement(team, MAP, data, PLACEMENT_LOOKUPS, {
    positions,
    best: scorer.score(),
  })
  return (unit: number) => why.units.find((entry) => entry.unit === unit)!
}

describe('placement explanation', () => {
  // Ravion's Objectives go to the two rearmost allies, tiles 3 and 4 here.
  it('names what a unit gives and receives, and the tiles as good for one with no reason', () => {
    const of = explained({ [RAVION]: 13, [ORION]: 3, [SYLPHIRA]: 4, [PERSEUS]: 6, [SENEA]: 7 })
    const objectives = { source: 'unit', file: 'ravion', giver: RAVION }
    expect(of(RAVION).reasons).toEqual([
      { verb: 'gives', effect: objectives, to: [ORION, SYLPHIRA] },
    ])
    expect(of(ORION).reasons).toEqual([{ verb: 'receives', effect: objectives, to: [] }])
    // Tiles 1 and 2 would make Perseus one of the two rearmost.
    expect(of(PERSEUS)).toEqual({ unit: PERSEUS, tile: 6, reasons: [], alsoFine: [5, 8, 10] })
  })

  it('names every ally a targeted effect lands on, and only a listed one receives it', () => {
    const of = explained({ [RAVION]: 13, [ORION]: 3, [PERSEUS]: 4, [SYLPHIRA]: 6, [SENEA]: 7 })
    const objectives = { source: 'unit', file: 'ravion', giver: RAVION }
    expect(of(RAVION).reasons).toEqual([
      { verb: 'gives', effect: objectives, to: [ORION, PERSEUS] },
    ])
    expect(of(ORION).reasons).toEqual([{ verb: 'receives', effect: objectives, to: [] }])
    expect(of(PERSEUS).reasons).toEqual([])
  })

  it("words a formation rule from each hero's side, and a lean only without a rank", () => {
    const of = explained(
      { [GUNNAR]: 7, [GWYNETH]: 2, [ORION]: 6, [PERSEUS]: 3, [DIONEL]: 4 },
      {
        ...DATA,
        formationRules: [
          { heroes: [GUNNAR, GWYNETH], relation: 'behind', holds: 'always' },
          { heroes: [GWYNETH], relation: 'rearmost', holds: 'usually' },
        ],
        leans: { front: [ORION], back: [GWYNETH] },
      },
    )
    const doomfield = { source: 'unit', file: 'gunnar', giver: GUNNAR }
    expect(of(GUNNAR).reasons).toEqual([
      { verb: 'gives', effect: doomfield, to: [GWYNETH] },
      { verb: 'stands', place: 'right-in-front-of', hero: GWYNETH },
    ])
    expect(of(GWYNETH).reasons).toEqual([
      { verb: 'receives', effect: doomfield, to: [] },
      { verb: 'stands', place: 'right-behind', hero: GUNNAR },
      { verb: 'stands', place: 'rearmost' },
    ])
    expect(of(ORION).reasons).toEqual([{ verb: 'stands', place: 'front' }])
  })
})
