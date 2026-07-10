import { beforeEach, describe, expect, it } from 'vitest'

import { getMaxTeamSize } from '@/lib/characters/character'
import { getCompanions } from '@/lib/characters/companion'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { SkillManager, type SkillContext, type SkillTargetInfo } from '@/lib/skills/skill'
import {
  createCompanionSkill,
  createTargetingSkill,
  createTileHighlightSkill,
} from '@/lib/skills/utils/builders'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

const CHARACTER_ID = 999
const CASTER_HEX = 5

const buildContext = (grid: Grid, skillManager: SkillManager): SkillContext => ({
  grid,
  hexId: CASTER_HEX,
  team: Team.ALLY,
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
      color: '#abcdef',
      arrowType: 'ally',
      calculateTarget: () => null,
    })

    expect(skill.id).toBe('test')
    expect(skill.characterId).toBe(CHARACTER_ID)
    expect(skill.targetingColorModifier).toBe('#abcdef')
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
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  const makeSkill = (overrides: Partial<Parameters<typeof createCompanionSkill>[0]> = {}) =>
    createCompanionSkill({
      id: 'test-companion',
      characterId: CHARACTER_ID,
      colorModifier: '#111111',
      companionColorModifier: '#222222',
      ...overrides,
    })

  const context = (): SkillContext => ({
    grid,
    hexId: CASTER_HEX,
    team: Team.ALLY,
    characterId: CHARACTER_ID,
    skillManager,
  })

  const companionTiles = () =>
    grid.getAllTiles().filter((t) => t.characterId !== undefined && t.characterId > 10000)

  it('exposes static fields from config', () => {
    const skill = makeSkill({ companionImageModifier: 'img', companionRange: 3 })
    expect(skill.id).toBe('test-companion')
    expect(skill.colorModifier).toBe('#111111')
    expect(skill.companionColorModifier).toBe('#222222')
    expect(skill.companionImageModifier).toBe('img')
    expect(skill.companionRange).toBe(3)
  })

  it('places one linked companion, bumps capacity, and applies modifiers', () => {
    makeSkill().onActivate(context())

    const placed = companionTiles()
    expect(placed).toHaveLength(1)
    expect(placed[0]!.characterId).toBe(grid.companionIdOffset + CHARACTER_ID)
    expect(placed[0]!.team).toBe(Team.ALLY)
    expect(getCompanions(grid, CHARACTER_ID, Team.ALLY).size).toBe(1)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE + 1)

    const modifiers = skillManager.getColorModifiersByCharacterAndTeam()
    expect(modifiers.get(`${CHARACTER_ID}-${Team.ALLY}`)).toBe('#111111')
    expect(modifiers.get(`${grid.companionIdOffset + CHARACTER_ID}-${Team.ALLY}`)).toBe('#222222')
  })

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

  it('deactivation removes companions, links, modifiers, and restores capacity', () => {
    const skill = makeSkill({ count: 2 })
    skill.onActivate(context())
    expect(companionTiles()).toHaveLength(2)

    skill.onDeactivate(context())

    expect(companionTiles()).toHaveLength(0)
    expect(getCompanions(grid, CHARACTER_ID, Team.ALLY).size).toBe(0)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
    expect(skillManager.getColorModifiersByCharacterAndTeam().size).toBe(0)
  })

  it('throws without side effects when there are not enough free tiles', () => {
    // Occupy every ally tile except one (bypassing the capacity limit),
    // then ask for two companions
    const allyTiles = grid.getAllTiles().filter((t) => t.state === State.AVAILABLE_ALLY)
    for (const tile of allyTiles.slice(1)) {
      tile.characterId = 1000 + tile.hex.getId()
    }

    expect(() => makeSkill({ count: 2 }).onActivate(context())).toThrow()
    expect(companionTiles()).toHaveLength(0)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
  })
})
