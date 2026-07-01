import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getCharacter, getTilesWithCharacters } from '@/lib/characters/character'
import type { Grid } from '@/lib/grid'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'

/**
 * Tests for grids.swapBoards: exchanging two 5 v 5 boards' rosters while keeping
 * each unit's team. Boards default to arena1 (ally spawns 1-10/12/13/16, enemy
 * spawns 30/33/34/36-45). Skills are code-registered, so Kulu/Phraesto behave
 * without loaded game data.
 */

// Character ids with no registered skill (placement has no side effects).
const ALLY_A = 11
const ALLY_B = 12
const ENEMY_A = 21
const ENEMY_B = 22

const PHRAESTO = 50
const PHRAESTO_COMPANION = COMPANION_ID_OFFSET + PHRAESTO
const KULU = 80 // cosmetic demolition zone: ally 18-24, enemy 22-28

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

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGrids.swapBoards', () => {
  it('exchanges the two boards rosters, keeping each unit on its own team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts

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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
    grids.setActive(0)
    grids.contexts[0]!.place(1, ALLY_A, Team.ALLY)

    grids.swapBoards(0, 1)

    expect(grids.activeId).toBe(1)
  })

  it('rejects a swap of a board with itself', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    expect(grids.swapBoards(1, 1)).toBe(false)
  })

  it('re-derives a cosmetic skill zone on the destination, leaving no ghost', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts

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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts

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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    a!.setArtifact(Team.ALLY, 3)
    b!.setArtifact(Team.ALLY, 7)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ALLY)).toBe(
      true,
    )

    expect(a!.artifacts.ally).toBe(7)
    expect(b!.artifacts.ally).toBe(3)
  })

  it('rejects a cross-team drop that would duplicate an artifact on a team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [, b] = grids.contexts
    b!.setArtifact(Team.ALLY, 7)

    expect(grids.routeArtifactDrop({ sourceCtxId: 0, sourceTeam: Team.ALLY }, 1, Team.ALLY)).toBe(
      false,
    )
    expect(b!.artifacts.ally).toBe(7)
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ENEMY_A, Team.ENEMY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(getCharacter(a!.grid, 1)).toBe(ENEMY_A)
  })

  it('rejects a cross-board cross-team move that would duplicate a character on a team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(a!.place(40, ALLY_A, Team.ENEMY)).toBe(true)

    // Moving a's ally copy onto an empty enemy tile on b would duplicate it on enemy.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(b!.grid.getTileById(41).characterId).toBeUndefined()
  })

  it('allows a cross-board cross-team move when uniqueness holds', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).characterId).toBeUndefined()
  })

  it('allows a cross-board same-team move', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 2)).toBe(true)

    expect(getCharacter(b!.grid, 2)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).characterId).toBeUndefined()
  })

  it('allows swapping the same hero between its two legal cross-board placements', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ALLY_A, Team.ENEMY)).toBe(true)

    // The destination-board exclusion in isUsed exists for exactly this: each
    // leg's scan would otherwise find the counterpart copy, which is itself
    // vacating, and false-reject the swap.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(a!.grid.getTileById(1).team).toBe(Team.ALLY)
    expect(getCharacter(b!.grid, 41)).toBe(ALLY_A)
    expect(b!.grid.getTileById(41).team).toBe(Team.ENEMY)
  })

  it('rejects a companion dragged to another board', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, PHRAESTO, Team.ALLY)).toBe(true)
    const companionHex = getTilesWithCharacters(a!.grid)
      .find((t) => t.characterId === PHRAESTO_COMPANION)!
      .hex.getId()

    expect(grids.routeDrop(dragPayload(0, companionHex, PHRAESTO_COMPANION), 1, 2)).toBe(false)

    expect(getCharacter(a!.grid, companionHex)).toBe(PHRAESTO_COMPANION)
    expect(b!.grid.getTileById(2).characterId).toBeUndefined()
  })

  it('rejects a cross-board move into a full team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    a!.setParagon(Team.ALLY, ALLY_A, 4)

    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 1, 41)).toBe(true)

    expect(b!.getParagon(Team.ENEMY, ALLY_A)).toBe(4)
    expect(a!.getParagon(Team.ALLY, ALLY_A)).toBe(0)
  })

  it('swaps paragon levels with the swapped heroes', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
})

describe('useGrids.routeDrop same-board uniqueness', () => {
  it('rejects a same-board cross-team move that would duplicate a character on a team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(41, ALLY_A, Team.ENEMY)).toBe(true)

    // Moving a's ally copy onto one of a's own enemy tiles would put ALLY_A on
    // the enemy team of both boards.
    expect(grids.routeDrop(dragPayload(0, 1, ALLY_A), 0, 40)).toBe(false)

    expect(getCharacter(a!.grid, 1)).toBe(ALLY_A)
    expect(a!.grid.getTileById(40).characterId).toBeUndefined()
  })

  it('rejects a same-board swap whose displaced unit would duplicate on a team', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
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
