import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findCharacterHex, getTilesWithCharacters } from '@/lib/characters/character'
import { toTrialId } from '@/lib/characters/trial'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_SPOT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import {
  decodeDuelBoard,
  encodeDuelBoard,
  type DuelBoardState,
  type DuelUnitState,
} from '@/lib/hd/boardLink'
import { unpackDisplayFlags } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'
import { duelFactionBonus, setDuelEquipment, setDuelSpot, useDuelBoard } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { ALLY_A, ALLY_B, ALLY_C, ENEMY_A, PHRAESTO } from '../fixtures/characters'

/* The Honor Duel board built from its link text and read back, with the real
 * stores and game data. Map arena1 has ally tiles 1-10/12/13/16 and enemy tiles
 * 30/33/34/36-45; arena2 keeps ally tile 1 and has no ally tile 9. */

const unit = (
  hexId: number,
  team: Team,
  heroId: number,
  rest: Partial<DuelUnitState> = {},
): DuelUnitState => ({ hexId, team, heroId, trial: false, tier: 0, equipment: 0, spot: 0, ...rest })

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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an Honor Duel board from its link text', () => {
  it('reads back the text it was built from', () => {
    const state = board(
      [
        unit(1, Team.ALLY, ALLY_A, { tier: 1, equipment: 7, spot: 2 }),
        unit(2, Team.ALLY, ALLY_A, { trial: true, tier: 3, equipment: 7 }),
        unit(3, Team.ALLY, ALLY_B, { trial: true, tier: 2, equipment: 255, spot: 6 }),
        unit(40, Team.ENEMY, ALLY_A, { equipment: 12, spot: 2 }),
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
      unit(5, Team.ALLY, ALLY_A, { trial: true }),
    ]
    openBoard(
      board([
        ...kept,
        // A sixth hero, a second normal copy, a hero the game lacks and an
        // ally on an enemy tile.
        unit(6, Team.ALLY, ALLY_B, { trial: true }),
        unit(36, Team.ENEMY, ALLY_A),
        unit(37, Team.ENEMY, ALLY_A),
        unit(38, Team.ENEMY, 8999),
        unit(40, Team.ALLY, ALLY_C, { trial: true }),
      ]),
    )

    expect(onScreen().units).toEqual([...kept, unit(36, Team.ENEMY, ALLY_A)])
  })

  it('keeps one hero on an off-field spot a side: the first in tile order', () => {
    openBoard(
      board([
        unit(1, Team.ALLY, ALLY_A, { spot: 4 }),
        unit(2, Team.ALLY, ALLY_B, { spot: 4 }),
        unit(40, Team.ENEMY, ALLY_C, { spot: 4 }),
      ]),
    )

    expect(onScreen().units.map((u) => u.spot)).toEqual([4, 0, 4])
  })

  // The companion's tile is drawn at random: one case per tenth of the draw,
  // so the result does not depend on which tile comes up.
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'a summoner never costs another hero its tile (random pick %i of 10)',
    (pick) => {
      vi.spyOn(Math, 'random').mockReturnValue(pick / 10)
      const units = [
        unit(1, Team.ALLY, PHRAESTO),
        unit(2, Team.ALLY, ALLY_A),
        unit(3, Team.ALLY, ALLY_B),
        unit(4, Team.ALLY, ALLY_C),
        unit(5, Team.ALLY, ENEMY_A),
      ]
      openBoard(board(units))

      expect(onScreen().units).toEqual(units)
    },
  )

  it('opens an empty board on the first map for a text that is no board', () => {
    const duel = useDuelBoard()

    expect(duel.open('not a board')).toBeNull()
    const ctx = useGrids().active!
    expect(ctx.kind).toBe('honorDuel')
    expect(ctx.currentMap).toBe('arena1')
    expect(getTilesWithCharacters(ctx.grid)).toEqual([])
  })
})

describe('moving an Honor Duel board to another map', () => {
  it('carries every hero with its values, on its own tile where the map has it', () => {
    const { duel } = openBoard(
      board(
        [
          unit(1, Team.ALLY, ALLY_B, { tier: 1 }),
          unit(9, Team.ALLY, ALLY_A, { trial: true, tier: 3, equipment: 9, spot: 4 }),
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
      unit(moved.hexId, Team.ALLY, ALLY_A, { trial: true, tier: 3, equipment: 9, spot: 4 }),
    )
  })
})

describe('Honor Duel equipment and off-field spots', () => {
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

  it('moves an off-field spot to the hero that takes it, on that side alone', () => {
    const { ctx } = setup()
    setDuelSpot(ctx, Team.ALLY, ALLY_A, 3)
    setDuelSpot(ctx, Team.ENEMY, ALLY_A, 3)

    setDuelSpot(ctx, Team.ALLY, ALLY_B, 3)

    expect(ctx.getAttr(Team.ALLY, ALLY_A, DUEL_ATTR_SPOT)).toBe(0)
    expect(ctx.getAttr(Team.ALLY, ALLY_B, DUEL_ATTR_SPOT)).toBe(3)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_SPOT)).toBe(3)
  })

  it('a hero that changes sides leaves its off-field spot and keeps its tier', () => {
    const { ctx } = setup()
    ctx.setAttr(Team.ALLY, ALLY_B, DUEL_ATTR_TIER, 2)
    setDuelSpot(ctx, Team.ALLY, ALLY_B, 5)

    expect(ctx.move(3, 41, ALLY_B)).toBe(true)

    expect(ctx.getAttr(Team.ENEMY, ALLY_B, DUEL_ATTR_SPOT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_B, DUEL_ATTR_TIER)).toBe(2)
  })

  it('a hero that changes sides leaves its piece and takes the one its copies hold there', () => {
    const { ctx, copy } = setup()
    setDuelEquipment(ctx, Team.ALLY, ALLY_A, 9)
    setDuelEquipment(ctx, Team.ALLY, ALLY_B, 4)

    // Its copy there holds none.
    expect(ctx.move(2, 41, copy)).toBe(true)
    expect(ctx.getAttr(Team.ENEMY, copy, DUEL_ATTR_EQUIPMENT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(0)

    setDuelEquipment(ctx, Team.ENEMY, ALLY_A, 5)
    expect(ctx.swap(3, 41)).toBe(true)
    expect(ctx.getAttr(Team.ALLY, copy, DUEL_ATTR_EQUIPMENT)).toBe(9)
    expect(ctx.getAttr(Team.ENEMY, ALLY_B, DUEL_ATTR_EQUIPMENT)).toBe(0)
    expect(ctx.getAttr(Team.ENEMY, ALLY_A, DUEL_ATTR_EQUIPMENT)).toBe(5)
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
})

describe('the Trial switch', () => {
  it('turns each pick into the next free Trial copy on an Honor Duel board', () => {
    const grids = useGrids()
    useDuelBoard().open(null)
    const ctx = grids.active!
    grids.trial = true

    expect(grids.placePick(ctx, ALLY_A, Team.ALLY, 1)).toBe(true)
    expect(grids.placePick(ctx, ALLY_A, Team.ALLY, 2)).toBe(true)
    expect(grids.placePick(ctx, ALLY_B, Team.ENEMY, 40)).toBe(true)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 1), Team.ALLY)).toBe(1)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_A, 2), Team.ALLY)).toBe(2)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_B, 3), Team.ENEMY)).toBe(40)

    // A number that came free is the next one handed out.
    expect(ctx.remove(1)).toBe(true)
    expect(grids.placePick(ctx, ALLY_C, Team.ALLY, 3)).toBe(true)
    expect(findCharacterHex(ctx.grid, toTrialId(ALLY_C, 1), Team.ALLY)).toBe(3)
  })

  it('is off again on every board that replaces the one on screen', () => {
    const grids = useGrids()
    useDuelBoard().open(null)
    grids.trial = true

    grids.setGridCount(1)

    expect(grids.trial).toBe(false)
    expect(grids.placePick(grids.active!, ALLY_A, Team.ALLY, 1)).toBe(true)
    expect(findCharacterHex(grids.active!.grid, ALLY_A, Team.ALLY)).toBe(1)
  })
})
