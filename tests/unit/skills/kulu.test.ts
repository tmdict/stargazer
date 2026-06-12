import { beforeEach, describe, expect, it, vi } from 'vitest'

import { findCharacterHex } from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { executeRemoveCharacter } from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Kulu (80, Demolition Zone) blocks a per-team zone of middle tiles.
// The two zones overlap on tiles 22/23/24, which both teams can claim at once.
const KULU = 80
const ALLY_ONLY = [18, 19, 20, 21]
const ENEMY_ONLY = [25, 26, 27, 28]
const SHARED = [22, 23, 24]
const ALL_AFFECTED = [...ALLY_ONLY, ...ENEMY_ONLY, ...SHARED]

describe('kulu (Demolition Zone)', () => {
  let grid: Grid
  let skillManager: SkillManager
  let originalStates: Map<number, State>

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    grid.skillManager = skillManager
    originalStates = new Map(ALL_AFFECTED.map((id) => [id, grid.getTileById(id).state]))
  })

  it('blocks its zone on activation and restores it on removal', () => {
    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    for (const id of [...ALLY_ONLY, 22, 24]) {
      expect(grid.getTileById(id).state).toBe(State.BLOCKED)
    }
    expect(grid.getTileById(23).state).toBe(State.BLOCKED_BREAKABLE)
    expect(skillManager.getTileColorModifier(22)).toBeDefined()

    expect(executeRemoveCharacter(grid, skillManager, 1)).toBe(true)

    for (const id of [...ALLY_ONLY, ...SHARED]) {
      expect(grid.getTileById(id).state).toBe(originalStates.get(id))
    }
    expect(skillManager.getTileColorModifier(22)).toBeUndefined()
  })

  it('restores the shared middle tiles when both teams fielded kulu', () => {
    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, skillManager, 45, KULU, Team.ENEMY)).toBe(true)

    expect(executeRemoveCharacter(grid, skillManager, 1)).toBe(true)
    expect(executeRemoveCharacter(grid, skillManager, 45)).toBe(true)

    // With no kulu on the field, every affected tile is back to its original state
    for (const [id, state] of originalStates) {
      expect(grid.getTileById(id).state).toBe(state)
    }
    for (const id of SHARED) {
      expect(skillManager.getTileColorModifier(id)).toBeUndefined()
    }
  })

  it('keeps shared tiles blocked and highlighted while the other zone is active', () => {
    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
    executePlaceCharacter(grid, skillManager, 45, KULU, Team.ENEMY)

    executeRemoveCharacter(grid, skillManager, 1)

    // Ally-exclusive tiles restored
    for (const id of ALLY_ONLY) {
      expect(grid.getTileById(id).state).toBe(originalStates.get(id))
    }
    // Shared tiles still claimed by the enemy zone, highlight intact
    expect(grid.getTileById(22).state).toBe(State.BLOCKED)
    expect(grid.getTileById(23).state).toBe(State.BLOCKED_BREAKABLE)
    expect(grid.getTileById(24).state).toBe(State.BLOCKED)
    for (const id of SHARED) {
      expect(skillManager.getTileColorModifier(id)).toBeDefined()
    }
    // Enemy-exclusive tiles untouched
    for (const id of ENEMY_ONLY) {
      expect(grid.getTileById(id).state).toBe(State.BLOCKED)
    }
  })

  it('removes characters standing on affected tiles', () => {
    // The default map has no placeable zone tiles; open one up like the
    // arenas where the zone overlaps a deployable area
    grid.getTileById(20).state = State.AVAILABLE_ALLY
    expect(performPlace(grid, 20, 100, Team.ALLY)).toBe(true)

    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    expect(grid.getTileById(20).state).toBe(State.BLOCKED)
    expect(grid.getTileById(20).characterId).toBeUndefined()
    expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
  })

  it('removes the main character when a companion stands on an affected tile', () => {
    const PHRAESTO = 50
    grid.getTileById(20).state = State.AVAILABLE_ALLY
    expect(executePlaceCharacter(grid, skillManager, 2, PHRAESTO, Team.ALLY)).toBe(true)
    const companionId = grid.companionIdOffset + PHRAESTO
    // The companion spawns on a random free ally tile, possibly hex 20 itself
    const spawnHex = findCharacterHex(grid, companionId, Team.ALLY)!
    if (spawnHex !== 20) {
      executeMoveCharacter(grid, skillManager, spawnHex, 20, companionId)
    }
    expect(findCharacterHex(grid, companionId, Team.ALLY)).toBe(20)

    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    // Cascade: companion removal deactivates and removes its main as well
    expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(false)
    expect(findCharacterHex(grid, PHRAESTO, Team.ALLY)).toBeNull()
    expect(findCharacterHex(grid, companionId, Team.ALLY)).toBeNull()
  })

  it('relocates kulu when she is placed inside her own zone', () => {
    grid.getTileById(20).state = State.AVAILABLE_ALLY

    expect(executePlaceCharacter(grid, skillManager, 20, KULU, Team.ALLY)).toBe(true)

    expect(grid.getTileById(20).state).toBe(State.BLOCKED)
    expect(grid.getTileById(20).characterId).toBeUndefined()
    const kuluTile = grid.getAllTiles().find((t) => t.characterId === KULU)
    expect(kuluTile).toBeDefined()
    expect(ALL_AFFECTED).not.toContain(kuluTile!.hex.getId())
    expect(kuluTile!.team).toBe(Team.ALLY)
    expect(skillManager.hasActiveSkill(KULU, Team.ALLY)).toBe(true)
  })

  it('fails activation without side effects when no relocation target exists', () => {
    grid.getTileById(20).state = State.AVAILABLE_ALLY
    // Occupy every ally tile outside the zone so relocation has nowhere to go
    for (const tile of grid.getAllTiles()) {
      if (tile.state === State.AVAILABLE_ALLY && tile.hex.getId() !== 20) {
        tile.characterId = 1000 + tile.hex.getId()
      }
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = executePlaceCharacter(grid, skillManager, 20, KULU, Team.ALLY)

    expect(result).toBe(false)
    expect(skillManager.hasActiveSkill(KULU, Team.ALLY)).toBe(false)
    expect(grid.getTileById(20).characterId).toBeUndefined()
    // The pre-check throws before any tile is claimed or blocked
    for (const [id, state] of originalStates) {
      if (id === 20) continue
      expect(grid.getTileById(id).state).toBe(state)
    }

    consoleSpy.mockRestore()
  })

  it('keeps zone state isolated per grid', () => {
    const gridB = new Grid()
    const managerB = new SkillManager()
    gridB.skillManager = managerB

    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
    executePlaceCharacter(gridB, managerB, 1, KULU, Team.ALLY)

    executeRemoveCharacter(grid, skillManager, 1)
    executeRemoveCharacter(gridB, managerB, 1)

    for (const id of [...ALLY_ONLY, ...SHARED]) {
      expect(grid.getTileById(id).state).toBe(originalStates.get(id))
      expect(gridB.getTileById(id).state).toBe(originalStates.get(id))
    }
  })
})
