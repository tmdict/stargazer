import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { findCharacterHex, getAvailableTeamSize } from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { createSpiritMarkSkill } from '@/lib/skills/seasonal/phantimal'
import {
  getCharacterSkill,
  registerSkill,
  SkillManager,
  type SkillContext,
  type SkillLookups,
} from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { placeOnTile, removeFromTile } from '../fixtures/skills'

// Test-only local ids no season uses, so the mechanics stay covered while a
// season lists no marks of its own.
const BEHIND_MARK = toPhantimalId(14)
const FRONT_MARK = toPhantimalId(15)
registerSkill(createSpiritMarkSkill(14, 'test-behind', 'behind'))
registerSkill(createSpiritMarkSkill(15, 'test-front', 'front'))

// Runs without phantimal gameData loaded: the skill path reads only the
// registry, grid tiles and the injected targeting switch (on unless a case
// turns it off).
describe('phantimal Spirit Mark skills', () => {
  let grid: Grid
  let skillManager: SkillManager
  const lookups: SkillLookups = { seasonalTargeting: () => true }

  const ctx = (hexId: number, characterId: number, team = Team.ALLY): SkillContext => ({
    grid,
    hexId,
    team,
    characterId,
    skillManager,
    lookups,
  })

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(lookups)
  })

  it('paints nothing while the phantimal targeting is switched off', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const off: SkillContext = { ...ctx(23, BEHIND_MARK), lookups: {} }

    getCharacterSkill(BEHIND_MARK)!.onActivate(off)
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('paints the marked tile in both channels on activate and clears both on deactivate', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(BEHIND_MARK)!

    skill.onActivate(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileColorModifier(16)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(16)).toHaveLength(1)

    skill.onDeactivate(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('follows the behind priority when the directly-behind tile is empty', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 20, 101, Team.ALLY)
    placeOnTile(grid, 19, 102, Team.ALLY)

    getCharacterSkill(BEHIND_MARK)!.onActivate(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileFillModifier(20)).toBeDefined()
    expect(skillManager.getTileFillModifier(19)).toBeUndefined()
  })

  it('paints nothing when no candidate tile holds a same-team unit', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 200, Team.ENEMY)

    getCharacterSkill(BEHIND_MARK)!.onActivate(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('marks the front-priority tile for a front mark (hex 4: 9 > 6 > 7)', () => {
    placeOnTile(grid, 4, FRONT_MARK, Team.ALLY)
    placeOnTile(grid, 9, 100, Team.ALLY)
    placeOnTile(grid, 6, 101, Team.ALLY)
    placeOnTile(grid, 7, 102, Team.ALLY)

    getCharacterSkill(FRONT_MARK)!.onActivate(ctx(4, FRONT_MARK))
    expect(skillManager.getTileFillModifier(9)).toBeDefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
    expect(skillManager.getTileFillModifier(7)).toBeUndefined()
  })

  it('moves the mark on update when the marked unit moves', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(BEHIND_MARK)!
    skill.onActivate(ctx(23, BEHIND_MARK))

    removeFromTile(grid, 16)
    placeOnTile(grid, 19, 100, Team.ALLY)

    skill.onUpdate!(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileColorModifier(19)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(19)).toHaveLength(1)
  })

  it('clears the mark on update when the marked unit is removed', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(BEHIND_MARK)!
    skill.onActivate(ctx(23, BEHIND_MARK))

    removeFromTile(grid, 16)

    skill.onUpdate!(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileColorModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('keeps the paint refcount at one across repeated updates', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(BEHIND_MARK)!

    skill.onActivate(ctx(23, BEHIND_MARK))
    skill.onUpdate!(ctx(23, BEHIND_MARK))
    skill.onUpdate!(ctx(23, BEHIND_MARK))
    expect(skillManager.getTileFillModifier(16)).toHaveLength(1)

    skill.onDeactivate(ctx(23, BEHIND_MARK))
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
    executePlaceCharacter(grid, skillManager, 4, BEHIND_MARK, Team.ALLY)
    expect(skillManager.getTileFillModifier(1)).toBeDefined()

    expect(executeMoveCharacter(grid, skillManager, 4, 37, BEHIND_MARK)).toBe(true)
    expect(skillManager.getTileColorModifier(1)).toBeUndefined()
    expect(skillManager.getTileFillModifier(1)).toBeUndefined()
    expect(skillManager.getTileColorModifier(42)).toBeDefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()
  })

  it('keeps paints independent when both teams field the same phantimal', () => {
    placeOnTile(grid, 23, BEHIND_MARK, Team.ALLY)
    placeOnTile(grid, 16, 100, Team.ALLY)
    placeOnTile(grid, 37, BEHIND_MARK, Team.ENEMY)
    placeOnTile(grid, 42, 200, Team.ENEMY)
    const skill = getCharacterSkill(BEHIND_MARK)!

    skill.onActivate(ctx(23, BEHIND_MARK, Team.ALLY))
    skill.onActivate(ctx(37, BEHIND_MARK, Team.ENEMY))
    expect(skillManager.getTileFillModifier(16)).toBeDefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()

    skill.onDeactivate(ctx(23, BEHIND_MARK, Team.ALLY))
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(42)).toBeDefined()

    skill.onDeactivate(ctx(37, BEHIND_MARK, Team.ENEMY))
    expect(skillManager.getTileFillModifier(42)).toBeUndefined()
  })
})

// Retire with the season's entries in src/lib/skills/seasonal/phantimal.ts.
describe('season 8', () => {
  const WEDGE_OF_MATTER = toPhantimalId(5)
  const WEDGE_OF_POWER = WEDGE_OF_MATTER + 10000

  beforeEach(() => {
    setActivePinia(createPinia())
    useGameDataStore().initializeContentData()
  })

  it('wedge of matter brings wedge of power, which holds no team slot', () => {
    const grid = new Grid()
    const skillManager = new SkillManager()
    expect(executePlaceCharacter(grid, skillManager, 16, WEDGE_OF_MATTER, Team.ALLY)).toBe(true)
    expect(findCharacterHex(grid, WEDGE_OF_POWER, Team.ALLY)).not.toBeNull()
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
  })

  it('wedge of power renders its own portrait and targets at range 20', () => {
    const gameData = useGameDataStore()
    expect(gameData.getPhantimalUnitSlug(WEDGE_OF_MATTER)).toBe('wedge-of-matter')
    expect(gameData.getPhantimalUnitSlug(WEDGE_OF_POWER)).toBe('wedge-of-power')
    expect(gameData.getCharacterRange(WEDGE_OF_POWER)).toBe(20)
    expect(gameData.getCharacterFaction(WEDGE_OF_POWER)).toBe('celestial')
    // Targeting is off until the in-game unlock; the companion answers for its owner.
    expect(gameData.hasSeasonalTargeting(WEDGE_OF_MATTER)).toBe(false)
    expect(gameData.hasSeasonalTargeting(WEDGE_OF_POWER)).toBe(false)
  })
})
