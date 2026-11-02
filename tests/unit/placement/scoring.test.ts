import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { PlacementBoard } from '@/lib/placement/board'
import { placeTeam } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { PlacementScorer } from '@/lib/placement/score'
import type { PlacementData, PlacementTeam } from '@/lib/placement/types'

const ALNA = 100
const SYLPHIRA = 116
const ORION = 120
const PERSEUS = 92
const DIONEL = 13
const SENEA = 128
const RAVION = 90
const TAICHI = 123
const GUNNAR = 106
const GWYNETH = 115
const ALICETH = 91
const TWINS = 68
const ROLAN = 121
const LILY_MAY = 54
const MEHIRA = 94
const PHRAESTO = 50
const WEDGE_OF_MATTER = toPhantimalId(5)

// arena2's ally tiles by diagonal row, back to front: 1 2 | 3 4 5 | 6 7 | 8 10 | 13.
const MAP = 'arena2'

const DATA: PlacementData = {
  lists: {
    alna: [SYLPHIRA],
    damage: [ORION, SYLPHIRA, DIONEL],
    'temp-buff': [ORION, PERSEUS, DIONEL],
    taichi: [{ list: 'temp-buff' }, { list: 'damage' }],
    gunnar: [GWYNETH],
    tank: [ALNA],
    melee: [ALNA],
  },
  leans: { front: [], back: [] },
  formationRules: [],
  weights: { aim: 10, 'aliceth-mark': 6, buff: 3, lean: 0.2, margin: 1 },
  pickRates: {},
}

function scoredAt(at: Record<number, number>, data = DATA): PlacementScorer {
  const team = { heroes: Object.keys(at).map(Number) }
  const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
  const scorer = new PlacementScorer(board, team, data)
  board.place(board.units.map((unit) => at[unit]!))
  return scorer
}
const metOf = (scorer: PlacementScorer, owner: number) =>
  scorer.goals().find((goal) => goal.owner === owner)!.met

describe('placement scoring', () => {
  // Alna gives her Winter Warrior to the nearest ally on her row, tiles 3 and 5 for tile 4.
  it('meets a target goal when the effect lands on the first listed hero of the team', () => {
    const on = { [ALNA]: 4, [SYLPHIRA]: 5, [ORION]: 1, [PERSEUS]: 2, [DIONEL]: 6 }
    expect(metOf(scoredAt(on), ALNA)).toBe(1)
    const off = { [ALNA]: 4, [ORION]: 5, [SYLPHIRA]: 7, [PERSEUS]: 2, [DIONEL]: 6 }
    expect(metOf(scoredAt(off), ALNA)).toBe(0)
  })

  it('falls back on the damage list when the team has none of the rule list', () => {
    const data = { ...DATA, lists: { ...DATA.lists, alna: [SENEA] } }
    const at = { [ALNA]: 4, [ORION]: 5, [SYLPHIRA]: 7, [PERSEUS]: 2, [DIONEL]: 6 }
    expect(metOf(scoredAt(at, data), ALNA)).toBe(1)
  })

  // Ravion's Objectives go to the two rearmost allies, the lowest tile numbers.
  it('scores half for each of the first two listed heroes an effect on two lands on', () => {
    const both = { [RAVION]: 13, [ORION]: 1, [SYLPHIRA]: 2, [DIONEL]: 6, [ALNA]: 7 }
    expect(metOf(scoredAt(both), RAVION)).toBe(1)
    const one = { [RAVION]: 13, [ORION]: 1, [DIONEL]: 2, [SYLPHIRA]: 6, [ALNA]: 7 }
    expect(metOf(scoredAt(one), RAVION)).toBe(0.5)
  })

  // From tile 6, the rows behind Taichi & Agumon hold tiles 1 to 5. His list
  // brings in the temporary-buff list, which names three of the team.
  it('scores a share of the listed heroes on the tiles an effect marks', () => {
    const at = { [TAICHI]: 6, [ORION]: 1, [PERSEUS]: 3, [DIONEL]: 8, [ALNA]: 10 }
    expect(metOf(scoredAt(at), TAICHI)).toBeCloseTo(2 / 3)
  })

  // Tile 2 is the tile directly behind tile 7.
  it('counts an always rule from the formations broken until it holds', () => {
    const data: PlacementData = {
      ...DATA,
      formationRules: [{ heroes: [GUNNAR, GWYNETH], relation: 'behind', holds: 'always' }],
    }
    const held = { [GUNNAR]: 7, [GWYNETH]: 2, [ORION]: 1, [PERSEUS]: 3, [DIONEL]: 4 }
    expect(scoredAt(held, data).score().broken).toBe(0)
    const broken = { [GUNNAR]: 7, [GWYNETH]: 1, [ORION]: 2, [PERSEUS]: 3, [DIONEL]: 4 }
    expect(scoredAt(broken, data).score().broken).toBe(1)
  })

  // An enemy Aliceth marks our unit farthest from her, best a tank: Alna at the
  // back is that unit from some enemy tiles, at the front from none. Her rule
  // scales by her pick rate and leaves the team's own score as it is.
  it('reads an enemy rule from each enemy tile, scaled by how often it is picked', () => {
    const data = { ...DATA, pickRates: { [MAP]: { [ALICETH]: 0.5 } } }
    const back = { [ALNA]: 1, [SYLPHIRA]: 5, [ORION]: 6, [PERSEUS]: 8, [DIONEL]: 13 }
    const scorer = scoredAt(back, data)
    const met = metOf(scorer, ALICETH)!
    expect(met).toBeGreaterThan(0)
    expect(scorer.threats()).toBeCloseTo(6 * 0.5 * met)
    expect(scorer.score()).toEqual(scoredAt(back).score())
    const front = { [ALNA]: 13, [SYLPHIRA]: 5, [ORION]: 6, [PERSEUS]: 8, [DIONEL]: 1 }
    expect(metOf(scoredAt(front, data), ALICETH)).toBe(0)
  })

  // Elijah on tile 1 and Lailah on 10 have tiles 4 and 7 between them. The
  // Wedge of Matter is of Rolan and Sylphira's faction, and Phraesto's shadow
  // of Mehira's, yet each stands where a hero would gain more from the bond.
  it('meets the twins goal with two heroes of one faction between them, and a tenth of it with a phantimal or a companion', () => {
    const twinsMet = (team: PlacementTeam, between: [number, number]) => {
      const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
      const scorer = new PlacementScorer(board, team, DATA)
      const fixed = new Map([
        [TWINS, 1],
        [TWINS + COMPANION_ID_OFFSET, 10],
        [between[0], 4],
        [between[1], 7],
      ])
      const free = board.tiles.filter((tile) => ![...fixed.values()].includes(tile))
      board.place(board.units.map((unit) => fixed.get(unit) ?? free.shift()!))
      return metOf(scorer, TWINS)
    }
    const team = { heroes: [LILY_MAY, TWINS, MEHIRA, SYLPHIRA, ROLAN], phantimal: WEDGE_OF_MATTER }
    expect(twinsMet(team, [SYLPHIRA, ROLAN])).toBe(1)
    expect(twinsMet(team, [ROLAN, WEDGE_OF_MATTER])).toBe(0.1)
    const shadowed = { heroes: [LILY_MAY, TWINS, MEHIRA, PHRAESTO, ROLAN] }
    expect(twinsMet(shadowed, [MEHIRA, PHRAESTO + COMPANION_ID_OFFSET])).toBe(0.1)
  })

  // The Wedge of Matter on tile 1 marks the hero on tile 6, and the Wedge of
  // Power the hero behind it: none from tile 2, the one on tile 2 from tile 4.
  it('scores half for each Wedge whose Spirit Mark lands on one of the first two listed heroes', () => {
    const data = { ...DATA, lists: { ...DATA.lists, melee: [ALNA, SYLPHIRA] } }
    const team = { heroes: [ALNA, SYLPHIRA, ORION, PERSEUS, DIONEL], phantimal: WEDGE_OF_MATTER }
    const wedgesMet = (at: Record<number, number>, power: number) => {
      const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
      const scorer = new PlacementScorer(board, team, data)
      board.place(board.units.map((unit) => at[unit] ?? (unit === WEDGE_OF_MATTER ? 1 : power)))
      return metOf(scorer, WEDGE_OF_MATTER)
    }
    const heroes = { [ALNA]: 6, [ORION]: 3, [PERSEUS]: 5, [DIONEL]: 7 }
    expect(wedgesMet({ ...heroes, [SYLPHIRA]: 2 }, 4)).toBe(1)
    expect(wedgesMet({ ...heroes, [SYLPHIRA]: 4 }, 2)).toBe(0.5)
  })
})

describe('placement search', () => {
  const team = { heroes: [ALNA, SYLPHIRA, TAICHI, ORION, PERSEUS] }
  const data: PlacementData = {
    ...DATA,
    leans: { front: [SYLPHIRA, ORION], back: [] },
    formationRules: [{ heroes: [ALNA, SYLPHIRA], relation: 'nextTo', holds: 'usually' }],
  }

  it('finds the best goals that trying every placement finds, and the same pick twice', () => {
    const searched = placeTeam(team, MAP, data, PLACEMENT_LOOKUPS)
    const full = placeTeam(team, MAP, data, PLACEMENT_LOOKUPS, { full: true })
    expect(searched.best).toEqual(full.best)
    expect(placeTeam(team, MAP, data, PLACEMENT_LOOKUPS).positions).toEqual(searched.positions)
  })
})
