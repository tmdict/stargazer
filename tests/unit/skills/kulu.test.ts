import { beforeEach, describe, expect, it } from 'vitest'

import { executePlaceCharacter } from '@/lib/characters/place'
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
