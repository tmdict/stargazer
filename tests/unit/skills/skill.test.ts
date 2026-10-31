import { beforeEach, describe, expect, it } from 'vitest'

import { executeMoveCharacter } from '@/lib/characters/move'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { toSynergyId } from '@/lib/characters/synergy'
import { Grid } from '@/lib/grid'
import { SkillManager, unitSkillKey } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { ALLY_A, ENEMY_A, GUNNAR, KULU } from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'
import { NO_LOOKUPS, placeOnTile } from '../fixtures/skills'

const SILVINA = 39

describe('skill', () => {
  let skillManager: SkillManager

  beforeEach(() => {
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  describe('SkillManager', () => {
    describe('color modifiers', () => {
      it('supports multiple colors on the same tile', () => {
        skillManager.paintTiles(1, Team.ALLY, [{ hexId: 1, color: '#ff0000' }])
        skillManager.paintTiles(2, Team.ALLY, [{ hexId: 1, color: '#00ff00' }])
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000', '#00ff00'])

        // Removing one color leaves the other
        skillManager.clearPaintedTiles(1, Team.ALLY)
        expect(skillManager.getTileColorModifier(1)).toEqual(['#00ff00'])

        // Removing last color clears the entry
        skillManager.clearPaintedTiles(2, Team.ALLY)
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()
      })

      it('refcounts a color shared by two painters, listing it once and dropping it with the last', () => {
        skillManager.paintTiles(1, Team.ALLY, [{ hexId: 1, color: '#ff0000' }])
        skillManager.paintTiles(2, Team.ALLY, [{ hexId: 1, color: '#ff0000' }])
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])

        skillManager.clearPaintedTiles(1, Team.ALLY)
        expect(skillManager.getTileColorModifier(1)).toEqual(['#ff0000'])

        skillManager.clearPaintedTiles(2, Team.ALLY)
        expect(skillManager.getTileColorModifier(1)).toBeUndefined()
      })

      it('keeps another skill same-color paint when a highlight moves off its tile', () => {
        // Ally Evie (113) outlines enemy-zone tiles around her mirror cell (40 among
        // them); enemy Cassadee (10) highlights her nearest teammate's tile with the
        // same color. Moving the teammate off 40 makes Cassadee unpaint it mid-sweep,
        // after Evie already repainted; the refcount keeps Evie's outline alive.
        const arena = new Grid()
        const sm = new SkillManager(NO_LOOKUPS)
        arena.skillManager = sm
        expect(executePlaceCharacter(arena, sm, 9, 113, Team.ALLY)).toBe(true)
        expect(sm.getTileColorModifier(40)).toBeDefined()
        expect(executePlaceCharacter(arena, sm, 43, 10, Team.ENEMY)).toBe(true)
        expect(executePlaceCharacter(arena, sm, 40, 21, Team.ENEMY)).toBe(true)

        expect(executeMoveCharacter(arena, sm, 40, 45, 21)).toBe(true)
        expect(sm.getTileColorModifier(40)).toBeDefined()
      })
    })

    describe('hidden skills', () => {
      let grid: Grid

      beforeEach(() => {
        grid = new Grid()
        grid.skillManager = skillManager
      })

      it('takes only the hidden side off a tile both Kulu zones paint', () => {
        executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)
        executePlaceCharacter(grid, skillManager, 45, KULU, Team.ENEMY)
        const hidden = new Set([unitSkillKey(KULU, Team.ALLY)])

        for (const paints of [
          skillManager.getTileColorModifiers(hidden),
          skillManager.getTileFillModifiers(hidden),
        ]) {
          expect(paints.has(19)).toBe(false)
          expect(paints.has(23)).toBe(true)
          expect(paints.has(26)).toBe(true)
        }
      })

      it('hides a tile highlight with its hero', () => {
        placeOnTile(grid, 16, ALLY_A, Team.ALLY)
        placeOnTile(grid, 23, GUNNAR, Team.ALLY)
        skillManager.activateCharacterSkill(GUNNAR, 23, Team.ALLY, grid)
        expect(skillManager.getTileFillModifiers().has(16)).toBe(true)

        const hidden = new Set([unitSkillKey(GUNNAR, Team.ALLY)])
        expect(skillManager.getTileFillModifiers(hidden).has(16)).toBe(false)
      })

      it('hides a synergy copy with its base hero', () => {
        expect(executePlaceCharacter(grid, skillManager, 1, KULU, Team.ALLY)).toBe(true)
        expect(executePlaceCharacter(grid, skillManager, 2, toSynergyId(KULU), Team.ALLY)).toBe(
          true,
        )

        const hidden = new Set([unitSkillKey(KULU, Team.ALLY)])
        expect(skillManager.getTileColorModifiers(hidden).has(19)).toBe(false)
      })

      it('counts a skill as drawing only while it has something on the board', () => {
        executePlaceCharacter(grid, skillManager, 2, SILVINA, Team.ALLY)
        expect(skillManager.getSkillInstances()[0]?.drawing).toBe(false)

        executePlaceCharacter(grid, skillManager, 40, ENEMY_A, Team.ENEMY)
        expect(skillManager.getSkillInstances()[0]?.drawing).toBe(true)
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
