import { beforeEach, describe, expect, it } from 'vitest'

import { executeMoveCharacter } from '@/lib/characters/move'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { getCharacterSkill, hasSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const AURELIAN = toPhantimalId(1)
const NECRODRAKON = toPhantimalId(4)

// Runs without phantimal gameData loaded: the skill path reads only the
// registry and grid tiles.
describe('phantimal Spirit Mark skills', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (hexId: number, characterId: number, team = Team.ALLY): SkillContext => ({
    grid,
    hexId,
    team,
    characterId,
    skillManager,
  })

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  it('registers a skill for every phantimal id', () => {
    for (const localId of [1, 2, 3, 4, 5]) {
      expect(hasSkill(toPhantimalId(localId))).toBe(true)
    }
  })

  it('paints the marked tile in both channels on activate and clears both on deactivate', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(AURELIAN)!

    skill.onActivate(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(16)).toHaveLength(1)

    skill.onDeactivate(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('follows the behind priority when the directly-behind tile is empty', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 20, 101, Team.ALLY)
    placeOnTile(grid, 19, 102, Team.ALLY)

    getCharacterSkill(AURELIAN)!.onActivate(ctx(23, AURELIAN))
    expect(skillManager.getTileFillModifier(20)).toBeDefined()
    expect(skillManager.getTileFillModifier(19)).toBeUndefined()
  })

  it('marks a companion on the priority tile', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 10100, Team.ALLY)

    getCharacterSkill(AURELIAN)!.onActivate(ctx(23, AURELIAN))
    expect(skillManager.getTileFillModifier(16)).toBeDefined()
  })

  it('paints nothing when no candidate tile holds a same-team unit', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 200, Team.ENEMY)

    getCharacterSkill(AURELIAN)!.onActivate(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('marks the front-priority tile for necrodrakon (hex 4: 9 > 6 > 7)', () => {
    placeOnTile(grid, 4, NECRODRAKON, Team.ALLY)
    placeOnTile(grid, 9, 100, Team.ALLY)
    placeOnTile(grid, 6, 101, Team.ALLY)
    placeOnTile(grid, 7, 102, Team.ALLY)

    getCharacterSkill(NECRODRAKON)!.onActivate(ctx(4, NECRODRAKON))
    expect(skillManager.getTileFillModifier(9)).toBeDefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
    expect(skillManager.getTileFillModifier(7)).toBeUndefined()
  })

  it('moves the mark on update when the marked unit moves', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(AURELIAN)!
    skill.onActivate(ctx(23, AURELIAN))

    const from = grid.getTileById(16)
    from.characterId = undefined
    from.team = undefined
    placeOnTile(grid, 19, 100, Team.ALLY)

    skill.onUpdate!(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileColorModifier(19)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(19)).toHaveLength(1)
  })

  it('clears the mark on update when the marked unit is removed', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(AURELIAN)!
    skill.onActivate(ctx(23, AURELIAN))

    const tile = grid.getTileById(16)
    tile.characterId = undefined
    tile.team = undefined

    skill.onUpdate!(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('keeps the paint refcount at one across repeated updates', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(AURELIAN)!

    skill.onActivate(ctx(23, AURELIAN))
    skill.onUpdate!(ctx(23, AURELIAN))
    skill.onUpdate!(ctx(23, AURELIAN))
    expect(skillManager.getTileFillModifier(16)).toHaveLength(1)

    skill.onDeactivate(ctx(23, AURELIAN))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('re-keys the mark when a phantimal moves cross-team through the execute ops', () => {
    // End-to-end over performCrossTeamMove: phantimal skills are registry-gated
    // like hero skills, so a cross-team move deactivates under the old team key
    // and reactivates under the new. Unit IDs 900/901 have no registered skill;
    // arena1 zones: ally hexes 4 and 1, enemy hexes 37 and 42.
    executePlaceCharacter(grid, skillManager, 1, 900, Team.ALLY)
    executePlaceCharacter(grid, skillManager, 42, 901, Team.ENEMY)
    executePlaceCharacter(grid, skillManager, 4, AURELIAN, Team.ALLY)
    expect(skillManager.getTileFillModifier(1)).toBeDefined()

    expect(executeMoveCharacter(grid, skillManager, 4, 37, AURELIAN)).toBe(true)
    expect(skillManager.getTileColorModifier(1)).toBeUndefined()
    expect(skillManager.getTileFillModifier(1)).toBeUndefined()
    expect(skillManager.getTileColorModifier(42)).toBeDefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()
  })

  it('keeps paints independent when both teams field the same phantimal', () => {
    placeOnTile(grid, 23, AURELIAN, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    placeOnTile(grid, 37, AURELIAN, Team.ENEMY)
    placeOnTile(grid, 42, 200, Team.ENEMY)
    const skill = getCharacterSkill(AURELIAN)!

    skill.onActivate(ctx(23, AURELIAN, Team.ALLY))
    skill.onActivate(ctx(37, AURELIAN, Team.ENEMY))
    expect(skillManager.getTileFillModifier(16)).toBeDefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()

    skill.onDeactivate(ctx(23, AURELIAN, Team.ALLY))
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()

    skill.onDeactivate(ctx(37, AURELIAN, Team.ENEMY))
    expect(skillManager.getTileFillModifier(42)).toBeUndefined()
  })
})
