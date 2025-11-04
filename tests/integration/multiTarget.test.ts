import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'

/**
 * Integration tests for multi-target skill functionality.
 *
 * Tests the pattern of using indexed character IDs (characterId + 0.1, 0.2, etc.)
 * to store multiple targets for a single skill. Currently only Ravion uses this
 * pattern, but tests are structured to be generic and reusable for future
 * multi-target skills.
 */
describe('multi-target skill integration', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  describe('indexed character ID pattern', () => {
    it('stores and retrieves multiple targets using indexed character IDs', () => {
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

      // Verify multiple targets stored with indexed keys
      const allTargets = skillManager.getAllSkillTargets()
      const multiTargetKeys = Array.from(allTargets.keys()).filter((key) => key.includes('90.'))

      expect(multiTargetKeys).toHaveLength(2)
      // Verify key format: characterId.index-team
      expect(multiTargetKeys[0]).toMatch(/90\.\d+-1/) // Team.ALLY = 1
      expect(multiTargetKeys[1]).toMatch(/90\.\d+-1/)

      // Verify different indexes
      const indexes = multiTargetKeys.map((key) => {
        const match = key.match(/90\.(\d+)-/)
        return match ? parseInt(match[1]) : 0
      })
      expect(new Set(indexes).size).toBe(2) // Should have 2 unique indexes
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

      // Retrieve all targets for the skill
      const allTargets = skillManager.getAllSkillTargets()
      const skillTargets = Array.from(allTargets.entries())
        .filter(([key]) => key.startsWith('90.'))
        .map(([, target]) => target)

      expect(skillTargets).toHaveLength(2)

      // Verify each target has valid data
      skillTargets.forEach((target) => {
        expect(target.targetHexId).toBeDefined()
        expect(target.targetCharacterId).toBeDefined()
        expect(target.metadata?.sourceHexId).toBe(5)
      })

      // Verify targets are the 2 rearmost allies (hex 1 and 2)
      const targetHexIds = skillTargets.map((t) => t.targetHexId).sort()
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

      // Verify targets exist
      let multiTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter((key) =>
        key.includes('90.'),
      )
      expect(multiTargets.length).toBeGreaterThan(0)

      // Deactivate
      skill.onDeactivate(context)

      // Verify all targets cleared
      multiTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter((key) =>
        key.includes('90.'),
      )
      expect(multiTargets).toHaveLength(0)
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
      let targets = Array.from(skillManager.getAllSkillTargets().entries())
        .filter(([key]) => key.includes('90.'))
        .map(([, target]) => target.targetHexId)
        .sort()
      expect(targets).toEqual([1, 2])

      // Simulate grid change - remove ally at hex 1
      grid.getTileById(1)!.characterId = undefined
      grid.getTileById(1)!.team = undefined

      // Update
      skill.onUpdate(context)

      // Targets should now be hex 2 and 3
      targets = Array.from(skillManager.getAllSkillTargets().entries())
        .filter(([key]) => key.includes('90.'))
        .map(([, target]) => target.targetHexId)
        .sort()
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

      // Should only have 1 target
      const multiTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter((key) =>
        key.includes('90.'),
      )
      expect(multiTargets).toHaveLength(1)

      // Verify it targets the only available ally
      const target = skillManager.getAllSkillTargets().get(multiTargets[0]!)
      expect(target?.targetHexId).toBe(1)
      expect(target?.targetCharacterId).toBe(101)
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
      const multiTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter((key) =>
        key.includes('90.'),
      )
      expect(multiTargets).toHaveLength(0)
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
      const allyTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter(
        (key) => key.includes('90.') && key.endsWith('-1'),
      ) // Team.ALLY = 1
      const enemyTargets = Array.from(skillManager.getAllSkillTargets().keys()).filter(
        (key) => key.includes('90.') && key.endsWith('-2'),
      ) // Team.ENEMY = 2

      expect(allyTargets.length).toBeGreaterThan(0)
      expect(enemyTargets.length).toBeGreaterThan(0)

      // Verify they target different characters
      const allyTarget = skillManager.getAllSkillTargets().get(allyTargets[0]!)
      const enemyTarget = skillManager.getAllSkillTargets().get(enemyTargets[0]!)

      expect(allyTarget?.targetCharacterId).toBe(101) // Ally team target
      expect(enemyTarget?.targetCharacterId).toBe(201) // Enemy team target
    })
  })
})
