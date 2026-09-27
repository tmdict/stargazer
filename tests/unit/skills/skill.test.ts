import { beforeEach, describe, expect, it } from 'vitest'

import { executeMoveCharacter } from '@/lib/characters/move'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('skill', () => {
  let skillManager: SkillManager

  beforeEach(() => {
    skillManager = new SkillManager()
  })

  describe('SkillManager', () => {
    describe('color modifiers', () => {
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

        skillManager.updateActiveSkills(bigGrid)

        // Tracking removed AND skill side effects cleaned up: companion gone,
        // team size restored
        expect(skillManager.hasActiveSkill(50, Team.ALLY)).toBe(false)
        expect(companionTile!.characterId).toBeUndefined()
        expect(bigGrid.maxTeamSizes.get(Team.ALLY)).toBe(5)
      })
    })
  })
})
