import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'

/**
 * Integration tests for multi-target skill functionality.
 *
 * Tests skills that target multiple characters using the arrows array pattern.
 * Ravion targets 2 rearmost allies, storing both arrows in a single SkillTargetInfo.
 */
describe('multi-target skill integration', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  describe('arrows array pattern', () => {
    it('stores multiple targets using arrows array', () => {
      // Use Ravion (ID: 90) as test case for multi-target functionality
      const ravionSkill = getCharacterSkill(90)
      if (!ravionSkill) {
        throw new Error('Ravion skill not found in registry')
      }

      // Setup skill caster
      const casterTile = grid.getTileById(5)!
      casterTile.characterId = 90
      casterTile.team = Team.ALLY

      // Setup potential targets
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY
      grid.getTileById(2)!.characterId = 102
      grid.getTileById(2)!.team = Team.ALLY
      grid.getTileById(3)!.characterId = 103
      grid.getTileById(3)!.team = Team.ALLY

      // Activate multi-target skill
      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }
      ravionSkill.onActivate(context)

      // Verify single skill target with multiple arrows
      const allTargets = skillManager.getAllSkillTargets()
      const ravionKey = '90-1' // characterId-team format
      const targetInfo = allTargets.get(ravionKey)

      expect(targetInfo).toBeDefined()
      expect(targetInfo?.metadata?.arrows).toBeDefined()
      expect(targetInfo?.metadata?.arrows).toHaveLength(2)

      // Verify arrows point to the 2 rearmost allies
      const arrowTargets = targetInfo?.metadata?.arrows?.map((a) => a.toHexId).sort()
      expect(arrowTargets).toEqual([1, 2])
    })

    it('correctly identifies all targets for a multi-target skill', () => {
      const skill = getCharacterSkill(90)
      if (!skill) throw new Error('Test skill not found')

      // Setup
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY
      grid.getTileById(2)!.characterId = 102
      grid.getTileById(2)!.team = Team.ALLY
      grid.getTileById(3)!.characterId = 103
      grid.getTileById(3)!.team = Team.ALLY

      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }
      skill.onActivate(context)

      // Retrieve target info for the skill
      const targetInfo = skillManager.getAllSkillTargets().get('90-1')
      expect(targetInfo).toBeDefined()
      expect(targetInfo?.metadata?.arrows).toHaveLength(2)

      // Verify each arrow has valid data
      targetInfo?.metadata?.arrows?.forEach((arrow) => {
        expect(arrow.fromHexId).toBe(5)
        expect(arrow.toHexId).toBeDefined()
        expect(arrow.type).toBe('ally')
      })

      // Verify targets are the 2 rearmost allies (hex 1 and 2)
      const targetHexIds = targetInfo?.metadata?.arrows?.map((a) => a.toHexId).sort()
      expect(targetHexIds).toEqual([1, 2])
    })
  })

  describe('lifecycle management', () => {
    it('properly cleans up all targets on deactivation', () => {
      const skill = getCharacterSkill(90)
      if (!skill) throw new Error('Test skill not found')

      // Setup and activate
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY
      grid.getTileById(2)!.characterId = 102
      grid.getTileById(2)!.team = Team.ALLY

      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }

      skill.onActivate(context)

      // Verify target exists
      let targetInfo = skillManager.getAllSkillTargets().get('90-1')
      expect(targetInfo).toBeDefined()
      expect(targetInfo?.metadata?.arrows).toHaveLength(2)

      // Deactivate
      skill.onDeactivate(context)

      // Verify target cleared
      targetInfo = skillManager.getAllSkillTargets().get('90-1')
      expect(targetInfo).toBeUndefined()
    })

    it('updates all targets when grid state changes', () => {
      const skill = getCharacterSkill(90)
      if (!skill || !skill.onUpdate) throw new Error('Test skill or onUpdate not found')

      // Initial setup
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY
      grid.getTileById(2)!.characterId = 102
      grid.getTileById(2)!.team = Team.ALLY
      grid.getTileById(3)!.characterId = 103
      grid.getTileById(3)!.team = Team.ALLY

      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }

      skill.onActivate(context)

      // Initial targets should be hex 1 and 2
      let targetInfo = skillManager.getAllSkillTargets().get('90-1')
      let targets = targetInfo?.metadata?.arrows?.map((a) => a.toHexId).sort()
      expect(targets).toEqual([1, 2])

      // Simulate grid change - remove ally at hex 1
      grid.getTileById(1)!.characterId = undefined
      grid.getTileById(1)!.team = undefined

      // Update
      skill.onUpdate(context)

      // Targets should now be hex 2 and 3
      targetInfo = skillManager.getAllSkillTargets().get('90-1')
      targets = targetInfo?.metadata?.arrows?.map((a) => a.toHexId).sort()
      expect(targets).toEqual([2, 3])
    })
  })

  describe('edge cases', () => {
    it('handles fewer available targets than target count', () => {
      const skill = getCharacterSkill(90)
      if (!skill) throw new Error('Test skill not found')

      // Setup with only 1 other ally (less than 2 target count)
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY

      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }
      skill.onActivate(context)

      // Should have 1 arrow to the only available ally
      const targetInfo = skillManager.getAllSkillTargets().get('90-1')
      expect(targetInfo).toBeDefined()
      expect(targetInfo?.metadata?.arrows).toHaveLength(1)

      // Verify it targets the only available ally
      expect(targetInfo?.metadata?.arrows?.[0]?.toHexId).toBe(1)
    })

    it('handles no available targets gracefully', () => {
      const skill = getCharacterSkill(90)
      if (!skill) throw new Error('Test skill not found')

      // Setup with only the caster (no targets available)
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY

      const context = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }
      skill.onActivate(context)

      // Should have no targets
      const targetInfo = skillManager.getAllSkillTargets().get('90-1')
      expect(targetInfo).toBeUndefined()
    })

    it('maintains separate targets for different teams', () => {
      const skill = getCharacterSkill(90)
      if (!skill) throw new Error('Test skill not found')

      // Setup ally team Ravion
      grid.getTileById(5)!.characterId = 90
      grid.getTileById(5)!.team = Team.ALLY
      grid.getTileById(1)!.characterId = 101
      grid.getTileById(1)!.team = Team.ALLY

      // Setup enemy team Ravion (same character on different team)
      grid.getTileById(15)!.characterId = 90
      grid.getTileById(15)!.team = Team.ENEMY
      grid.getTileById(11)!.characterId = 201
      grid.getTileById(11)!.team = Team.ENEMY

      // Activate for ally team
      const allyContext = {
        grid,
        hexId: 5,
        team: Team.ALLY,
        characterId: 90,
        skillManager,
      }
      skill.onActivate(allyContext)

      // Activate for enemy team
      const enemyContext = {
        grid,
        hexId: 15,
        team: Team.ENEMY,
        characterId: 90,
        skillManager,
      }
      skill.onActivate(enemyContext)

      // Should have separate targets for each team
      const allyTarget = skillManager.getAllSkillTargets().get('90-1') // Team.ALLY = 1
      const enemyTarget = skillManager.getAllSkillTargets().get('90-2') // Team.ENEMY = 2

      expect(allyTarget).toBeDefined()
      expect(enemyTarget).toBeDefined()

      // Verify arrows are set correctly and target different hexes
      expect(allyTarget?.metadata?.arrows).toHaveLength(1)
      expect(enemyTarget?.metadata?.arrows).toHaveLength(1)
      expect(allyTarget?.metadata?.arrows?.[0]?.toHexId).toBe(1)
      expect(enemyTarget?.metadata?.arrows?.[0]?.toHexId).toBe(11)
    })
  })
})
