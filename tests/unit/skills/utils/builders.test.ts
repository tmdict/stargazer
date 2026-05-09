import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { SkillManager, type SkillContext, type SkillTargetInfo } from '@/lib/skills/skill'
import { createTargetingSkill, createTileHighlightSkill } from '@/lib/skills/utils/builders'
import { Team } from '@/lib/types/team'

const CHARACTER_ID = 999
const CASTER_HEX = 5

const buildContext = (
  grid: Grid,
  skillManager: SkillManager,
  team: Team = Team.ALLY,
): SkillContext => ({
  grid,
  hexId: CASTER_HEX,
  team,
  characterId: CHARACTER_ID,
  skillManager,
})

describe('createTargetingSkill', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  it('exposes static fields from config', () => {
    const skill = createTargetingSkill({
      id: 'test',
      characterId: CHARACTER_ID,
      name: 'Test Skill',
      description: 'Test description',
      color: '#abcdef',
      arrowType: 'ally',
      calculateTarget: () => null,
    })

    expect(skill.id).toBe('test')
    expect(skill.characterId).toBe(CHARACTER_ID)
    expect(skill.name).toBe('Test Skill')
    expect(skill.description).toBe('Test description')
    expect(skill.targetingColorModifier).toBe('#abcdef')
  })

  describe('with arrowType', () => {
    const buildSkill = (calculateTarget: (ctx: SkillContext) => SkillTargetInfo | null) =>
      createTargetingSkill({
        id: 'test',
        characterId: CHARACTER_ID,
        name: 'Test',
        description: '',
        color: '#000',
        arrowType: 'ally',
        calculateTarget,
      })

    it('sets target with single arrow on activation when target is hit', () => {
      const skill = buildSkill(() => ({
        targetHexId: 3,
        targetCharacterId: 42,
      }))
      skill.onActivate(buildContext(grid, skillManager))

      const stored = skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)
      expect(stored?.targetHexId).toBe(3)
      expect(stored?.metadata?.arrows).toEqual([
        { fromHexId: CASTER_HEX, toHexId: 3, type: 'ally' },
      ])
    })

    it('does not set target when calculateTarget returns null', () => {
      const skill = buildSkill(() => null)
      skill.onActivate(buildContext(grid, skillManager))
      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    })

    it('does not set target when targetHexId is null', () => {
      const skill = buildSkill(() => ({ targetHexId: null, targetCharacterId: null }))
      skill.onActivate(buildContext(grid, skillManager))
      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    })

    it('preserves existing metadata alongside arrows', () => {
      const skill = buildSkill(() => ({
        targetHexId: 2,
        targetCharacterId: 7,
        metadata: { isFrontmostTarget: true, examinedTiles: [1, 2] },
      }))
      skill.onActivate(buildContext(grid, skillManager))

      const stored = skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)
      expect(stored?.metadata?.isFrontmostTarget).toBe(true)
      expect(stored?.metadata?.examinedTiles).toEqual([1, 2])
      expect(stored?.metadata?.arrows).toHaveLength(1)
    })

    it('uses configured arrow type', () => {
      const skill = createTargetingSkill({
        id: 'test',
        characterId: CHARACTER_ID,
        name: 'Test',
        description: '',
        color: '#000',
        arrowType: 'enemy',
        calculateTarget: () => ({ targetHexId: 3, targetCharacterId: 42 }),
      })
      skill.onActivate(buildContext(grid, skillManager))

      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)?.metadata?.arrows).toEqual([
        { fromHexId: CASTER_HEX, toHexId: 3, type: 'enemy' },
      ])
    })

    it('clears target on deactivation', () => {
      const skill = buildSkill(() => ({ targetHexId: 3, targetCharacterId: 42 }))
      skill.onActivate(buildContext(grid, skillManager))
      skill.onDeactivate(buildContext(grid, skillManager))
      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    })

    it('updates target on onUpdate when target is hit', () => {
      let next = 3
      const skill = buildSkill(() => ({ targetHexId: next, targetCharacterId: 42 }))
      skill.onActivate(buildContext(grid, skillManager))
      next = 4
      skill.onUpdate!(buildContext(grid, skillManager))
      expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)?.targetHexId).toBe(4)
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

  describe('without arrowType (custom calculate builds own arrows)', () => {
    it('stores target as-is without injecting an arrow', () => {
      const customArrows = [
        { fromHexId: CASTER_HEX, toHexId: 1, type: 'ally' as const },
        { fromHexId: CASTER_HEX, toHexId: 2, type: 'ally' as const },
      ]
      const skill = createTargetingSkill({
        id: 'test',
        characterId: CHARACTER_ID,
        name: 'Test',
        description: '',
        color: '#000',
        calculateTarget: () => ({
          targetHexId: null,
          targetCharacterId: null,
          metadata: { arrows: customArrows },
        }),
      })

      skill.onActivate(buildContext(grid, skillManager))
      const stored = skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)
      expect(stored?.targetHexId).toBeNull()
      expect(stored?.metadata?.arrows).toEqual(customArrows)
    })

    it('treats null result as miss', () => {
      const skill = createTargetingSkill({
        id: 'test',
        characterId: CHARACTER_ID,
        name: 'Test',
        description: '',
        color: '#000',
        calculateTarget: () => null,
      })
      skill.onActivate(buildContext(grid, skillManager))
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
    skillManager = new SkillManager()
  })

  const buildSkill = (calculateTarget: (ctx: SkillContext) => SkillTargetInfo | null) =>
    createTileHighlightSkill({
      id: 'test',
      characterId: CHARACTER_ID,
      name: 'Test',
      description: '',
      tileColor: TILE_COLOR,
      calculateTarget,
    })

  it('exposes static fields from config', () => {
    const skill = buildSkill(() => null)
    expect(skill.id).toBe('test')
    expect(skill.characterId).toBe(CHARACTER_ID)
  })

  it('sets target and tile color on activation', () => {
    const skill = buildSkill(() => ({ targetHexId: 3, targetCharacterId: 42 }))
    skill.onActivate(buildContext(grid, skillManager))

    expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)?.targetHexId).toBe(3)
    expect(skillManager.getTileColorModifier(3)).toContain(TILE_COLOR)
  })

  it('clears target without setting tile color when calculate misses', () => {
    const skill = buildSkill(() => null)
    skill.onActivate(buildContext(grid, skillManager))

    expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    expect(skillManager.getTileColorModifier(3)).toBeUndefined()
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

  it('removes tile color and clears target on deactivation', () => {
    const skill = buildSkill(() => ({ targetHexId: 3, targetCharacterId: 42 }))
    skill.onActivate(buildContext(grid, skillManager))
    skill.onDeactivate(buildContext(grid, skillManager))

    expect(skillManager.getSkillTarget(CHARACTER_ID, Team.ALLY)).toBeUndefined()
    expect(skillManager.getTileColorModifier(3)).toBeUndefined()
  })
})
