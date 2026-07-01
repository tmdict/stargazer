import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeMoveCharacter } from '@/lib/characters/move'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
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
      it('treats characters without skills as successful no-ops, never tracked', () => {
        const result = skillManager.activateCharacterSkill(999, 1, Team.ALLY, grid)

        expect(result).toBe(true)
        expect(skillManager.hasActiveSkill(999, Team.ALLY)).toBe(false)
        expect(skillManager.hasActiveSkill(999)).toBe(false)
        expect(skillManager.getActiveSkillInfo(999)).toBeUndefined()
      })

      it('reports failure and does not track when a skill throws on activation', () => {
        // Phraesto (50) needs a free tile for its companion; fill every ally
        // tile so activation fails
        grid.getAllTiles().forEach((tile) => {
          if (tile.state === State.AVAILABLE_ALLY) {
            tile.characterId = 1000 + tile.hex.getId()
          }
        })

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = skillManager.activateCharacterSkill(50, 1, Team.ALLY, grid)

        expect(result).toBe(false)
        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(false)

        consoleSpy.mockRestore()
      })

      it('deactivates all active skills, cleaning up their side effects', () => {
        const bigGrid = new Grid(STANDARD_GRID, STANDARD_ARENA)
        performPlace(bigGrid, 1, 50, Team.ALLY)
        skillManager.activateCharacterSkill(50, 1, Team.ALLY, bigGrid)
        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(true)

        skillManager.deactivateAllSkills(bigGrid)

        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(false)
        const companion = bigGrid
          .getAllTiles()
          .find((t) => t.characterId === bigGrid.companionIdOffset + 50)
        expect(companion).toBeUndefined()
      })
    })

    describe('color modifiers', () => {
      it('manages character color modifiers', () => {
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#ff0000')

        const modifiers = skillManager.getColorModifiersByCharacterAndTeam()
        expect(modifiers.get(`100-${Team.ALLY}`)).toBe('#ff0000')

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

      it('refcounts a color shared by two painters, listing it once and dropping it with the last', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.setTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])

        skillManager.removeTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])

        skillManager.removeTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()
      })

      it('keeps another skill same-color paint when a highlight moves off its tile', () => {
        // Ally Evie (113) outlines enemy-zone tiles around her mirror cell (40 among
        // them); enemy Cassadee (10) highlights her nearest teammate's tile with the
        // same color. Moving the teammate off 40 makes Cassadee unpaint it mid-sweep,
        // after Evie already repainted; the refcount keeps Evie's outline alive.
        const arena = new Grid()
        const sm = new SkillManager()
        arena.skillManager = sm
        expect(executePlaceCharacter(arena, sm, 9, 113, Team.ALLY)).toBe(true)
        expect(sm.getTileColorModifier(40)).toBeDefined()
        expect(executePlaceCharacter(arena, sm, 43, 10, Team.ENEMY)).toBe(true)
        expect(executePlaceCharacter(arena, sm, 40, 21, Team.ENEMY)).toBe(true)

        expect(executeMoveCharacter(arena, sm, 40, 45, 21)).toBe(true)
        expect(sm.getTileColorModifier(40)).toBeDefined()
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

      it('keeps the fill channel independent from the border channel', () => {
        skillManager.setTileColorModifier(1, '#ff0000')
        skillManager.setTileFillModifier(1, '#00ff00')

        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])
        expect(skillManager.getTileFillModifier(1)).toEqual(['#00ff00'])

        skillManager.removeTileColorModifier(1, '#ff0000')
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()
        expect(skillManager.getTileFillModifier(1)).toEqual(['#00ff00'])
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
      it('overwrites a character color modifier on re-add', () => {
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#ff0000')
        skillManager.addCharacterColorModifier(100, Team.ALLY, '#00ff00')

        const modifiers = skillManager.getColorModifiersByCharacterAndTeam()
        expect(modifiers.get(`100-${Team.ALLY}`)).toBe('#00ff00')
        expect(modifiers.size).toBe(1)
      })
    })
  })
})
