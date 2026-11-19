import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { findCharacterHex, getTilesWithCharacters } from '@/lib/characters/character'
import { toTrialId, toTrialPick } from '@/lib/characters/trial'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import {
  decodeDuelBoard,
  encodeDuelBoard,
  type DuelBoardState,
  type DuelUnitState,
} from '@/lib/hd/boardLink'
import { unpackDisplayFlags } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'
import { duelFactionBonus, setDuelEquipment, swapDuelCopy, useDuelBoard } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { DUEL_HEROES, KULU } from '../fixtures/characters'

/* The Honor Duel board built from its link text and read back, with the real
 * stores and game data. Map arena1 has ally tiles 1-10/12/13/16 and enemy tiles
 * 30/33/34/36-45; arena2 keeps ally tile 1 and has no ally tile 9. */

const [ALLY_A, ALLY_B, ALLY_C, ENEMY_A] = DUEL_HEROES
// A Supreme Trial Card's hero and a creature, with no skill either. KULU is a
// hero neither the shop nor a card brings.
const SUPREME_HERO = 6
const CREATURE = 7001

const unit = (
  hexId: number,
  team: Team,
  heroId: number,
  rest: Partial<DuelUnitState> = {},
): DuelUnitState => ({ hexId, team, heroId, trial: false, tier: 0, equipment: 0, ...rest })

const board = (units: DuelUnitState[], rest: Partial<DuelBoardState> = {}): DuelBoardState => ({
  d: 0,
  map: 'arena1',
  units,
  artifacts: { ally: null, enemy: null },
  ...rest,
})

const openBoard = (state: DuelBoardState) => {
  const duel = useDuelBoard()
  duel.open(encodeDuelBoard(state))
  return { duel, ctx: useGrids().active! }
}

// The board on screen, as its link holds it.
const onScreen = (): DuelBoardState =>
  decodeDuelBoard(useDuelBoard().snapshot(unpackDisplayFlags(0)))!

beforeEach(() => {
  setActivePinia(createPinia())
  useGameDataStore().initializeContentData()
})

describe('an Honor Duel board from its link text', () => {
  it('reads back the text it was built from', () => {
    const state = board(
      [
        unit(1, Team.ALLY, ALLY_A, { tier: 1, equipment: 7 }),
        unit(2, Team.ALLY, ALLY_A, { trial: true, tier: 2, equipment: 7 }),
        unit(3, Team.ALLY, ALLY_B, { trial: true, tier: 1, equipment: 255 }),
        unit(4, Team.ALLY, SUPREME_HERO, { trial: true, tier: 3 }),
        unit(5, Team.ALLY, CREATURE, { trial: true, equipment: 12 }),
        unit(40, Team.ENEMY, ALLY_A, { equipment: 12 }),
      ],
      { d: 6, artifacts: { ally: { id: 5, level: 2 }, enemy: null } },
    )
    const text = encodeDuelBoard(state)
    const duel = useDuelBoard()

    expect(duel.open(text)).toEqual(state)
    expect(duel.snapshot(unpackDisplayFlags(state.d))).toBe(text)
  })

  it('numbers Trial copies in tile order across the board', () => {
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A),
        unit(2, Team.ALLY, ALLY_B, { trial: true }),
        unit(3, Team.ALLY, ALLY_A, { trial: true }),
        unit(40, Team.ENEMY, ALLY_A, { trial: true }),
      ]),
    )

    expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).toBe(1)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_B, 1), Team.ALLY)).toBe(2)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 2), Team.ALLY)).toBe(3)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 3), Team.ENEMY)).toBe(40)
  })

  it('drops the heroes the board refuses and keeps the rest', () => {
    const kept = [
      unit(1, Team.ALLY, ALLY_A),
      unit(2, Team.ALLY, ALLY_B),
      unit(3, Team.ALLY, ALLY_C),
      unit(4, Team.ALLY, ENEMY_A),
      unit(5, Team.ALLY, ALLY_A, { trial: true, tier: 1 }),
    ]
    openBoard(
      board([
        ...kept,
        // A sixth hero, a second normal copy, a hero the game lacks and an
        // ally on an enemy tile.
        unit(6, Team.ALLY, ALLY_B, { trial: true, tier: 1 }),
        unit(36, Team.ENEMY, ALLY_A),
        unit(37, Team.ENEMY, ALLY_A),
        unit(38, Team.ENEMY, 8999),
        unit(40, Team.ALLY, ALLY_C, { trial: true, tier: 1 }),
      ]),
    )

    expect(onScreen().units).toEqual([...kept, unit(36, Team.ENEMY, ALLY_A)])
  })

  it('drops a unit its source does not bring', () => {
    const kept = [
      unit(5, Team.ALLY, ALLY_A),
      unit(40, Team.ENEMY, SUPREME_HERO, { trial: true, tier: 3 }),
      unit(41, Team.ENEMY, CREATURE, { trial: true }),
    ]
    openBoard(
      board([
        // A hero neither source brings, as a hero and as a Trial unit, and a
        // card's hero and a creature without the Trial mark.
        unit(1, Team.ALLY, KULU),
        unit(2, Team.ALLY, KULU, { trial: true, tier: 3 }),
        unit(3, Team.ALLY, SUPREME_HERO),
        unit(4, Team.ALLY, CREATURE),
        ...kept,
      ]),
    )

    expect(onScreen().units).toEqual(kept)
  })

  it("moves a tier a unit's source does not allow to the nearest it does", () => {
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A, { trial: true, tier: 3 }),
        unit(2, Team.ALLY, ALLY_A, { trial: true }),
        unit(3, Team.ALLY, SUPREME_HERO, { trial: true }),
        unit(4, Team.ALLY, CREATURE, { trial: true, tier: 2 }),
        unit(5, Team.ALLY, ALLY_B),
      ]),
    )
    ctx.setAttr(Team.ALLY, ALLY_B, DUEL_ATTR_TIER, 3)

    expect(onScreen().units.map((u) => u.tier)).toEqual([2, 0, 3, 0, 2])
  })
})

describe('moving an Honor Duel board to another map', () => {
  it('carries every hero with its values, on its own tile where the map has it', () => {
    const { duel } = openBoard(
      board(
        [
          unit(1, Team.ALLY, ALLY_B, { tier: 1 }),
          unit(9, Team.ALLY, ALLY_A, { trial: true, tier: 2, equipment: 9 }),
        ],
        { artifacts: { ally: { id: 3, level: 2 }, enemy: null } },
      ),
    )

    expect(duel.moveToMap('arena2')).toBe(true)

    const state = onScreen()
    expect(state.map).toBe('arena2')
    expect(state.artifacts.ally).toEqual({ id: 3, level: 2 })
    expect(state.units).toHaveLength(2)
    expect(state.units.find((u) => !u.trial)).toEqual(unit(1, Team.ALLY, ALLY_B, { tier: 1 }))
    const moved = state.units.find((u) => u.trial)!
    expect([1, 9]).not.toContain(moved.hexId)
    expect(moved).toEqual(
      unit(moved.hexId, Team.ALLY, ALLY_A, { trial: true, tier: 2, equipment: 9 }),
    )
  })
})

describe('Honor Duel equipment', () => {
  const setup = () => {
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A),
        unit(2, Team.ALLY, ALLY_A, { trial: true }),
        unit(3, Team.ALLY, ALLY_B),
        unit(40, Team.ENEMY, ALLY_A),
      ]),
    )
    return { ctx, copy: toTrialId(ALLY_A, 1) }
  }

  it('gives a piece to every copy of the hero on that side, and to one placed later', () => {
    const { ctx, copy } = setup()

    setDuelEquipment(ctx, Team.ALLY, copy, 9)
    expect(ctx.getAttr(Team.ALLY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(9)
    expect(ctx.getAttr(Team.ALLY, copy, DUEL_ATTR_EQUIPMENT)).toBe(9)
    expect(ctx.getAttr(Team.ALLY, ALLY_B, DUEL_ATTR_EQUIPMENT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(0)

    const later = toTrialId(ALLY_A, 2)
    expect(ctx.place(4, later, Team.ALLY)).toBe(true)
    expect(ctx.getAttr(Team.ALLY, later, DUEL_ATTR_EQUIPMENT)).toBe(9)
  })

  it('a hero that changes sides keeps its tier, leaves its piece and takes the one its copies hold there', () => {
    const { ctx, copy } = setup()
    setDuelEquipment(ctx, Team.ALLY, ALLY_A, 9)
    setDuelEquipment(ctx, Team.ALLY, ALLY_B, 4)
    ctx.setAttr(Team.ALLY, copy, DUEL_ATTR_TIER, 2)

    // Its copy there holds none.
    expect(ctx.move(2, 41, copy)).toBe(true)
    expect(ctx.getAttr(Team.ENEMY, copy, DUEL_ATTR_TIER)).toBe(2)
    expect(ctx.getAttr(Team.ENEMY, copy, DUEL_ATTR_EQUIPMENT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(0)

    setDuelEquipment(ctx, Team.ENEMY, ALLY_A, 5)
    expect(ctx.swap(3, 41)).toBe(true)
    expect(ctx.getAttr(Team.ALLY, copy, DUEL_ATTR_EQUIPMENT)).toBe(9)
    expect(ctx.getAttr(Team.ENEMY, ALLY_B, DUEL_ATTR_EQUIPMENT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(5)
  })
})

describe('a hero changed between its normal and its Trial copy', () => {
  it('keeps its tile, tier and equipment both ways', () => {
    const hero = unit(1, Team.ALLY, ALLY_A, { tier: 1, equipment: 7 })
    const { ctx } = openBoard(board([hero]))

    const copy = swapDuelCopy(ctx, Team.ALLY, ALLY_A)!
    expect(onScreen().units).toEqual([{ ...hero, trial: true }])

    expect(swapDuelCopy(ctx, Team.ALLY, copy)).toBe(ALLY_A)
    expect(onScreen().units).toEqual([hero])
  })

  it('stays a Trial copy with no normal copy to become: its side holds it, or the shop sells none', () => {
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A, { trial: true }),
        unit(2, Team.ALLY, ALLY_A),
        unit(4, Team.ALLY, SUPREME_HERO, { trial: true, tier: 3 }),
        unit(40, Team.ENEMY, ALLY_A, { trial: true }),
      ]),
    )
    const before = onScreen().units

    expect(swapDuelCopy(ctx, Team.ALLY, toTrialId(ALLY_A, 1))).toBeNull()
    expect(swapDuelCopy(ctx, Team.ALLY, toTrialId(SUPREME_HERO, 2))).toBeNull()
    expect(onScreen().units).toEqual(before)

    // The other side holds no normal copy, so its Trial copy may change.
    expect(swapDuelCopy(ctx, Team.ENEMY, toTrialId(ALLY_A, 3))).toBe(ALLY_A)
  })
})

describe("a side's faction bonus", () => {
  it('counts every copy of a hero', () => {
    const faction = useGameDataStore().getCharacterById(ALLY_A)!.faction
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A),
        unit(2, Team.ALLY, ALLY_A, { trial: true }),
        unit(3, Team.ALLY, ALLY_A, { trial: true }),
        unit(4, Team.ALLY, ALLY_A, { trial: true }),
        unit(5, Team.ALLY, ALLY_A, { trial: true }),
        unit(40, Team.ENEMY, ALLY_A),
        unit(41, Team.ENEMY, ALLY_A, { trial: true }),
        unit(42, Team.ENEMY, ALLY_A, { trial: true }),
      ]),
    )

    expect(duelFactionBonus(ctx, Team.ALLY)).toEqual({
      percent: 22,
      counts: [{ faction, count: 5 }],
    })
    expect(duelFactionBonus(ctx, Team.ENEMY).percent).toBe(10)
  })

  it('counts creatures as a faction of their own, with a Supreme hero standing in', () => {
    const { ctx } = openBoard(
      board([
        unit(1, Team.ALLY, 7000, { trial: true }),
        unit(2, Team.ALLY, CREATURE, { trial: true }),
        unit(3, Team.ALLY, CREATURE, { trial: true }),
        unit(40, Team.ENEMY, 7000, { trial: true }),
        unit(41, Team.ENEMY, CREATURE, { trial: true }),
        unit(42, Team.ENEMY, SUPREME_HERO, { trial: true, tier: 3 }),
      ]),
    )

    expect(duelFactionBonus(ctx, Team.ALLY)).toEqual({
      percent: 10,
      counts: [{ faction: 'other', count: 3 }],
    })
    expect(duelFactionBonus(ctx, Team.ENEMY).percent).toBe(11)
  })
})

describe('a Trial pick', () => {
  it("places the next free copy of its unit at its card's tier", () => {
    const grids = useGrids()
    useDuelBoard().open(null)
    const ctx = grids.active!

    expect(grids.placePick(ctx, toTrialPick(ALLY_A, 2), Team.ALLY, 1)).toBe(true)
    expect(grids.placePick(ctx, toTrialPick(ALLY_A, 1), Team.ALLY, 2)).toBe(true)
    expect(grids.routeDrop({ characterId: toTrialPick(SUPREME_HERO, 3) }, ctx.id, 40)).toBe(true)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 1), Team.ALLY)).toBe(1)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 2), Team.ALLY)).toBe(2)
    expect(findCharacterHex(ctx.grid, toTrialId(SUPREME_HERO, 3), Team.ENEMY)).toBe(40)
    expect(onScreen().units.map((u) => u.tier)).toEqual([2, 1, 3])

    // A number that came free is the next one handed out.
    expect(ctx.remove(1)).toBe(true)
    expect(grids.placePick(ctx, toTrialPick(CREATURE, 0), Team.ALLY, 3)).toBe(true)
    expect(findCharacterHex(ctx.grid, toTrialId(CREATURE, 1), Team.ALLY)).toBe(3)
  })

  it('takes the tile of the unit it is dropped on', () => {
    const grids = useGrids()
    useDuelBoard().open(null)
    const ctx = grids.active!
    expect(grids.placePick(ctx, ALLY_A, Team.ALLY, 1)).toBe(true)
    setDuelEquipment(ctx, Team.ALLY, ALLY_A, 7)

    expect(grids.routeDrop({ characterId: toTrialPick(ALLY_B, 2) }, ctx.id, 1)).toBe(true)
    expect(onScreen().units).toEqual([unit(1, Team.ALLY, ALLY_B, { trial: true, tier: 2 })])
  })

  it('places no unit its source does not bring, as a restore would drop it', () => {
    const grids = useGrids()
    useDuelBoard().open(null)
    const ctx = grids.active!

    expect(grids.placePick(ctx, KULU, Team.ALLY, 1)).toBe(false)
    expect(grids.placePick(ctx, SUPREME_HERO, Team.ALLY, 1)).toBe(false)
    expect(grids.routeDrop({ characterId: CREATURE }, ctx.id, 1)).toBe(false)
    expect(grids.routeDrop({ characterId: toTrialPick(KULU, 3) }, ctx.id, 1)).toBe(false)
    expect(getTilesWithCharacters(ctx.grid)).toEqual([])
  })
})
