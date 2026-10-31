import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON } from '@/lib/characters/attributes'
import { findCharacterHex, getCharacter, getTilesWithCharacters } from '@/lib/characters/character'
import { repositionCompanions } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { toSynergyId } from '@/lib/characters/synergy'
import type { Grid } from '@/lib/grid'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { artifactSkillKey, unitSkillKey } from '@/lib/skills/skill'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import type { BoardLineup, TeamImportPlan } from '@/lib/teams/teamImport'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useRosters } from '@/stores/rosters'
import {
  ALLY_A,
  ALLY_B,
  ALLY_C,
  ENEMY_A,
  ENEMY_B,
  KULU,
  PHRAESTO,
  PHRAESTO_COMPANION,
} from '../fixtures/characters'

/**
 * Boards default to arena1 (ally spawns 1-10/12/13/16, enemy spawns
 * 30/33/34/36-45). Skills are code-registered, so Kulu/Phraesto behave without
 * loaded game data.
 */

// (characterId, team) pairs on a board, order-independent (placement is random).
const lineup = (grid: Grid): { characterId: number; team: Team }[] =>
  getTilesWithCharacters(grid)
    .map((tile) => ({ characterId: tile.characterId!, team: tile.team! }))
    .sort((a, b) => a.characterId - b.characterId)

// Minimal cross-board drag payload (routeDrop only reads these fields off the character).
const dragPayload = (sourceGridId: number, sourceHexId: number, characterId: number) => ({
  character: { sourceGridId, sourceHexId } as unknown as CharacterType,
  characterId,
})

// Picker drag payload: no source cell, so the drop is a placement.
const pickerPayload = (characterId: number) => ({
  character: { id: characterId } as unknown as CharacterType,
  characterId,
})

// Fresh store with `count` arena1 boards; a/b are the first two contexts.
const setupBoards = (count = 2) => {
  const grids = useGrids()
  grids.setGridCount(count)
  const [a, b] = grids.contexts
  return { grids, a: a!, b: b! }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGrids.swapBoards', () => {
  it('trades the two boards formations as they stand, keeping each unit on its own team', () => {
    const { grids, a, b } = setupBoards()

    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ENEMY_A, Team.ENEMY)).toBe(true)
    expect(b!.place(2, ALLY_B, Team.ALLY)).toBe(true)
    expect(b!.place(41, ENEMY_B, Team.ENEMY)).toBe(true)

    expect(grids.swapBoards(0, 1)).toBe(true)

    expect(lineup(a!.grid)).toEqual([
      { characterId: ALLY_B, team: Team.ALLY },
      { characterId: ENEMY_B, team: Team.ENEMY },
    ])
    expect(lineup(b!.grid)).toEqual([
      { characterId: ALLY_A, team: Team.ALLY },
      { characterId: ENEMY_A, team: Team.ENEMY },
    ])
    expect(findCharacterHex(b!.grid, ALLY_A, Team.ALLY)).toBe(1)
    expect(findCharacterHex(b!.grid, ENEMY_A, Team.ENEMY)).toBe(40)
    expect(findCharacterHex(a!.grid, ALLY_B, Team.ALLY)).toBe(2)
    expect(findCharacterHex(a!.grid, ENEMY_B, Team.ENEMY)).toBe(41)
  })

  it('swaps each board artifacts, keeping the team side', () => {
    const { grids, a, b } = setupBoards()
    a!.setArtifact(Team.ALLY, 3)
    a!.setArtifact(Team.ENEMY, 4)
    b!.setArtifact(Team.ALLY, 7)
    // b's enemy slot left empty, exercising the remove path on the destination.

    grids.swapBoards(0, 1)

    expect(a!.artifacts.ally).toBe(7)
    expect(a!.artifacts.enemy).toBeNull()
    expect(b!.artifacts.ally).toBe(3)
    expect(b!.artifacts.enemy).toBe(4)
  })

  it('re-derives a cosmetic skill zone on the destination, leaving no ghost', () => {
    const { grids, a, b } = setupBoards()

    const before = a!.grid.getTileById(18).state
    expect(a!.place(1, KULU, Team.ALLY)).toBe(true)
    // The zone is a paint overlay; the underlying tile state is untouched.
    expect(a!.grid.getTileById(18).state).toBe(before)
    expect(a!.getTileColorModifier(18)).toBeDefined()

    grids.swapBoards(0, 1)

    // Kulu kept her team and moved to board b, where her zone re-derives.
    const kulu = getTilesWithCharacters(b!.grid).find((t) => t.characterId === KULU)
    expect(kulu?.team).toBe(Team.ALLY)
    for (const id of [18, 19, 20, 21, 23]) expect(b!.getTileColorModifier(id)).toBeDefined()

    // Source board has no leftover paint.
    for (const id of [18, 19, 20, 21, 23]) expect(a!.getTileColorModifier(id)).toBeUndefined()
    expect(getTilesWithCharacters(a!.grid)).toHaveLength(0)
  })

  it('respawns a companion on the destination with none stranded on the source', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { grids, a, b } = setupBoards()

    expect(a!.place(1, PHRAESTO, Team.ALLY)).toBe(true)
    expect(
      getTilesWithCharacters(a!.grid).filter((t) => t.characterId === PHRAESTO_COMPANION),
    ).toHaveLength(1)

    grids.swapBoards(0, 1)

    // Source fully vacated; destination holds Phraesto plus exactly one companion.
    expect(getTilesWithCharacters(a!.grid)).toHaveLength(0)
    const destPhraesto = getTilesWithCharacters(b!.grid).filter((t) => t.characterId === PHRAESTO)
    const destCompanion = getTilesWithCharacters(b!.grid).filter(
      (t) => t.characterId === PHRAESTO_COMPANION,
    )
    expect(destPhraesto).toHaveLength(1)
    expect(destPhraesto[0]!.team).toBe(Team.ALLY)
    expect(destCompanion).toHaveLength(1)
    expect(destCompanion[0]!.team).toBe(Team.ALLY)
  })
})

describe('useGrids.moveToMap', () => {
  it('carries a board onto another map, each unit on its own tile where the map has it', () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(ctx.place(1, ALLY_A, Team.ALLY)).toBe(true)
    ctx.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 3)
    expect(ctx.place(9, ALLY_B, Team.ALLY)).toBe(true)
    expect(ctx.place(40, ENEMY_A, Team.ENEMY)).toBe(true)
    expect(ctx.placePhantimal(4, toPhantimalId(1), Team.ALLY)).toBe(true)
    ctx.setArtifact(Team.ALLY, 3)

    // arena2 has ally tiles 1 and 4 and enemy tile 40; 9 is no ally tile there.
    expect(grids.moveToMap(ctx, 'arena2')).toBe(true)

    expect(ctx.currentMap).toBe('arena2')
    expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).toBe(1)
    expect(ctx.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(3)
    expect(findCharacterHex(ctx.grid, toPhantimalId(1), Team.ALLY)).toBe(4)
    expect(findCharacterHex(ctx.grid, ENEMY_A, Team.ENEMY)).toBe(40)
    expect(ctx.artifacts.ally).toBe(3)
    const moved = findCharacterHex(ctx.grid, ALLY_B, Team.ALLY)
    expect(moved).not.toBeNull()
    expect([1, 4, 9]).not.toContain(moved)
  })

  // One case per tile the random fallback and the companion spawn can come up
  // with: the result must not depend on which one it is. Units place in tile
  // order (10, 13, 16, 2 here), so ALLY_A's fallback and the companion's spawn
  // are both drawn while tiles 16 and 2 still stand free.
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'a unit whose tile is gone never takes a tile another unit keeps (random pick %i of 10)',
    (pick) => {
      vi.spyOn(Math, 'random').mockReturnValue(pick / 10)
      const { grids, a: ctx } = setupBoards(1)
      expect(ctx.place(13, PHRAESTO, Team.ALLY)).toBe(true)
      repositionCompanions(ctx.grid, Team.ALLY, [{ companionId: PHRAESTO_COMPANION, hexId: 12 }])
      expect(ctx.place(10, ALLY_A, Team.ALLY)).toBe(true)
      expect(ctx.place(16, ALLY_C, Team.ALLY)).toBe(true)
      expect(ctx.place(2, ALLY_B, Team.ALLY)).toBe(true)

      // arena3 has ally tiles 13, 16 and 2, and neither 10 nor 12.
      expect(grids.moveToMap(ctx, 'arena3')).toBe(true)

      expect(findCharacterHex(ctx.grid, PHRAESTO, Team.ALLY)).toBe(13)
      expect(findCharacterHex(ctx.grid, ALLY_C, Team.ALLY)).toBe(16)
      expect(findCharacterHex(ctx.grid, ALLY_B, Team.ALLY)).toBe(2)
      expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).not.toBeNull()
      expect(findCharacterHex(ctx.grid, PHRAESTO_COMPANION, Team.ALLY)).not.toBeNull()
      expect(getTilesWithCharacters(ctx.grid)).toHaveLength(5)
    },
  )
})

describe('useGrids.routeArtifactDrop', () => {
  it('swaps ally and enemy artifacts on the single Arena board', () => {
    const grids = useGrids() // defaults to 1 board
    const a = grids.contexts[0]!
    a.setArtifact(Team.ALLY, 3)
    a.setArtifact(Team.ENEMY, 4)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 0, Team.ENEMY)).toBe(
      true,
    )

    expect(a.artifacts.ally).toBe(4)
    expect(a.artifacts.enemy).toBe(3)
  })

  it('moves an artifact onto an empty cross-team slot', () => {
    const grids = useGrids()
    const a = grids.contexts[0]!
    a.setArtifact(Team.ALLY, 3)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 0, Team.ENEMY)).toBe(
      true,
    )

    expect(a.artifacts.ally).toBeNull()
    expect(a.artifacts.enemy).toBe(3)
  })

  it('moves an artifact to another board on the same team and makes it active', () => {
    const { grids } = setupBoards()
    grids.setActive(0)
    const [a, b] = grids.contexts
    a!.setArtifact(Team.ALLY, 3)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ALLY)).toBe(
      true,
    )

    expect(a!.artifacts.ally).toBeNull()
    expect(b!.artifacts.ally).toBe(3)
    expect(grids.activeId).toBe(1)
  })

  it('swaps same-team artifacts across boards', () => {
    const { grids, a, b } = setupBoards()
    a!.setArtifact(Team.ALLY, 3)
    b!.setArtifact(Team.ALLY, 7)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ALLY)).toBe(
      true,
    )

    expect(a!.artifacts.ally).toBe(7)
    expect(b!.artifacts.ally).toBe(3)
  })

  it('rejects a cross-team drop that would duplicate an artifact on a team', () => {
    const { grids, a, b } = setupBoards()
    a!.setArtifact(Team.ALLY, 5)
    a!.setArtifact(Team.ENEMY, 5) // same artifact on both teams of board a (legal per-team)
    b!.setArtifact(Team.ENEMY, 9)

    // Dragging a's ally 5 onto b's enemy 9 would put 5 on the enemy team of both
    // boards. Destination-exclusion catches it via board a's enemy slot.
    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ENEMY)).toBe(
      false,
    )

    expect(a!.artifacts.ally).toBe(5)
    expect(a!.artifacts.enemy).toBe(5)
    expect(b!.artifacts.enemy).toBe(9)
  })
})

describe('useGrids.routeDrop cross-board hero/phantimal swap', () => {
  // Every placed unit with its hex, so a rejected drop can be shown to have
  // left companions and phantimals exactly where they were.
  const placements = (grid: Grid): [number, number, Team][] =>
    getTilesWithCharacters(grid)
      .map((tile): [number, number, Team] => [tile.hex.getId(), tile.characterId!, tile.team!])
      .sort((a, b) => a[0] - b[0])

  // Board a: a phantimal and Phraesto with his companion (the phantimal goes
  // first, since the companion spawns on a random free tile and a later
  // placement over it would remove Phraesto too); board b: a full team of five
  // plus the same phantimal.
  const setupSwap = () => {
    const { grids, a, b } = setupBoards()
    expect(a.placePhantimal(6, toPhantimalId(1), Team.ALLY)).toBe(true)
    expect(a.place(5, PHRAESTO, Team.ALLY)).toBe(true)
    for (const [hex, id] of [
      [1, ALLY_A],
      [2, ALLY_B],
      [3, ALLY_C],
      [4, ENEMY_A],
      [7, ENEMY_B],
    ] as const) {
      expect(b.place(hex, id, Team.ALLY)).toBe(true)
    }
    expect(b.placePhantimal(6, toPhantimalId(1), Team.ALLY)).toBe(true)
    return { grids, a, b }
  }

  it('rejects a hero for a phantimal when the hero lands on a full team, leaving both boards untouched', () => {
    const { grids, a, b } = setupSwap()
    const before = [placements(a.grid), placements(b.grid)]

    // Hero dragged onto the full board's phantimal, and the phantimal dragged
    // onto the hero: either way the hero lands on the full board.
    expect(grids.canDropCharacter(PHRAESTO, 0, 5, 1, 6)).toBe(false)
    expect(grids.routeDrop(dragPayload(0, 5, PHRAESTO), 1, 6)).toBe(false)
    expect(grids.canDropCharacter(toPhantimalId(1), 1, 6, 0, 5)).toBe(false)
    expect(grids.routeDrop(dragPayload(1, 6, toPhantimalId(1)), 0, 5)).toBe(false)

    expect([placements(a.grid), placements(b.grid)]).toEqual(before)
  })

  it('swaps a hero for a phantimal once the receiving team has a free slot', () => {
    const { grids, a, b } = setupSwap()
    expect(b.remove(7)).toBe(true)

    expect(grids.canDropCharacter(PHRAESTO, 0, 5, 1, 6)).toBe(true)
    expect(grids.routeDrop(dragPayload(0, 5, PHRAESTO), 1, 6)).toBe(true)

    expect(getCharacter(b.grid, 6)).toBe(PHRAESTO)
    expect(getCharacter(a.grid, 5)).toBe(toPhantimalId(1))
    expect(findCharacterHex(b.grid, PHRAESTO_COMPANION, Team.ALLY)).not.toBeNull()
    expect(findCharacterHex(a.grid, PHRAESTO_COMPANION, Team.ALLY)).toBeNull()
  })
})

describe('useGrids.routeDrop cross-board uniqueness', () => {
  it('rejects a cross-board swap that would put a character on the same team twice', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ALLY_A, Team.ENEMY)).toBe(true) // same hero on both teams of board a
    expect(b!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)

    // Swapping a's ally copy onto b's enemy unit would put ALLY_A on the enemy team
    // of both boards. Destination-exclusion catches it via board a's enemy slot.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(getCharacter(a!.grid, 40)).toBe(ALLY_A)
    expect(getCharacter(b!.grid, 41)).toBe(ENEMY_A)
  })

  it('rejects a cross-board cross-team move that would duplicate a character on a team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ALLY_A, Team.ENEMY)).toBe(true)

    // Moving a's ally copy onto an empty enemy tile on b would duplicate it on enemy.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(b!.grid.getTileById(41).characterId).toBeUndefined()
  })

  it('allows a cross-board same-team move', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 2)).toBe(true)

    expect(getCharacter(b!.grid, 2)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).characterId).toBeUndefined()
  })

  it('allows swapping the same hero between its two legal cross-board placements', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ALLY_A, Team.ENEMY)).toBe(true)
    // The swap leaves global placement state unchanged, so distinct paragon
    // levels are what prove the two copies actually traded boards (and that the
    // reused paragon key is cleared before it is rewritten).
    a!.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 2)
    b!.setAttr(Team.ENEMY, ALLY_A, ATTR_PARAGON, 4)

    // The destination-board exclusion in isUsed exists for exactly this: each
    // leg's scan would otherwise find the counterpart copy, which is itself
    // vacating, and false-reject the swap.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).team).toBe(Team.ALLY)
    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(b!.grid.getTileById(41).team).toBe(Team.ENEMY)
    expect(a!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(4)
    expect(b!.getAttr(Team.ENEMY, ALLY_A, ATTR_PARAGON)).toBe(2)
  })

  it('rejects a companion dragged to another board', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, PHRAESTO, Team.ALLY)).toBe(true)
    const companionHex = getTilesWithCharacters(a!.grid)
      .find((t) => t.characterId === PHRAESTO_COMPANION)!
      .hex.getId()

    expect(grids.routeDrop(dragPayload(0, companionHex, PHRAESTO_COMPANION), 1, 2)).toBe(false)

    expect(getCharacter(a!.grid, companionHex)).toBe(PHRAESTO_COMPANION)
    expect(b!.grid.getTileById(2).characterId).toBeUndefined()
  })

  it('rejects a cross-board move into a full team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    // Fill b's ally team to BASE_TEAM_SIZE (5).
    for (const [hexId, id] of [
      [2, 30],
      [3, 31],
      [4, 32],
      [5, 33],
      [6, 34],
    ]) {
      expect(b!.place(hexId!, id!, Team.ALLY)).toBe(true)
    }

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 7)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(b!.grid.getTileById(7).characterId).toBeUndefined()
  })

  it('makes the destination board active on a picker drop', () => {
    const { grids } = setupBoards()
    grids.setActive(0)

    expect(grids.routeDrop(pickerPayload(ALLY_A), 1, 2)).toBe(true)

    expect(getCharacter(grids.contexts[1]!.grid, 2)).toBe(ALLY_A)
    expect(grids.activeId).toBe(1)
  })
})

describe('useGrids attr carry-over', () => {
  it('carries paragon levels through a board swap', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 3)
    expect(b!.place(41, ENEMY_B, Team.ENEMY)).toBe(true)
    b!.setAttr(Team.ENEMY, ENEMY_B, ATTR_PARAGON, 4)

    grids.swapBoards(0, 1)

    expect(b!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(3)
    expect(a!.getAttr(Team.ENEMY, ENEMY_B, ATTR_PARAGON)).toBe(4)
    expect(a!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(0)
    expect(b!.getAttr(Team.ENEMY, ENEMY_B, ATTR_PARAGON)).toBe(0)
  })

  it('moves a paragon level with its hero to the destination board and team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(b!.getAttr(Team.ENEMY, ALLY_A, ATTR_PARAGON)).toBe(4)
    expect(a!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(0)
  })

  it('swaps paragon levels with the swapped heroes', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 2)
    expect(b!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)
    b!.setAttr(Team.ENEMY, ENEMY_A, ATTR_PARAGON, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(b!.getAttr(Team.ENEMY, ALLY_A, ATTR_PARAGON)).toBe(2)
    expect(a!.getAttr(Team.ALLY, ENEMY_A, ATTR_PARAGON)).toBe(4)
    expect(a!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(0)
    expect(b!.getAttr(Team.ENEMY, ENEMY_A, ATTR_PARAGON)).toBe(0)
  })
})

describe('useGrids roster picks', () => {
  it("places a picked hero at the active roster's levels, by click and by drag", () => {
    const { grids, a, b } = setupBoards()
    const rosters = useRosters()
    const roster = rosters.create()!
    rosters.setHeroes(roster.id, {
      [ALLY_A]: { [ATTR_PARAGON]: 3 },
      [ALLY_B]: { [ATTR_PARAGON]: 3 },
    })

    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(true)
    expect(a.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(3)
    expect(grids.routeDrop(pickerPayload(ALLY_B), 1, 2)).toBe(true)
    expect(b.getAttr(Team.ALLY, ALLY_B, ATTR_PARAGON)).toBe(3)

    // All heroes: a pick starts at defaults.
    rosters.setActive(null)
    expect(grids.placeOnActive(ALLY_C, Team.ALLY)).toBe(true)
    expect(b.getAttr(Team.ALLY, ALLY_C, ATTR_PARAGON)).toBe(0)
  })
})

describe('useGrids.routeDrop same-board uniqueness', () => {
  it('rejects a same-board cross-team move that would duplicate a character on a team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ALLY_A, Team.ENEMY)).toBe(true)

    // Moving a's ally copy onto one of a's own enemy tiles would put ALLY_A on
    // the enemy team of both boards.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 40)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(a!.grid.getTileById(40).characterId).toBeUndefined()
  })

  it('rejects a same-board swap whose displaced unit would duplicate on a team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ENEMY_A, Team.ENEMY)).toBe(true)
    expect(b!.place(2, ENEMY_A, Team.ALLY)).toBe(true)

    // The swap sends ENEMY_A to a's ally team, where board b already has a copy.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 40)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(getCharacter(a!.grid, 40)).toBe(ENEMY_A)
  })

  it('allows a same-board cross-team move and swap when uniqueness holds', () => {
    const grids = useGrids() // defaults to 1 board
    const a = grids.contexts[0]!
    expect(a.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a.place(40, ENEMY_A, Team.ENEMY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 40)).toBe(true)
    expect(getCharacter(a.grid, 40)).toBe(ALLY_A)
    expect(getCharacter(a.grid, 1)).toBe(ENEMY_A)

    expect(grids.routeDrop(dragPayload(0, 1, ENEMY_A), 0, 41)).toBe(true)
    expect(getCharacter(a.grid, 41)).toBe(ENEMY_A)
    expect(a.grid.getTileById(1).characterId).toBeUndefined()
  })
})

describe('useGrids synergy', () => {
  it('placeOnActive resolves a duplicate to the synergy copy only while armed', () => {
    const { grids } = setupBoards(1)
    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(true)

    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(false)
    grids.synergy = true
    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(true)

    const ids = getTilesWithCharacters(grids.active!.grid).map((t) => t.characterId)
    expect(ids.sort((a, b) => a! - b!)).toEqual([ALLY_A, toSynergyId(ALLY_A)])
    // The slot is spent: a further duplicate resolves to nothing.
    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(false)
  })

  it('placeOnActive routes an overflow pick on a full team into the slot', () => {
    const { grids } = setupBoards(1)
    const heroes = [11, 12, 13, 14, 15]
    heroes.forEach((id) => expect(grids.placeOnActive(id, Team.ALLY)).toBe(true))

    expect(grids.placeOnActive(16, Team.ALLY)).toBe(false)
    grids.synergy = true
    expect(grids.placeOnActive(16, Team.ALLY)).toBe(true)
    expect(findCharacterHex(grids.active!.grid, toSynergyId(16), Team.ALLY)).not.toBe(null)
  })

  it('setSynergy(false) removes both teams synergy units and their companions', () => {
    const { grids } = setupBoards(1)
    grids.synergy = true
    expect(grids.placeOnActive(PHRAESTO, Team.ALLY)).toBe(true)
    expect(grids.placeOnActive(PHRAESTO, Team.ALLY)).toBe(true)
    expect(grids.placeOnActive(ALLY_A, Team.ENEMY)).toBe(true)
    expect(grids.placeOnActive(ALLY_A, Team.ENEMY)).toBe(true)

    const before = lineup(grids.active!.grid).map((r) => r.characterId)
    expect(before).toContain(toSynergyId(PHRAESTO))
    expect(before).toContain(toSynergyId(PHRAESTO) + COMPANION_ID_OFFSET)
    expect(before).toContain(toSynergyId(ALLY_A))

    grids.setSynergy(false)
    expect(grids.synergy).toBe(false)
    const after = lineup(grids.active!.grid).map((r) => r.characterId)
    expect(after.sort((a, b) => a - b)).toEqual([ALLY_A, PHRAESTO, PHRAESTO_COMPANION])
  })

  it('routeDrop replaces the synergy hero on a full team with the new hero as the copy', () => {
    const { grids, a: ctx } = setupBoards(1)
    ;[11, 12, 13, 14, 15].forEach((id) => expect(grids.placeOnActive(id, Team.ALLY)).toBe(true))
    grids.synergy = true
    expect(grids.placeOnActive(16, Team.ALLY)).toBe(true)
    const slotHex = findCharacterHex(ctx.grid, toSynergyId(16), Team.ALLY)!

    // Vacating the copy frees the assist slot, not a capacity slot, so the
    // newcomer lands as the copy; the hover cue and the drop agree.
    expect(grids.canDropCharacter(17, undefined, undefined, ctx.id, slotHex)).toBe(true)
    expect(grids.routeDrop(pickerPayload(17), ctx.id, slotHex)).toBe(true)
    expect(getCharacter(ctx.grid, slotHex)).toBe(toSynergyId(17))
    expect(lineup(ctx.grid).map((r) => r.characterId)).toEqual([
      11,
      12,
      13,
      14,
      15,
      toSynergyId(17),
    ])
  })

  it('setGridCount re-derives the affordance from the rebuilt boards', () => {
    const { grids } = setupBoards(1)
    grids.synergy = true
    grids.setGridCount(1)
    expect(grids.synergy).toBe(false)
  })
})

describe('useGrids hidden skills', () => {
  const KULU_ALLY = unitSkillKey(KULU, Team.ALLY)
  const SILVINA = 39
  const ENLIGHTENING = 3

  it('hides a drawing on the board without losing it from the skill engine', () => {
    const { grids, a } = setupBoards(1)
    a.place(2, SILVINA, Team.ALLY)
    a.place(40, ENEMY_A, Team.ENEMY)
    grids.setSkillsHidden([unitSkillKey(SILVINA, Team.ALLY)], true)

    expect(a.skillTargets.size).toBe(0)
    // The Debug tab reads the engine directly.
    expect(a.skillManager.getAllSkillTargets().size).toBe(1)
  })

  it('merges a hero and its synergy copy into one row', () => {
    const { grids, a } = setupBoards(1)
    a.place(1, KULU, Team.ALLY)
    a.place(2, toSynergyId(KULU), Team.ALLY)

    expect(grids.skillRows.filter((row) => row.key === KULU_ALLY)).toHaveLength(1)
  })

  it('stays hidden across boards and comes back visible after leaving them', async () => {
    const { grids, a, b } = setupBoards()
    a.place(1, KULU, Team.ALLY)
    grids.setSkillsHidden([KULU_ALLY], true)
    expect(a.getTileColorModifier(19)).toBeUndefined()

    grids.routeDrop(dragPayload(0, 1, KULU), 1, 1)
    await nextTick()
    expect(findCharacterHex(b.grid, KULU, Team.ALLY)).toBe(1)
    expect(grids.hiddenSkills.has(KULU_ALLY)).toBe(true)
    expect(b.getTileColorModifier(19)).toBeUndefined()

    b.remove(1)
    await nextTick()
    b.place(1, KULU, Team.ALLY)
    expect(b.getTileColorModifier(19)).toBeDefined()
  })

  it('hides one side of a board artifact and lists it while it draws', () => {
    useGameDataStore().initializeContentData()
    const { grids, a } = setupBoards(1)
    a.setArtifact(Team.ALLY, ENLIGHTENING)
    a.setArtifact(Team.ENEMY, ENLIGHTENING)
    const key = artifactSkillKey(ENLIGHTENING, Team.ALLY)
    expect(grids.skillRows.find((row) => row.key === key)?.drawing).toBe(false)

    a.place(1, ALLY_A, Team.ALLY)
    a.place(40, ENEMY_A, Team.ENEMY)
    expect(grids.skillRows.find((row) => row.key === key)?.drawing).toBe(true)

    grids.setSkillsHidden([key], true)
    expect(a.artifactArrows.map((arrow) => arrow.team)).toEqual([Team.ENEMY])
  })
})

describe('useGrids.loadTeamSide', () => {
  const board = (
    mains: [number, number, number?][],
    extra: Partial<SideLoadBoard> = {},
  ): SideLoadBoard => ({
    mains: mains.map(([unitId, hexId, paragon]) =>
      paragon ? { unitId, hexId, attrs: { [ATTR_PARAGON]: paragon } } : { unitId, hexId },
    ),
    companions: [],
    phantimal: null,
    artifact: null,
    ...extra,
  })

  it('replaces the destination side at the saved hexes, leaving the other side alone', () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(ctx.place(1, 11, Team.ALLY)).toBe(true)
    expect(ctx.place(40, 21, Team.ENEMY)).toBe(true)

    const result = grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [
          board([
            [12, 2],
            [13, 3],
          ]),
        ],
      },
      { invert: false, scope: 'all' },
    )

    expect(result).toEqual({ placed: 2, skipped: 0 })
    expect(findCharacterHex(ctx.grid, 11, Team.ALLY)).toBeNull()
    expect(findCharacterHex(ctx.grid, 12, Team.ALLY)).toBe(2)
    expect(findCharacterHex(ctx.grid, 13, Team.ALLY)).toBe(3)
    expect(findCharacterHex(ctx.grid, 21, Team.ENEMY)).toBe(40)
  })

  it("falls back to a random tile when the saved hex is not the destination team's", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { grids, a: ctx } = setupBoards(1)

    // Hex 40 is an enemy spawn on arena1, unplaceable for an ally unit.
    const result = grids.loadTeamSide(
      { side: Team.ALLY, boards: [board([[12, 40]])] },
      { invert: false, scope: 'all' },
    )

    expect(result).toEqual({ placed: 1, skipped: 0 })
    const hex = findCharacterHex(ctx.grid, 12, Team.ALLY)
    expect(hex).not.toBeNull()
    expect(hex).not.toBe(40)
  })

  it('invert mirrors the formation 180 degrees onto the opposite team', () => {
    const { grids, a: ctx } = setupBoards(1)

    const result = grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [
          board([
            [12, 1],
            [13, 16],
          ]),
        ],
      },
      { invert: true, scope: 'all' },
    )

    // rotate(1) = 45, rotate(16) = 30: both enemy spawns on arena1.
    expect(result).toEqual({ placed: 2, skipped: 0 })
    expect(findCharacterHex(ctx.grid, 12, Team.ENEMY)).toBe(45)
    expect(findCharacterHex(ctx.grid, 13, Team.ENEMY)).toBe(30)
    expect(findCharacterHex(ctx.grid, 12, Team.ALLY)).toBeNull()
  })

  it("applies saved paragon, starts unsaved heroes at defaults, and swaps only the destination side's artifact", () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(ctx.place(1, 11, Team.ALLY)).toBe(true)
    ctx.setAttr(Team.ALLY, 11, ATTR_PARAGON, 3)
    ctx.setArtifact(Team.ALLY, 5)
    ctx.setArtifact(Team.ENEMY, 6)

    grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [
          board(
            [
              [11, 2],
              [12, 3, 4],
            ],
            { artifact: 8 },
          ),
        ],
      },
      { invert: false, scope: 'all' },
    )

    // 11 comes back without a saved level, so its earlier 3 must not return.
    expect(findCharacterHex(ctx.grid, 11, Team.ALLY)).toBe(2)
    expect(ctx.getAttr(Team.ALLY, 11, ATTR_PARAGON)).toBe(0)
    expect(ctx.getAttr(Team.ALLY, 12, ATTR_PARAGON)).toBe(4)
    expect(ctx.artifacts.ally).toBe(8)
    expect(ctx.artifacts.enemy).toBe(6)
  })

  it('scope active targets only the active board and skips page-wide duplicates', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, 11, Team.ALLY)).toBe(true)
    grids.setActive(1)

    const result = grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [
          board([
            [11, 2],
            [12, 3],
          ]),
        ],
      },
      { invert: false, scope: 'active' },
    )

    expect(result).toEqual({ placed: 1, skipped: 1 })
    expect(findCharacterHex(a!.grid, 11, Team.ALLY)).toBe(1)
    expect(findCharacterHex(b!.grid, 11, Team.ALLY)).toBeNull()
    expect(findCharacterHex(b!.grid, 12, Team.ALLY)).toBe(3)
  })

  it('maps saved board i onto live board i', () => {
    const { grids } = setupBoards(3)

    grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [board([[11, 1]]), board([[12, 2]]), board([[13, 3]])],
      },
      { invert: false, scope: 'all' },
    )

    expect(findCharacterHex(grids.contexts[0]!.grid, 11, Team.ALLY)).toBe(1)
    expect(findCharacterHex(grids.contexts[1]!.grid, 12, Team.ALLY)).toBe(2)
    expect(findCharacterHex(grids.contexts[2]!.grid, 13, Team.ALLY)).toBe(3)
  })

  it("places the plan's phantimal on its saved hex", () => {
    const { grids, a: ctx } = setupBoards(1)

    grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [board([[11, 1]], { phantimal: { unitId: toPhantimalId(1), hexId: 4 } })],
      },
      { invert: false, scope: 'all' },
    )

    expect(findCharacterHex(ctx.grid, toPhantimalId(1), Team.ALLY)).toBe(4)
  })

  it('counts the units a side leaves out as skipped', () => {
    const { grids } = setupBoards(1)

    const result = grids.loadTeamSide(
      { side: Team.ALLY, boards: [board([[12, 2]], { leftOut: 1 })] },
      { invert: false, scope: 'all' },
    )

    expect(result).toEqual({ placed: 1, skipped: 1 })
  })

  it('derives the Syn affordance from a loaded synergy hero', () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(grids.synergy).toBe(false)

    grids.loadTeamSide(
      { side: Team.ALLY, boards: [board([[toSynergyId(16), 5]])] },
      { invert: false, scope: 'all' },
    )

    expect(findCharacterHex(ctx.grid, toSynergyId(16), Team.ALLY)).toBe(5)
    expect(grids.synergy).toBe(true)
  })

  it('settles a spawned companion onto its saved hex so it cannot squat on a later main', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { grids, a: ctx } = setupBoards(1)

    // Phraesto's companion spawns at a random free ally tile, which without the
    // settle pass could be hex 10, the second main's saved tile; stamping there
    // would then evict the companion and cascade-remove Phraesto.
    const result = grids.loadTeamSide(
      {
        side: Team.ALLY,
        boards: [
          board(
            [
              [PHRAESTO, 1],
              [ALLY_A, 10],
            ],
            { companions: [{ unitId: PHRAESTO_COMPANION, hexId: 4, mainUnitId: PHRAESTO }] },
          ),
        ],
      },
      { invert: false, scope: 'all' },
    )

    expect(result).toEqual({ placed: 2, skipped: 0 })
    expect(findCharacterHex(ctx.grid, PHRAESTO, Team.ALLY)).toBe(1)
    expect(findCharacterHex(ctx.grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(4)
    expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).toBe(10)
    expect(getTilesWithCharacters(ctx.grid)).toHaveLength(3)
  })

  it('removes the destination artifact when the incoming board carries none', () => {
    const { grids, a: ctx } = setupBoards(1)
    ctx.setArtifact(Team.ALLY, 5)
    ctx.setArtifact(Team.ENEMY, 6)

    grids.loadTeamSide(
      { side: Team.ALLY, boards: [board([[11, 1]])] },
      { invert: false, scope: 'all' },
    )

    expect(ctx.artifacts.ally).toBeNull()
    expect(ctx.artifacts.enemy).toBe(6)
  })
})

describe('useGrids.applyLineups', () => {
  const side = (mains: [number, number?][], extra: Partial<SideLoadBoard> = {}): SideLoadBoard => ({
    mains: mains.map(([unitId, hexId]) => ({ unitId, hexId, attrs: {} })),
    companions: [],
    phantimal: null,
    artifact: null,
    ...extra,
  })
  const plan = (board: BoardLineup): TeamImportPlan => ({
    boards: [board],
    issues: [],
    suggestedName: '',
    units: [],
  })

  it("stands a formation side's units and companion on their tiles wherever they spawn", () => {
    for (const spawn of [0, 0.3, 0.6, 0.95]) {
      setActivePinia(createPinia())
      vi.spyOn(Math, 'random').mockReturnValue(spawn)
      const { grids, a: ctx } = setupBoards(1)
      const formation = side(
        [
          [PHRAESTO, 6],
          [ALLY_A, 13],
        ],
        { companions: [{ unitId: PHRAESTO_COMPANION, hexId: 1, mainUnitId: PHRAESTO }] },
      )
      grids.applyLineups(
        plan({ sides: { [Team.ALLY]: formation }, formations: [Team.ALLY], map: null }),
      )
      expect(findCharacterHex(ctx.grid, PHRAESTO, Team.ALLY)).toBe(6)
      expect(findCharacterHex(ctx.grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(1)
      expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).toBe(13)
      vi.restoreAllMocks()
    }
  })

  it('places a formation side on the tiles of the map the formation shows', () => {
    const { grids, a: ctx } = setupBoards(1)
    grids.applyLineups(
      plan({ sides: { [Team.ALLY]: side([[ALLY_A, 1]]) }, formations: [Team.ALLY], map: 'arena2' }),
    )
    expect(ctx.currentMap).toBe('arena2')
    expect(findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)).toBe(1)
  })
})
