import { beforeEach, describe, expect, it } from 'vitest'

import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { executeRemoveCharacter } from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Kulu (80, Demolition Zone) paints a cosmetic per-team zone: tiles are tinted and
// outlined but keep their state, so they stay placeable. The two zones overlap on
// 22/23/24, which both teams paint with the same colors.
const KULU = 80
const ALLY_ONLY = [18, 19, 20, 21]
const ENEMY_ONLY = [25, 26, 27, 28]
const SHARED = [22, 23, 24]
const ALL_AFFECTED = [...ALLY_ONLY, ...ENEMY_ONLY, ...SHARED]

describe('kulu (Demolition Zone)', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  it('paints its zone on activation and clears it on removal, leaving tile state untouched', () => {
    const originalStates = new Map(ALL_AFFECTED.map((id) => [id, grid.getTileById(id).state]))

    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    for (const id of [...ALLY_ONLY, ...SHARED]) {
      expect(skillManager.getTileColorModifier(id)).toBeDefined()
      expect(skillManager.getTileFillModifier(id)).toBeDefined()
      expect(grid.getTileById(id).state).toBe(originalStates.get(id))
    }

    expect(executeRemoveCharacter(grid, skillManager, 1)).toBe(true)

    for (const id of [...ALLY_ONLY, ...SHARED]) {
      expect(skillManager.getTileColorModifier(id)).toBeUndefined()
      expect(skillManager.getTileFillModifier(id)).toBeUndefined()
    }
  })

  it('paints the breakable tile a different color than the blocked tiles', () => {
    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)

    expect(skillManager.getTileColorModifier(23)![0]).not.toBe(
      skillManager.getTileColorModifier(18)![0],
    )
  })

  it('keeps shared tiles painted while the other zone is active', () => {
    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
    executePlaceCharacter(grid, skillManager, 45, KULU, Team.ENEMY)

    expect(executeRemoveCharacter(grid, skillManager, 1)).toBe(true)

    for (const id of ALLY_ONLY) expect(skillManager.getTileColorModifier(id)).toBeUndefined()
    for (const id of [...SHARED, ...ENEMY_ONLY]) {
      expect(skillManager.getTileColorModifier(id)).toBeDefined()
    }
  })

  it('clears every tile once both teams leave', () => {
    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
    executePlaceCharacter(grid, skillManager, 45, KULU, Team.ENEMY)

    expect(executeRemoveCharacter(grid, skillManager, 1)).toBe(true)
    expect(executeRemoveCharacter(grid, skillManager, 45)).toBe(true)

    for (const id of ALL_AFFECTED) {
      expect(skillManager.getTileColorModifier(id)).toBeUndefined()
      expect(skillManager.getTileFillModifier(id)).toBeUndefined()
    }
  })

  it('leaves a character standing on an affected tile in place', () => {
    grid.getTileById(20).state = State.AVAILABLE_ALLY
    expect(performPlace(grid, 20, 100, Team.ALLY)).toBe(true)

    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    expect(grid.getTileById(20).characterId).toBe(100)
    expect(grid.getTileById(20).state).toBe(State.OCCUPIED_ALLY)
    expect(skillManager.getTileColorModifier(20)).toBeDefined()
  })

  it('allows placing a character on an affected tile', () => {
    grid.getTileById(20).state = State.AVAILABLE_ALLY
    expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)

    expect(performPlace(grid, 20, 100, Team.ALLY)).toBe(true)
    expect(grid.getTileById(20).characterId).toBe(100)
  })

  it('stays put when placed inside its own zone', () => {
    grid.getTileById(20).state = State.AVAILABLE_ALLY

    expect(executePlaceCharacter(grid, skillManager, 20, KULU, Team.ALLY)).toBe(true)

    expect(grid.getTileById(20).characterId).toBe(KULU)
    expect(grid.getTileById(20).state).toBe(State.OCCUPIED_ALLY)
    expect(skillManager.hasActiveSkill(KULU, Team.ALLY)).toBe(true)
  })

  it('keeps zone paint isolated per grid', () => {
    const gridB = new Grid()
    const managerB = new SkillManager()
    gridB.skillManager = managerB

    executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
    for (const id of ALLY_ONLY) expect(managerB.getTileColorModifier(id)).toBeUndefined()

    executeRemoveCharacter(grid, skillManager, 1)
    for (const id of ALLY_ONLY) expect(skillManager.getTileColorModifier(id)).toBeUndefined()
  })
})
