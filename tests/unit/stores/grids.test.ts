import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTilesWithCharacters } from '@/lib/characters/character'
import type { Grid } from '@/lib/grid'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { State } from '@/lib/types/state'
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
const KULU = 80 // skill blocks the demolition zone: ally 18-24, enemy 22-28

// (characterId, team) pairs on a board, order-independent (placement is random).
const roster = (grid: Grid): { characterId: number; team: Team }[] =>
  getTilesWithCharacters(grid)
    .map((tile) => ({ characterId: tile.characterId!, team: tile.team! }))
    .sort((a, b) => a.characterId - b.characterId)

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

  it('re-derives a tile-blocking skill zone on the destination, leaving no ghost', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts

    expect(a!.place(1, KULU, Team.ALLY)).toBe(true)
    expect(a!.grid.getTileById(18).state).toBe(State.BLOCKED)
    expect(a!.grid.getTileById(23).state).toBe(State.BLOCKED_BREAKABLE)

    grids.swapBoards(0, 1)

    // Kulu kept her team and moved to board b, where her zone re-derives.
    const kulu = getTilesWithCharacters(b!.grid).find((t) => t.characterId === KULU)
    expect(kulu?.team).toBe(Team.ALLY)
    for (const id of [18, 19, 20, 21]) expect(b!.grid.getTileById(id).state).toBe(State.BLOCKED)
    expect(b!.grid.getTileById(23).state).toBe(State.BLOCKED_BREAKABLE)

    // Source board's zone is clear again, not ghost-blocked.
    for (const id of [18, 19, 20, 21]) expect(a!.grid.getTileById(id).state).toBe(State.DEFAULT)
    expect(a!.grid.getTileById(23).state).toBe(State.DEFAULT)
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
