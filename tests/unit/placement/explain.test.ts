import { describe, expect, it } from 'vitest'

import { COMPANION_ID_OFFSET } from '@/lib/characters/unitIds'
import { presetLayout } from '@/lib/maps'
import { PlacementBoard } from '@/lib/placement/board'
import { explainPlacement } from '@/lib/placement/explain'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { PlacementData } from '@/lib/placement/types'

const ORION = 120
const SYLPHIRA = 116
const PERSEUS = 92
const DIONEL = 13
const SENEA = 128
const RAVION = 90
const PHRAESTO = 50
const ILLUSION = PHRAESTO + COMPANION_ID_OFFSET

// arena2's ally tiles by diagonal row, back to front: 1 2 | 3 4 5 | 6 7 | 8 10 | 13.
// By the walk to the enemy round its walls, back to front: 3 8 | 1 6 | 2 4 5 | 7 10 | 13.
const MAP = presetLayout('arena2')!

const DATA: PlacementData = {
  lists: { damage: [ORION, SYLPHIRA, DIONEL] },
  leans: { front: [], back: [] },
  weights: { aim: 10, buff: 3, lean: 0.2, margin: 1 },
  pickRates: {},
}

// The placement explained against its own score, as a side placed by hand is.
function explained(at: Record<number, number>, data = DATA) {
  const team = {
    heroes: Object.keys(at)
      .map(Number)
      .filter((unit) => unit < COMPANION_ID_OFFSET),
  }
  const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
  const positions = board.units.map((unit) => at[unit]!)
  const why = explainPlacement(team, MAP, data, PLACEMENT_LOOKUPS, { positions })
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
    expect(of(PERSEUS)).toEqual({
      unit: PERSEUS,
      tile: 6,
      reasons: [],
      alsoFine: [5, 8, 10],
      better: [],
    })
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

  // Senea's rule asks for the back half. Tile 6 is in it, walking round the
  // walls, with Dionel behind her on 1; on tile 3 nobody stands behind her.
  it('says a unit stands in the back half, unless it says it stands at the back', () => {
    const data = { ...DATA, leans: { front: [], back: [SENEA] } }
    const half = explained({ [SENEA]: 6, [DIONEL]: 1, [ORION]: 4, [PERSEUS]: 13 }, data)
    expect(half(SENEA).reasons).toEqual([{ verb: 'stands', place: 'back-half' }])
    const back = explained({ [SENEA]: 3, [DIONEL]: 4, [ORION]: 5, [PERSEUS]: 13 }, data)
    expect(back(SENEA).reasons).toEqual([{ verb: 'stands', place: 'back' }])
  })

  // On the same board, Sylphira moved behind Orion or Perseus moved up past her
  // takes the Objectives off Perseus, who is not on the damage list. The tiles
  // only as good as where each stands are not the engine's pick, so not shown.
  it('points a unit to the tiles the engine would pick it, better ones over ones as good', () => {
    const of = explained({ [RAVION]: 13, [ORION]: 3, [PERSEUS]: 4, [SYLPHIRA]: 6, [SENEA]: 7 })
    expect(of(SYLPHIRA)).toMatchObject({ alsoFine: [], better: [1, 2] })
    expect(of(PERSEUS)).toMatchObject({ alsoFine: [], better: [8, 10] })
  })

  // Perseus on tile 6 is as good on 5, 8 and 10 (the first test). Leaning to the
  // back, he is pointed only to 8, which the walls keep the furthest walk from
  // the enemy.
  it('points a leaning unit only to the tiles toward its side, measured round the walls', () => {
    const of = explained(
      { [RAVION]: 13, [ORION]: 3, [SYLPHIRA]: 4, [PERSEUS]: 6, [SENEA]: 7 },
      { ...DATA, leans: { front: [], back: [PERSEUS] } },
    )
    expect(of(PERSEUS)).toMatchObject({ alsoFine: [8], better: [] })
  })

  // Tile 6 is a row in front of tile 4 but farther from the enemy round the
  // walls, and tile 5 as near the enemy as tile 2 but a row behind tile 6.
  it("words a lean only for a hero on the team's front row and as near the enemy as any", () => {
    const data = { ...DATA, leans: { front: [ORION], back: [] } }
    const orionWhy = (orion: number, perseus: number) =>
      explained({ [ORION]: orion, [PERSEUS]: perseus, [DIONEL]: 1, [SENEA]: 2 }, data)(ORION)
        .reasons
    expect(orionWhy(7, 4)).toEqual([{ verb: 'stands', place: 'front' }])
    expect(orionWhy(4, 7)).toEqual([])
    expect(orionWhy(6, 4)).toEqual([])
    expect(orionWhy(5, 6)).toEqual([])
  })

  // Tile 2 is the tile directly behind tile 7, where the Illusion stands.
  it("words an effect a unit's other body gives under the unit's name and -companion", () => {
    const data = { ...DATA, lists: { ...DATA.lists, support: [PERSEUS] } }
    const of = explained(
      { [PHRAESTO]: 13, [ILLUSION]: 7, [PERSEUS]: 2, [ORION]: 1, [DIONEL]: 3 },
      data,
    )
    const contract = { source: 'unit', file: 'phraesto-companion', giver: PHRAESTO }
    expect(of(PERSEUS).reasons).toContainEqual({ verb: 'receives', effect: contract, to: [] })
    expect(of(ILLUSION).reasons).toContainEqual({ verb: 'gives', effect: contract, to: [PERSEUS] })
  })
})
