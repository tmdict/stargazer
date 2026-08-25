import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findCharacterHex, getCharacter, getTilesWithCharacters } from '@/lib/characters/character'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { toSynergyId } from '@/lib/characters/synergy'
import type { Grid } from '@/lib/grid'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { TEAM_MODES } from '@/lib/teams/modes'
import { buildSideLoadPlan, type SideLoadBoard } from '@/lib/teams/sideLoad'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import {
  ALLY_A,
  ALLY_B,
  ENEMY_A,
  ENEMY_B,
  KULU,
  PHRAESTO,
  PHRAESTO_COMPANION,
} from '../fixtures/characters'

/**
 * Tests for the grids store's cross-board actions: swapBoards, drop routing,
 * and loadTeamSide. Boards default to arena1 (ally spawns 1-10/12/13/16, enemy
 * spawns 30/33/34/36-45). Skills are code-registered, so Kulu/Phraesto behave
 * without loaded game data.
 */

// (characterId, team) pairs on a board, order-independent (placement is random).
const roster = (grid: Grid): { characterId: number; team: Team }[] =>
  getTilesWithCharacters(grid)
    .map((tile) => ({ characterId: tile.characterId!, team: tile.team! }))
    .sort((a, b) => a.characterId - b.characterId)

// Minimal cross-board drag payload (routeDrop only reads these fields off the character).
const dragPayload = (sourceGridId: number, sourceHexId: number, characterId: number) => ({
  character: { sourceGridId, sourceHexId } as unknown as CharacterType,
  characterId,
})

// Roster drag payload: no source cell, so the drop is a placement.
const rosterPayload = (characterId: number) => ({
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
  it('exchanges the two boards rosters, keeping each unit on its own team', () => {
    const { grids, a, b } = setupBoards()

    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ENEMY_A, Team.ENEMY)).toBe(true)
    expect(b!.place(2, ALLY_B, Team.ALLY)).toBe(true)
    expect(b!.place(41, ENEMY_B, Team.ENEMY)).toBe(true)

    expect(grids.swapBoards(0, 1)).toBe(true)

    expect(roster(a!.grid)).toEqual([
      { characterId: ALLY_B, team: Team.ALLY },
      { characterId: ENEMY_B, team: Team.ENEMY },
    ])
    expect(roster(b!.grid)).toEqual([
      { characterId: ALLY_A, team: Team.ALLY },
      { characterId: ENEMY_A, team: Team.ENEMY },
    ])
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

  it('makes the target board active', () => {
    const { grids } = setupBoards()
    grids.setActive(0)

    grids.swapBoards(0, 1)

    expect(grids.activeId).toBe(1)
  })

  it('rejects a swap of a board with itself', () => {
    const { grids } = setupBoards()
    expect(grids.swapBoards(1, 1)).toBe(false)
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

  it('round-trips each roster when swapped twice', () => {
    const { grids, a, b } = setupBoards()
    a!.place(1, ALLY_A, Team.ALLY)
    a!.place(40, ENEMY_A, Team.ENEMY)
    b!.place(2, ALLY_B, Team.ALLY)

    const beforeA = roster(a!.grid)
    const beforeB = roster(b!.grid)

    grids.swapBoards(0, 1)
    grids.swapBoards(0, 1)

    expect(roster(a!.grid)).toEqual(beforeA)
    expect(roster(b!.grid)).toEqual(beforeB)
  })
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

  it('is a no-op when dropped on its own slot', () => {
    const grids = useGrids()
    const a = grids.contexts[0]!
    a.setArtifact(Team.ALLY, 3)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 0, Team.ALLY)).toBe(
      false,
    )
    expect(a.artifacts.ally).toBe(3)
  })

  it('is a no-op when the source slot is empty', () => {
    const { grids, b } = setupBoards()
    b.setArtifact(Team.ALLY, 7)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ALLY)).toBe(
      false,
    )
    expect(b.artifacts.ally).toBe(7)
  })

  it('is a no-op when the same artifact already occupies the target slot', () => {
    const grids = useGrids()
    const a = grids.contexts[0]!
    a.setArtifact(Team.ALLY, 5)
    a.setArtifact(Team.ENEMY, 5)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 0, Team.ENEMY)).toBe(
      false,
    )
    expect(a.artifacts.ally).toBe(5)
    expect(a.artifacts.enemy).toBe(5)
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

  it('allows a cross-board cross-team swap when uniqueness holds', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(getCharacter(a!.grid, 1)).toBe(ENEMY_A)
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

  it('allows a cross-board cross-team move when uniqueness holds', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).characterId).toBeUndefined()
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
    a!.setParagon(Team.ALLY, ALLY_A, 2)
    b!.setParagon(Team.ENEMY, ALLY_A, 4)

    // The destination-board exclusion in isUsed exists for exactly this: each
    // leg's scan would otherwise find the counterpart copy, which is itself
    // vacating, and false-reject the swap.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).team).toBe(Team.ALLY)
    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(b!.grid.getTileById(41).team).toBe(Team.ENEMY)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(4)
    expect(b!.getParagon(Team.ENEMY, ALLY_A)).toBe(2)
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

  it('makes the destination board active on a roster drop', () => {
    const { grids } = setupBoards()
    grids.setActive(0)

    // Roster payload: no sourceGridId/sourceHexId.
    const payload = { character: {} as CharacterType, characterId: ALLY_A }
    expect(grids.routeDrop(payload, 1, 2)).toBe(true)

    expect(getCharacter(grids.contexts[1]!.grid, 2)).toBe(ALLY_A)
    expect(grids.activeId).toBe(1)
  })
})

describe('useGrids paragon carry-over', () => {
  it('carries paragon levels through a board swap', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 3)
    expect(b!.place(41, ENEMY_B, Team.ENEMY)).toBe(true)
    b!.setParagon(Team.ENEMY, ENEMY_B, 4)

    grids.swapBoards(0, 1)

    expect(b!.getParagon(Team.ALLY, ALLY_A)).toBe(3)
    expect(a!.getParagon(Team.ENEMY, ENEMY_B)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
    expect(b!.getParagon(Team.ENEMY, ENEMY_B)).toBe(0)
  })

  it('moves a paragon level with its hero to the destination board and team', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(b!.getParagon(Team.ENEMY, ALLY_A)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
  })

  it('swaps paragon levels with the swapped heroes', () => {
    const { grids, a, b } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 2)
    expect(b!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)
    b!.setParagon(Team.ENEMY, ENEMY_A, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(b!.getParagon(Team.ENEMY, ALLY_A)).toBe(2)
    expect(a!.getParagon(Team.ALLY, ENEMY_A)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
    expect(b!.getParagon(Team.ENEMY, ENEMY_A)).toBe(0)
  })

  it('re-keys a paragon level on a same-board cross-team move', () => {
    const { grids, a } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 41)).toBe(true)

    expect(a!.getParagon(Team.ENEMY, ALLY_A)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
  })

  it('trades paragon levels on a same-board cross-team swap', () => {
    const { grids, a } = setupBoards()
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 2)
    a!.setParagon(Team.ENEMY, ENEMY_A, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 41)).toBe(true)

    expect(a!.getParagon(Team.ENEMY, ALLY_A)).toBe(2)
    expect(a!.getParagon(Team.ALLY, ENEMY_A)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
    expect(a!.getParagon(Team.ENEMY, ENEMY_A)).toBe(0)
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

    const before = roster(grids.active!.grid).map((r) => r.characterId)
    expect(before).toContain(toSynergyId(PHRAESTO))
    expect(before).toContain(toSynergyId(PHRAESTO) + COMPANION_ID_OFFSET)
    expect(before).toContain(toSynergyId(ALLY_A))

    grids.setSynergy(false)
    expect(grids.synergy).toBe(false)
    const after = roster(grids.active!.grid).map((r) => r.characterId)
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
    expect(grids.routeDrop(rosterPayload(17), ctx.id, slotHex)).toBe(true)
    expect(getCharacter(ctx.grid, slotHex)).toBe(toSynergyId(17))
    expect(roster(ctx.grid).map((r) => r.characterId)).toEqual([
      11,
      12,
      13,
      14,
      15,
      toSynergyId(17),
    ])
  })

  it('routeDrop treats a hero dropped onto its own tile as a no-op', () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(grids.placeOnActive(ALLY_A, Team.ALLY)).toBe(true)
    grids.synergy = true
    const hex = findCharacterHex(ctx.grid, ALLY_A, Team.ALLY)!

    expect(grids.canDropCharacter(ALLY_A, undefined, undefined, ctx.id, hex)).toBe(false)
    expect(grids.routeDrop(rosterPayload(ALLY_A), ctx.id, hex)).toBe(false)
    expect(roster(ctx.grid).map((r) => r.characterId)).toEqual([ALLY_A])
  })

  it('setGridCount re-derives the affordance from the rebuilt boards', () => {
    const { grids } = setupBoards(1)
    grids.synergy = true
    grids.setGridCount(1)
    expect(grids.synergy).toBe(false)
  })
})

describe('useGrids.loadTeamSide', () => {
  const board = (
    mains: [number, number, number?][],
    extra: Partial<SideLoadBoard> = {},
  ): SideLoadBoard => ({
    mains: mains.map(([unitId, hexId, paragon]) => ({ unitId, hexId, paragon: paragon ?? 0 })),
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

  it("applies saved paragon, resets stale paragon, and swaps only the destination side's artifact", () => {
    const { grids, a: ctx } = setupBoards(1)
    expect(ctx.place(1, 11, Team.ALLY)).toBe(true)
    ctx.setParagon(Team.ALLY, 11, 3)
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

    // 11 returns without a saved level: the lingering 3 must not resurface.
    expect(findCharacterHex(ctx.grid, 11, Team.ALLY)).toBe(2)
    expect(ctx.getParagon(Team.ALLY, 11)).toBe(0)
    expect(ctx.getParagon(Team.ALLY, 12)).toBe(4)
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
        boards: [
          board([[11, 1]], { phantimal: { unitId: toPhantimalId(1), hexId: 4, paragon: 0 } }),
        ],
      },
      { invert: false, scope: 'all' },
    )

    expect(findCharacterHex(ctx.grid, toPhantimalId(1), Team.ALLY)).toBe(4)
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

  it('strips the synergy unit when a 1v1 record loads into a mode without the Syn affordance', () => {
    const { grids } = setupBoards(5)
    grids.setActive(2)

    // A 1v1 record saved with Syn on: base heroes in c plus the synergy hero
    // (local base id) in y, the exact shape the serializer emits.
    const data = encodeMultiGridStateToUrl({
      boards: [
        {
          m: 'arena1',
          c: [
            [1, ALLY_A, Team.ALLY],
            [2, ALLY_B, Team.ALLY],
            [3, 13, Team.ALLY],
          ],
          y: [[6, 16, Team.ALLY]],
        },
      ],
      mode: '1v1',
    })
    const plan = buildSideLoadPlan(data, TEAM_MODES['5v5sl'].allowSynergy)!
    const result = grids.loadTeamSide(plan, { invert: false, scope: 'active' })

    expect(result).toEqual({ placed: 3, skipped: 0 })
    expect(roster(grids.contexts[2]!.grid).map((r) => r.characterId)).toEqual([ALLY_A, ALLY_B, 13])
    for (const ctx of grids.contexts) {
      expect(findCharacterHex(ctx.grid, toSynergyId(16), Team.ALLY)).toBeNull()
    }
    expect(grids.synergy).toBe(false)
  })
})
