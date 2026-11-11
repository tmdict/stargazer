import { beforeEach, describe, expect, it } from 'vitest'

import { getMaxTeamSize } from '@/lib/characters/character'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { SkillManager, type SkillContext, type SkillTargetInfo } from '@/lib/skills/skill'
import {
  createCompanionSkill,
  createTargetingSkill,
  createTileHighlightSkill,
} from '@/lib/skills/utils/builders'
import { Team } from '@/lib/types/team'
import { NO_LOOKUPS } from '../../fixtures/skills'

const CHARACTER_ID = 999
const CASTER_HEX = 5

const buildContext = (grid: Grid, skillManager: SkillManager): SkillContext => ({
  grid,
  hexId: CASTER_HEX,
  team: Team.ALLY,
  characterId: CHARACTER_ID,
  skillManager,
  lookups: NO_LOOKUPS,
})

describe('createTargetingSkill', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  describe('with arrowType', () => {
    const buildSkill = (calculateTarget: (ctx: SkillContext) => SkillTargetInfo | null) =>
      createTargetingSkill({
        id: 'test',
        characterId: CHARACTER_ID,
        color: '#000',
        arrowType: 'ally',
        calculateTarget,
      })

    it('clears target on onUpdate when target is missed', () => {
      let value: SkillTargetInfo | null = { targetHexId: 3, targetCharacterId: 42 }
      const skill = buildSkill(() => value)
      skill.onActivate(buildContext(grid, skillManager))
      value = null
      skill.onUpdate!(buildContext(grid, skillManager))
      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    })
  })
})

describe('createTileHighlightSkill', () => {
  let grid: Grid
  let skillManager: SkillManager
  const TILE_COLOR = '#abcdef'

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  const buildSkill = (calculateTarget: (ctx: SkillContext) => SkillTargetInfo | null) =>
    createTileHighlightSkill({
      id: 'test',
      characterId: CHARACTER_ID,
      tileColor: TILE_COLOR,
      calculateTarget,
    })

  it('removes previous tile color before applying new one on update', () => {
    let next = 3
    const skill = buildSkill(() => ({ targetHexId: next, targetCharacterId: 42 }))
    skill.onActivate(buildContext(grid, skillManager))
    expect(skillManager.getTileColorModifier(3)).toContain(TILE_COLOR)

    next = 4
    skill.onUpdate!(buildContext(grid, skillManager))
    expect(skillManager.getTileColorModifier(3)).toBeUndefined()
    expect(skillManager.getTileColorModifier(4)).toContain(TILE_COLOR)
  })

  it('clears target and removes tile color on update miss', () => {
    let value: SkillTargetInfo | null = { targetHexId: 3, targetCharacterId: 42 }
    const skill = buildSkill(() => value)
    skill.onActivate(buildContext(grid, skillManager))
    value = null
    skill.onUpdate!(buildContext(grid, skillManager))

    expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    expect(skillManager.getTileColorModifier(3)).toBeUndefined()
  })

  it('paints the fill channel instead of the border when fill is set', () => {
    const skill = createTileHighlightSkill({
      id: 'test',
      characterId: CHARACTER_ID,
      tileColor: TILE_COLOR,
      fill: true,
      calculateTarget: () => ({ targetHexId: 3, targetCharacterId: 42 }),
    })
    skill.onActivate(buildContext(grid, skillManager))

    expect(skillManager.getTileFillModifier(3)).toContain(TILE_COLOR)
    expect(skillManager.getTileColorModifier(3)).toBeUndefined()

    skill.onDeactivate(buildContext(grid, skillManager))
    expect(skillManager.getTileFillModifier(3)).toBeUndefined()
  })
})

describe('createCompanionSkill', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(NO_LOOKUPS)
    grid.skillManager = skillManager
  })

  const makeSkill = (overrides: Partial<Parameters<typeof createCompanionSkill>[0]> = {}) =>
    createCompanionSkill({
      id: 'test-companion',
      characterId: CHARACTER_ID,
      companionImageModifier: 'companion-art',
      ...overrides,
    })

  const context = (): SkillContext => ({
    grid,
    hexId: CASTER_HEX,
    team: Team.ALLY,
    characterId: CHARACTER_ID,
    skillManager,
    lookups: NO_LOOKUPS,
  })

  const companionTiles = () =>
    grid.getAllTiles().filter((t) => t.characterId !== undefined && t.characterId > 10000)

  it('places count companions with namespaced IDs on distinct tiles', () => {
    makeSkill({ count: 2 }).onActivate(context())

    const placed = companionTiles()
    expect(placed.map((t) => t.characterId).sort((a, b) => a! - b!)).toEqual([
      grid.companionIdOffset + CHARACTER_ID,
      2 * grid.companionIdOffset + CHARACTER_ID,
    ])
    expect(new Set(placed.map((t) => t.hex.getId())).size).toBe(2)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE + 2)
  })
})
