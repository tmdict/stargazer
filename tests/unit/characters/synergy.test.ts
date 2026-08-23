import { beforeEach, describe, expect, it } from 'vitest'

import {
  canPlaceCharacterOnTeam,
  findTeamSynergyHex,
  getAvailableTeamSize,
  resolvePlacement,
  synergySlotFree,
} from '@/lib/characters/character'
import { getMainCharacterId, isCompanionId } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter, resolveReplacement } from '@/lib/characters/place'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { decomposeUnitId, isSynergyHeroId, toSynergyId } from '@/lib/characters/synergy'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../fixtures/grid'

// Skill-less hero ids so placement exercises only the band rules.
const HEROES = [601, 602, 603, 604, 605]

const fillAllyTeam = (grid: Grid, sm: SkillManager): void => {
  HEROES.forEach((id, i) => {
    expect(executePlaceCharacter(grid, sm, i + 1, id, Team.ALLY)).toBe(true)
  })
}

describe('synergy id namespace', () => {
  it('decomposes the mirrored band', () => {
    expect(decomposeUnitId(50)).toEqual({ synergy: false, localId: 50 })
    expect(decomposeUnitId(200050)).toEqual({ synergy: true, localId: 50 })
    expect(decomposeUnitId(210050)).toEqual({ synergy: true, localId: 10050 })
  })

  it('distinguishes the slot occupant from its companions', () => {
    expect(isSynergyHeroId(200050)).toBe(true)
    expect(isSynergyHeroId(210050)).toBe(false)
    expect(isSynergyHeroId(50)).toBe(false)
    expect(isSynergyHeroId(100005)).toBe(false)
  })

  it('keeps phantimals bounded below the synergy band', () => {
    expect(isPhantimalId(100005)).toBe(true)
    expect(isPhantimalId(200050)).toBe(false)
    expect(isPhantimalId(210050)).toBe(false)
  })

  it('classifies companions in either band and cascades within it', () => {
    const grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
    expect(isCompanionId(grid, 20089)).toBe(true)
    expect(isCompanionId(grid, 210050)).toBe(true)
    expect(isCompanionId(grid, 200050)).toBe(false)
    expect(isCompanionId(grid, 100005)).toBe(false)
    expect(getMainCharacterId(grid, 20089)).toBe(89)
    expect(getMainCharacterId(grid, 210050)).toBe(200050)
    expect(getMainCharacterId(grid, 200050)).toBe(200050)
  })
})

describe('synergy placement rules', () => {
  let grid: Grid
  let sm: SkillManager

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
    sm = new SkillManager()
  })

  it('a synergy hero joins a full team', () => {
    fillAllyTeam(grid, sm)
    expect(canPlaceCharacterOnTeam(grid, 606, Team.ALLY)).toBe(false)
    expect(canPlaceCharacterOnTeam(grid, toSynergyId(606), Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, sm, 6, toSynergyId(606), Team.ALLY)).toBe(true)
  })

  it('a duplicate of a placed hero is allowed as the synergy copy', () => {
    expect(executePlaceCharacter(grid, sm, 1, 601, Team.ALLY)).toBe(true)
    expect(canPlaceCharacterOnTeam(grid, 601, Team.ALLY)).toBe(false)
    expect(canPlaceCharacterOnTeam(grid, toSynergyId(601), Team.ALLY)).toBe(true)
  })

  it('the slot is capped at one per team, independently per team', () => {
    expect(executePlaceCharacter(grid, sm, 1, toSynergyId(601), Team.ALLY)).toBe(true)
    expect(findTeamSynergyHex(grid, Team.ALLY)).toBe(1)
    expect(synergySlotFree(grid, Team.ALLY)).toBe(false)
    expect(canPlaceCharacterOnTeam(grid, toSynergyId(602), Team.ALLY)).toBe(false)
    expect(canPlaceCharacterOnTeam(grid, toSynergyId(602), Team.ENEMY)).toBe(true)
  })

  it('a synergy hero does not consume team capacity', () => {
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(5)
    expect(executePlaceCharacter(grid, sm, 1, toSynergyId(601), Team.ALLY)).toBe(true)
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(5)
  })
})

describe('resolvePlacement', () => {
  let grid: Grid
  let sm: SkillManager

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
    sm = new SkillManager()
  })

  it('prefers the base id when it passes the gate', () => {
    expect(resolvePlacement(grid, 601, Team.ALLY, true)).toBe(601)
  })

  it('falls back to the synergy id only when the affordance is on', () => {
    expect(executePlaceCharacter(grid, sm, 1, 601, Team.ALLY)).toBe(true)
    expect(resolvePlacement(grid, 601, Team.ALLY, true)).toBe(toSynergyId(601))
    expect(resolvePlacement(grid, 601, Team.ALLY, false)).toBe(null)
  })

  it('yields nothing once the slot is filled', () => {
    expect(executePlaceCharacter(grid, sm, 1, 601, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, sm, 2, toSynergyId(602), Team.ALLY)).toBe(true)
    expect(resolvePlacement(grid, 601, Team.ALLY, true)).toBe(null)
  })

  it('routes an overflow pick on a full team to the slot', () => {
    fillAllyTeam(grid, sm)
    expect(resolvePlacement(grid, 606, Team.ALLY, true)).toBe(toSynergyId(606))
    expect(resolvePlacement(grid, 606, Team.ALLY, false)).toBe(null)
  })
})

describe('resolveReplacement', () => {
  const PHRAESTO = 50
  let grid: Grid
  let sm: SkillManager

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
    sm = new SkillManager()
  })

  it('delegates an empty target to resolvePlacement', () => {
    expect(resolveReplacement(grid, 601, Team.ALLY, 1, false)).toBe(601)
  })

  it('vacating a base hero frees its capacity slot', () => {
    fillAllyTeam(grid, sm)
    expect(resolveReplacement(grid, 606, Team.ALLY, 1, false)).toBe(606)
  })

  it('vacating the synergy hero frees the assist slot but no capacity', () => {
    fillAllyTeam(grid, sm)
    expect(executePlaceCharacter(grid, sm, 6, toSynergyId(606), Team.ALLY)).toBe(true)
    expect(resolveReplacement(grid, 607, Team.ALLY, 6, true)).toBe(toSynergyId(607))
    expect(resolveReplacement(grid, 607, Team.ALLY, 6, false)).toBe(null)
  })

  it('vacating a phantimal frees nothing', () => {
    fillAllyTeam(grid, sm)
    expect(executePlaceCharacter(grid, sm, 6, toPhantimalId(1), Team.ALLY)).toBe(true)
    expect(resolveReplacement(grid, 606, Team.ALLY, 6, true)).toBe(toSynergyId(606))
    expect(resolveReplacement(grid, 606, Team.ALLY, 6, false)).toBe(null)
  })

  it('a duplicate replacing another hero resolves to the synergy copy', () => {
    expect(executePlaceCharacter(grid, sm, 1, 601, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, sm, 2, 602, Team.ALLY)).toBe(true)
    expect(resolveReplacement(grid, 601, Team.ALLY, 2, true)).toBe(toSynergyId(601))
    expect(resolveReplacement(grid, 601, Team.ALLY, 2, false)).toBe(null)
  })

  it('a hero dropped onto itself or its companion is a no-op', () => {
    expect(executePlaceCharacter(grid, sm, 1, PHRAESTO, Team.ALLY)).toBe(true)
    const companionHex = grid
      .getAllTiles()
      .find((tile) => tile.characterId === PHRAESTO + grid.companionIdOffset)!
      .hex.getId()
    expect(resolveReplacement(grid, PHRAESTO, Team.ALLY, 1, true)).toBe(null)
    expect(resolveReplacement(grid, PHRAESTO, Team.ALLY, companionHex, true)).toBe(null)
  })

  it('a hero dropped onto its own synergy copy converts it to the base hero, given room', () => {
    expect(executePlaceCharacter(grid, sm, 6, toSynergyId(606), Team.ALLY)).toBe(true)
    expect(resolveReplacement(grid, 606, Team.ALLY, 6, true)).toBe(606)
    fillAllyTeam(grid, sm)
    expect(resolveReplacement(grid, 606, Team.ALLY, 6, true)).toBe(null)
  })
})

describe('synergy move and swap guards', () => {
  let grid: Grid
  let sm: SkillManager

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
    sm = new SkillManager()
    executePlaceCharacter(grid, sm, 1, toSynergyId(601), Team.ALLY)
  })

  it('moves freely within its team but never across', () => {
    expect(executeMoveCharacter(grid, sm, 1, 2, toSynergyId(601))).toBe(true)
    expect(executeMoveCharacter(grid, sm, 2, 9, toSynergyId(601))).toBe(false)
  })

  it('swaps within its team but never across', () => {
    expect(executePlaceCharacter(grid, sm, 2, 602, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, sm, 9, 603, Team.ENEMY)).toBe(true)
    expect(executeSwapCharacters(grid, sm, 1, 2)).toBe(true)
    expect(executeSwapCharacters(grid, sm, 2, 9)).toBe(false)
  })
})
