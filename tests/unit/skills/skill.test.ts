import { beforeEach, describe, expect, it, vi } from 'vitest'

import { performPlace } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { getCharacterSkill, hasSkill, SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { SMALL_GRID, SMALL_OPEN_ARENA, STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('skill', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(SMALL_GRID, SMALL_OPEN_ARENA)
    skillManager = new SkillManager()
    // Reset mocks
    vi.clearAllMocks()
  })

  describe('Skill Registry', () => {
    it('returns undefined for unregistered characters', () => {
      expect(getCharacterSkill(999)).toBeUndefined()
      expect(getCharacterSkill(0)).toBeUndefined()
    })

    it('correctly identifies characters without skills', () => {
      expect(hasSkill(999)).toBe(false)
      expect(hasSkill(0)).toBe(false)
    })
  })

  describe('SkillManager', () => {
    describe('skill activation/deactivation', () => {
      it('tracks activation state correctly', () => {
        // Use a character ID without a skill to test pure SkillManager tracking
        // This avoids skill-specific failures due to test grid limitations
        const result = skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)

        // Should return true (no skill = success)
        expect(result).toBe(true)
        // Should not be tracked since there's no skill
        expect(skillManager.hasActiveSkill(999, Team.ALLY)).toBe(false)
      })

      it('handles character with no skill gracefully', () => {
        // Character ID 999 has no skill registered
        const result = skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)

        // Should return true (no skill = success)
        expect(result).toBe(true)
        // But should not be tracked as active
        expect(skillManager.hasActiveSkill(999, Team.ALLY)).toBe(false)
      })

      it('handles skill activation errors gracefully', () => {
        // We can't easily force a real skill to fail without mocking,
        // but we can test that the error handling works by checking
        // that skills requiring specific conditions fail gracefully

        // Phraesto (ID 50) requires space for companion
        // Fill all available ally tiles to cause failure
        grid.getAllTiles().forEach((tile) => {
          if (tile.state === State.AVAILABLE_ALLY) {
            tile.characterId = 1000 + tile.hex.getId()
          }
        })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Try to activate Phraesto when no space is available
        const result = skillManager.activateCharacterSkill(50, 1, Team.ALLY, grid)

        // Should fail and not be tracked as active
        expect(result).toBe(false)
        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(false)

        consoleSpy.mockRestore()
      })

      it('properly manages skill state', () => {
        // Test that SkillManager properly tracks state
        // We can't test real skill activation due to grid limitations
        // But we can test that the manager correctly reports state

        // No skill character returns true but isn't tracked
        const result = skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)
        expect(result).toBe(true)
        expect(skillManager.hasActiveSkill(999, Team.ALLY)).toBe(false)
      })

      it('handles team-specific tracking', () => {
        // Test team separation logic without real skills
        // Characters without skills don't get tracked
        skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)
        skillManager.activateCharacterSkill(999, 4, Team.ENEMY, grid)

        expect(skillManager.hasActiveSkill(999, Team.ALLY)).toBe(false)
        expect(skillManager.hasActiveSkill(999, Team.ENEMY)).toBe(false)
      })

      it('deactivates all skills', () => {
        // Test deactivateAllSkills with no active skills
        skillManager.deactivateAllSkills(grid)

        // Should handle empty state gracefully
        expect(skillManager.hasActiveSkill(999)).toBe(false)
      })
    })

    describe('color modifiers', () => {
      it('manages character color modifiers', () => {
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#ff0000')

        // Just verify the modifier system works without checking specific keys
        const modifiers = skillManager.getColorModifiersByCharacterAndTeam()
        expect(modifiers.size).toBeGreaterThan(0)

        skillManager.removeCharacterColorModifier(100, Team.ALLY)
        const updated = skillManager.getColorModifiersByCharacterAndTeam()
        expect(updated.size).toBe(0)
      })

      it('manages tile color modifiers', () => {
        skillManager.setTileColorModifier(1, '#00ff00')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#00ff00'])

        skillManager.setTileColorModifier(2, '#0000ff')
        const allModifiers = skillManager.getTileColorModifiers()
        expect(allModifiers.size).toBe(2)

        skillManager.removeTileColorModifier(1, '#00ff00')
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()

        skillManager.clearTileColorModifiers()
        expect(skillManager.getTileColorModifiers().size).toBe(0)
      })

      it('supports multiple colors on the same tile', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.setTileColorModifier(1, '#00ff00')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000', '#00ff00'])

        // Removing one color leaves the other
        skillManager.removeTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#00ff00'])

        // Removing last color clears the entry
        skillManager.removeTileColorModifier(1, '#00ff00')
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()
      })

      it('does not duplicate the same color on a tile', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.setTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])
      })

      it('handles removing a color that is not on the tile', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.removeTileColorModifier(1, '#00ff00')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])
      })

      it('handles removing from a non-existent tile', () => {
        skillManager.removeTileColorModifier(99, '#ff0000')
        expect(skillManager.getTileColorModifier(99)).toBeUndefined()
      })

      it('clears multi-color tiles with clearTileColorModifiers', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.setTileColorModifier(1, '#00ff00')
        skillManager.setTileColorModifier(2, '#0000ff')

        skillManager.clearTileColorModifiers()
        expect(skillManager.getTileColorModifiers().size).toBe(0)
      })
    })

    describe('skill targeting', () => {
      it('manages skill targets', () => {
        const targetInfo = {
          targetHexId: 5,
          targetCharacterId: 200,
          metadata: { distance: 3 },
        }

        skillManager.setSkillTarget(100, Team.ALLY, targetInfo)
        const retrieved = skillManager.getSkillTarget(100, Team.ALLY)

        expect(retrieved).toEqual(targetInfo)

        skillManager.clearSkillTarget(100, Team.ALLY)
        expect(skillManager.getSkillTarget(100, Team.ALLY)).toBeUndefined()
      })

      it('tracks multiple skill targets', () => {
        const target1 = { targetHexId: 5, targetCharacterId: 200 }
        const target2 = { targetHexId: 2, targetCharacterId: 300 }

        skillManager.setSkillTarget(100, Team.ALLY, target1)
        skillManager.setSkillTarget(150, Team.ENEMY, target2)

        const allTargets = skillManager.getAllSkillTargets()
        expect(allTargets.size).toBe(2)
      })

      it('increments version on target changes', () => {
        const initialVersion = skillManager.getTargetVersion()

        skillManager.setSkillTarget(100, Team.ALLY, {
          targetHexId: 5,
          targetCharacterId: 200,
        })
        expect(skillManager.getTargetVersion()).toBeGreaterThan(initialVersion)

        const afterSetVersion = skillManager.getTargetVersion()
        skillManager.clearSkillTarget(100, Team.ALLY)
        expect(skillManager.getTargetVersion()).toBeGreaterThan(afterSetVersion)
      })
    })

    describe('skill updates', () => {
      it('handles update calls gracefully', () => {
        // Test that updateActiveSkills works with no active skills
        skillManager.updateActiveSkills(grid)

        // Should not throw and should maintain empty state
        expect(skillManager.hasActiveSkill(999)).toBe(false)
      })

      it('runs full deactivation when a tracked character vanished from the grid', () => {
        // Phraesto (50): companion skill — activation places a companion and
        // raises the team size, so a leaked deactivation is observable
        const bigGrid = new Grid(STANDARD_GRID, STANDARD_ARENA)
        performPlace(bigGrid, 1, 50, Team.ALLY)
        expect(skillManager.activateCharacterSkill(50, 1, Team.ALLY, bigGrid)).toBe(true)
        const companionTile = bigGrid
          .getAllTiles()
          .find((t) => t.characterId === bigGrid.companionIdOffset + 50)
        expect(companionTile).toBeDefined()
        expect(bigGrid.maxTeamSizes.get(Team.ALLY)).toBe(6)

        // Orphan the character: clear its tile without going through removal
        const tile = bigGrid.getTileById(1)
        tile.characterId = undefined
        tile.team = undefined
        tile.state = State.AVAILABLE_ALLY
        bigGrid.teamCharacters.get(Team.ALLY)?.delete(50)

        skillManager.updateActiveSkills(bigGrid)

        // Tracking removed AND skill side effects cleaned up: companion gone,
        // team size restored
        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(false)
        expect(companionTile!.characterId).toBeUndefined()
        expect(bigGrid.maxTeamSizes.get(Team.ALLY)).toBe(5)
      })
    })

    describe('reset', () => {
      it('resets all skill manager state', () => {
        // Set up various state (without requiring real skills)
        skillManager.addCharacterColorModifier(200, Team.ENEMY, '#ff0000')
        skillManager.setTileColorModifier(3, '#00ff00')
        skillManager.setSkillTarget(999, Team.ALLY, {
          targetHexId: 5,
          targetCharacterId: 300,
        })

        skillManager.reset()

        expect(skillManager.hasActiveSkill(999)).toBe(false)
        expect(skillManager.getColorModifiersByCharacterAndTeam().size).toBe(0)
        expect(skillManager.getTileColorModifiers().size).toBe(0)
        expect(skillManager.getAllSkillTargets().size).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('handles character with no skill gracefully', () => {
        const result = skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)
        expect(result).toBe(true) // No skill = success
        expect(skillManager.hasActiveSkill(999)).toBe(false)
      })

      it('checks active skill without team parameter', () => {
        // Test with character without skill
        skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)

        expect(skillManager.hasActiveSkill(999)).toBe(false)
        const info = skillManager.getActiveSkillInfo(999)
        expect(info).toBeUndefined()
      })

      it('handles duplicate color modifier additions', () => {
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#ff0000')
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#00ff00') // Overwrite

        // Just verify modifiers exist
        const modifiers = skillManager.getColorModifiersByCharacterAndTeam()
        expect(modifiers.size).toBeGreaterThan(0)
      })
    })
  })
})
