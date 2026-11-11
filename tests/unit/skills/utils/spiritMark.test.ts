import { beforeEach, describe, expect, it } from 'vitest'

import { addCompanionLink } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { COMPANION_ID_OFFSET, Grid } from '@/lib/grid'
import {
  getCharacterSkill,
  registerSkill,
  SkillManager,
  type SkillContext,
  type SkillLookups,
} from '@/lib/skills/skill'
import { createSpiritMarkSkill, spiritMarkTiles } from '@/lib/skills/utils/spiritMark'
import { Team } from '@/lib/types/team'
import { NO_LOOKUPS, placeOnTile, removeFromTile } from '../../fixtures/skills'

// Test-only local ids no season uses, so the mechanics stay covered whatever
// the season's phantimals.
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
  const lookups: SkillLookups = { ...NO_LOOKUPS, seasonalTargeting: () => true }

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
    const off: SkillContext = { ...ctx(23, BEHIND_MARK), lookups: NO_LOOKUPS }

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

  it('passes over a phantimal-range unit to the next tile in the chain', () => {
    placeOnTile(grid, 4, FRONT_MARK, Team.ALLY)
    placeOnTile(grid, 9, toPhantimalId(1), Team.ALLY)
    placeOnTile(grid, 6, 101, Team.ALLY)

    getCharacterSkill(FRONT_MARK)!.onActivate(ctx(4, FRONT_MARK))
    expect(skillManager.getTileFillModifier(9)).toBeUndefined()
    expect(skillManager.getTileFillModifier(6)).toBeDefined()
  })

  it("marks a hero's companion", () => {
    placeOnTile(grid, 4, FRONT_MARK, Team.ALLY)
    placeOnTile(grid, 9, COMPANION_ID_OFFSET + 100, Team.ALLY)

    getCharacterSkill(FRONT_MARK)!.onActivate(ctx(4, FRONT_MARK))
    expect(skillManager.getTileFillModifier(9)).toBeDefined()
  })

  describe('with a companion that marks too', () => {
    const COMPANION = FRONT_MARK + COMPANION_ID_OFFSET

    // Hex 4 marks forward over 9 > 6 > 7 and hex 16 backward over 9 > 13 > 12,
    // so both reach hex 9 first.
    const markedTiles = (): number[] => {
      placeOnTile(grid, 4, FRONT_MARK, Team.ALLY)
      placeOnTile(grid, 16, COMPANION, Team.ALLY)
      addCompanionLink(grid, FRONT_MARK, COMPANION, Team.ALLY)
      const tiles = spiritMarkTiles(ctx(4, FRONT_MARK), 'front', 'behind')
      return tiles.filter(({ fill }) => !fill).map(({ hexId }) => hexId)
    }

    it('gives the hero both chains reach to the phantimal, and the companion the next hero in its chain', () => {
      placeOnTile(grid, 9, 100, Team.ALLY)
      placeOnTile(grid, 13, 101, Team.ALLY)
      expect(markedTiles()).toEqual([9, 13])
    })

    it('marks a second copy of a placeholder, which shares the unit id of the first', () => {
      placeOnTile(grid, 9, 100, Team.ALLY)
      placeOnTile(grid, 13, 100, Team.ALLY)
      expect(markedTiles()).toEqual([9, 13])
    })

    it('draws no second mark when the only hero in its chain holds one', () => {
      placeOnTile(grid, 9, 100, Team.ALLY)
      expect(markedTiles()).toEqual([9])
    })
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
