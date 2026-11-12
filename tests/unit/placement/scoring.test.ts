import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { presetLayout } from '@/lib/maps'
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
const ALICETH = 91
const TWINS = 68
const ROLAN = 121
const LILY_MAY = 54
const MEHIRA = 94
const PHRAESTO = 50
const LUDOVIC = 53
const EVIE = 113
const REINIER = 31
const WEDGE_OF_MATTER = toPhantimalId(5)
const ILLUSION = PHRAESTO + COMPANION_ID_OFFSET

// arena2's ally tiles by diagonal row, back to front: 1 2 | 3 4 5 | 6 7 | 8 10 | 13.
const MAP = presetLayout('arena2')!

const DATA: PlacementData = {
  lists: {
    alna: [SYLPHIRA],
    damage: [ORION, SYLPHIRA, DIONEL],
    'temp-buff': [ORION, PERSEUS, DIONEL],
    taichi: [{ list: 'temp-buff' }, { list: 'damage' }],
    tank: [ALNA],
    melee: [ALNA],
    save: [ORION],
  },
  leans: { front: [], back: [] },
  weights: { aim: 10, threat: 6, buff: 3, lean: 0.2, margin: 1 },
  pickRates: {},
}

function scoredAt(at: Record<number, number>, data = DATA, map = MAP): PlacementScorer {
  const team = {
    heroes: Object.keys(at)
      .map(Number)
      .filter((unit) => unit < COMPANION_ID_OFFSET),
  }
  const board = new PlacementBoard(team, map, PLACEMENT_LOOKUPS)
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

  // Evie's quill follows the rearmost ally, the lowest tile number. With no
  // fallback, Sylphira on the damage list is not counted in place of the list.
  it('leaves a target goal with no fallback unmet when the team has none of its list', () => {
    const quillMet = (at: Record<number, number>) =>
      scoredAt(at)
        .goals()
        .find(({ owner, rule }) => owner === EVIE && rule.team === 'ally' && rule.goal !== 'most')!
        .met
    expect(quillMet({ [EVIE]: 13, [ORION]: 1, [ALNA]: 3, [SYLPHIRA]: 4, [SENEA]: 6 })).toBe(1)
    expect(quillMet({ [EVIE]: 13, [SYLPHIRA]: 1, [ALNA]: 3, [SENEA]: 4, [ROLAN]: 6 })).toBeNull()
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
    // Below the line every melee hero counts, at 0.9 while Orion above it is
    // on the team, and Dionel, a marksman, not at all.
    const lined = [ORION, { line: true as const }, { every: { range: 'melee' as const } }]
    const data = { ...DATA, lists: { ...DATA.lists, taichi: lined } }
    expect(metOf(scoredAt(at, data), TAICHI)).toBeCloseTo((1 + 0.9) / 3)
  })

  // Ravion's Objectives go to the two rearmost allies, tiles 1 and 2.
  it('fills the places the heroes above a list line leave open with any hero below it', () => {
    const ravionMet = (damage: PlacementData['lists'][string], more = {}) => {
      const data = { ...DATA, lists: { ...DATA.lists, damage, ...more } }
      const at = { [RAVION]: 13, [ORION]: 1, [DIONEL]: 2, [SYLPHIRA]: 6, [ALNA]: 7 }
      return metOf(scoredAt(at, data), RAVION)
    }
    expect(ravionMet([ORION, { line: true }, SYLPHIRA, DIONEL])).toBe(1)
    // A list brought in keeps its line, so the hero below it stays there
    // though the list bringing it in goes on ranking heroes after it.
    const inner = { inner: [ORION, { line: true as const }, DIONEL] }
    expect(ravionMet([{ list: 'inner' }, SYLPHIRA], inner)).toBe(0.5)
  })

  // An enemy Aliceth's arrow lands on our unit farthest from her, where the
  // hero most worth saving should not stand: Orion at the back is that unit
  // from some enemy tiles, at the front from none. Her rule scales by her pick
  // rate and leaves the team's own score as it is.
  it('reads an enemy rule from each enemy tile, scaled by how often it is picked', () => {
    const data = { ...DATA, pickRates: { [MAP.key]: { [ALICETH]: 0.5 } } }
    const back = { [ORION]: 1, [SYLPHIRA]: 5, [ALNA]: 6, [PERSEUS]: 8, [DIONEL]: 13 }
    const scorer = scoredAt(back, data)
    const met = metOf(scorer, ALICETH)!
    expect(met).toBeLessThan(1)
    expect(scorer.threats()).toBeCloseTo(6 * 0.5 * met)
    expect(scorer.score()).toEqual(scoredAt(back).score())
    const front = { [ORION]: 13, [SYLPHIRA]: 5, [ALNA]: 6, [PERSEUS]: 8, [DIONEL]: 1 }
    expect(metOf(scoredAt(front, data), ALICETH)).toBe(1)
    // With nobody above the list's line on the team, nobody is worth guarding.
    const unranked = { ...data, lists: { ...data.lists, save: [{ line: true as const }, ORION] } }
    expect(metOf(scoredAt(back, unranked), ALICETH)).toBeNull()
  })

  // An enemy Reinier takes the unit on the tile mirroring one of his
  // teammates' tiles next to him. On arena2 the mirror of tile 1 is next to
  // three of the ten enemy tiles, and the mirror of tile 13 is no enemy tile.
  it("reads an enemy tile rule from the tiles mirroring the holder's own side around it", () => {
    const data = { ...DATA, pickRates: { [MAP.key]: { [REINIER]: 1 } } }
    const safeAt = (tile: number) =>
      metOf(scoredAt({ [ORION]: tile, [SYLPHIRA]: tile === 1 ? 13 : 1, [ALNA]: 6 }, data), REINIER)
    expect(safeAt(1)).toBeCloseTo(0.7)
    expect(safeAt(13)).toBe(1)
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
  // Each mark has a rule of its own, the Wedge of Matter's first.
  const wedgesMet = (at: Record<number, number>, power: number, leans = DATA.leans) => {
    const data = { ...DATA, lists: { ...DATA.lists, haste: [SYLPHIRA] }, leans }
    const team = { heroes: [ALNA, SYLPHIRA, ORION, PERSEUS, DIONEL], phantimal: WEDGE_OF_MATTER }
    const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
    const scorer = new PlacementScorer(board, team, data)
    board.place(board.units.map((unit) => at[unit] ?? (unit === WEDGE_OF_MATTER ? 1 : power)))
    return scorer
      .goals()
      .filter((goal) => goal.owner === WEDGE_OF_MATTER)
      .map((goal) => goal.met)
  }
  const wedgeHeroes = { [ALNA]: 6, [ORION]: 3, [PERSEUS]: 5, [DIONEL]: 7 }

  it('scores each Wedge by the hero its own Spirit Mark lands on', () => {
    expect(wedgesMet({ ...wedgeHeroes, [SYLPHIRA]: 2 }, 4)).toEqual([1, 1])
    expect(wedgesMet({ ...wedgeHeroes, [SYLPHIRA]: 4 }, 2)).toEqual([1, 0])
    // The marks the other way round: the tank behind the Wedge of Power.
    expect(wedgesMet({ ...wedgeHeroes, [ALNA]: 2, [SYLPHIRA]: 6 }, 4)).toEqual([0, 0])
  })

  // Walking round arena2's walls, tile 6 is in the back half of the ally tiles.
  it('counts a Spirit Mark only on a hero standing on the side it leans to', () => {
    const at = { ...wedgeHeroes, [SYLPHIRA]: 2 }
    expect(wedgesMet(at, 4, { front: [], back: [ALNA] })).toEqual([1, 1])
    expect(wedgesMet(at, 4, { front: [ALNA], back: [] })).toEqual([0, 1])
  })

  // Walking round arena2's walls, tile 6 is in the back half of the ally tiles,
  // tile 4 in the middle and tile 7 in the front half. Senea's skill draws
  // nothing, so a rule needing one would be left out and have no goal here.
  it('meets a back goal with its holder in the back half or the middle', () => {
    const backMet = (tile: number) =>
      metOf(scoredAt({ [SENEA]: tile, [ORION]: 1, [PERSEUS]: 13 }), SENEA)
    expect(backMet(6)).toBe(1)
    expect(backMet(4)).toBe(1)
    expect(backMet(7)).toBe(0)
  })

  // Tile 7 touches tiles 2, 4, 5, 10 and 13, and tile 8 only tiles 3 and 6, so
  // the most allies next to Ludovic is the rest of the team, up to five.
  it('scores the allies next to a unit out of the most that can stand next to it', () => {
    const around = { [LUDOVIC]: 7, [ALNA]: 13, [SYLPHIRA]: 4, [ORION]: 2, [PERSEUS]: 5 }
    expect(metOf(scoredAt(around), LUDOVIC)).toBe(1)
    const corner = { [LUDOVIC]: 8, [ALNA]: 3, [SYLPHIRA]: 6, [ORION]: 1, [PERSEUS]: 2 }
    expect(metOf(scoredAt(corner), LUDOVIC)).toBe(0.5)
    expect(metOf(scoredAt({ [LUDOVIC]: 8, [ALNA]: 3, [SYLPHIRA]: 6 }), LUDOVIC)).toBe(1)
  })

  // Tile 4 is next to tile 6, tile 7 two tiles from it and tile 10 three.
  it('reaches the tiles within a tile rule’s distance, its own left out', () => {
    const reached = (orion: number) =>
      metOf(scoredAt({ [PERSEUS]: 6, [ORION]: orion, [ALNA]: 1 }), PERSEUS)
    expect(reached(4)).toBe(1)
    expect(reached(7)).toBe(1)
    expect(reached(10)).toBe(0)
  })

  // Tiles 3, 4 and 5 make up one row of arena2.
  it("meets a companion goal when the holder's other body stands on the tiles it marks", () => {
    const rowMet = (at: Record<number, number>) =>
      scoredAt(at)
        .goals()
        .find(({ owner, rule }) => owner === PHRAESTO && rule.goal === 'companion')!.met
    const rest = { [PERSEUS]: 1, [ORION]: 2, [DIONEL]: 7 }
    expect(rowMet({ [PHRAESTO]: 3, [ILLUSION]: 5, ...rest })).toBe(1)
    expect(rowMet({ [PHRAESTO]: 3, [ILLUSION]: 6, ...rest })).toBe(0)
  })

  // Tile 2 is the tile directly behind tile 7.
  it("reads a tile rule from the holder's other body when the rule acts from there", () => {
    const data = { ...DATA, lists: { ...DATA.lists, support: [PERSEUS] } }
    const contractMet = (at: Record<number, number>) =>
      scoredAt(at, data)
        .goals()
        .find(({ owner, rule }) => owner === PHRAESTO && rule.from === 'companion')!.met
    const rest = { [PERSEUS]: 2, [ORION]: 1, [DIONEL]: 3 }
    expect(contractMet({ [PHRAESTO]: 13, [ILLUSION]: 7, ...rest })).toBe(1)
    expect(contractMet({ [PHRAESTO]: 7, [ILLUSION]: 13, ...rest })).toBe(0)
  })

  // Tile 2 is the tile directly behind tile 7.
  it('gives a hero the list does not rank first the others share, and a phantimal none', () => {
    const data = { ...DATA, lists: { ...DATA.lists, ultimate: [ORION] } }
    const team = { heroes: [PHRAESTO, ORION, PERSEUS, DIONEL, ALNA], phantimal: WEDGE_OF_MATTER }
    const contractMet = (behind: number) => {
      const board = new PlacementBoard(team, MAP, PLACEMENT_LOOKUPS)
      const scorer = new PlacementScorer(board, team, data)
      const fixed = new Map([
        [PHRAESTO, 7],
        [behind, 2],
      ])
      const free = board.tiles.filter((tile) => ![...fixed.values()].includes(tile))
      board.place(board.units.map((unit) => fixed.get(unit) ?? free.shift()!))
      return scorer
        .goals()
        .find(({ owner, rule }) => owner === PHRAESTO && rule.tile === 'behind' && !rule.from)!.met
    }
    expect(contractMet(ORION)).toBe(1)
    expect(contractMet(PERSEUS)).toBe(0.9)
    expect(contractMet(WEDGE_OF_MATTER)).toBe(0)
  })

  // preset-sr3's tile 14 has no way to the enemy until a wall falls.
  it('takes the walled weight off for each melee hero on a tile with no way to the enemy', () => {
    const sr3 = presetLayout('preset-sr3')!
    const walledOff = (at: Record<number, number>) => {
      const goals = (walled: number) =>
        scoredAt(at, { ...DATA, weights: { ...DATA.weights, walled } }, sr3).score().goals
      return goals(0) - goals(5)
    }
    const rest = { [SENEA]: 2, [ROLAN]: 4, [MEHIRA]: 6 }
    expect(walledOff({ [ALNA]: 14, [DIONEL]: 1, ...rest })).toBeCloseTo(5)
    expect(walledOff({ [DIONEL]: 14, [ALNA]: 1, ...rest })).toBeCloseTo(0)
  })
})

describe('placement search', () => {
  const team = { heroes: [ALNA, SYLPHIRA, TAICHI, ORION, PERSEUS] }
  const data: PlacementData = {
    ...DATA,
    leans: { front: [SYLPHIRA, ORION], back: [] },
  }

  it('finds the best goals that trying every placement finds, and the same pick twice', () => {
    const searched = placeTeam(team, MAP, data, PLACEMENT_LOOKUPS)
    const full = placeTeam(team, MAP, data, PLACEMENT_LOOKUPS, { full: true })
    expect(searched.best).toEqual(full.best)
    expect(placeTeam(team, MAP, data, PLACEMENT_LOOKUPS).positions).toEqual(searched.positions)
  })

  it('keeps held units on their tiles and finds the best tiles for the rest', () => {
    const placed = placeTeam(team, MAP, data, PLACEMENT_LOOKUPS)
    const held = new Map(
      placed.units.flatMap((unit, i): [number, number][] =>
        unit === ORION || unit === PERSEUS ? [] : [[unit, placed.positions[i]!]],
      ),
    )
    const swapped = { heroes: [ALNA, SYLPHIRA, TAICHI, SENEA, DIONEL] }
    const searched = placeTeam(swapped, MAP, data, PLACEMENT_LOOKUPS, { held })
    const full = placeTeam(swapped, MAP, data, PLACEMENT_LOOKUPS, { held, full: true })
    const tiles = new Map(searched.units.map((unit, i) => [unit, searched.positions[i]]))
    for (const [unit, hexId] of held) expect(tiles.get(unit)).toBe(hexId)
    expect(searched.best).toEqual(full.best)
  })
})
