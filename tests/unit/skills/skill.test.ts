import { computed, reactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { toSynergyId } from '@/lib/characters/synergy'
import { COMPANION_ID_OFFSET } from '@/lib/characters/unitIds'
import { Grid } from '@/lib/grid'
import { SkillManager, unitSkillKey, type SkillBadge } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { ALLY_A, GUNNAR, KULU, PHRAESTO } from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'
import { NO_LOOKUPS, placeOnTile } from '../fixtures/skills'

const SILVINA = 39
const WEDGE_OF_MATTER = toPhantimalId(5)

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
    })

    describe('hidden skills', () => {
      let grid: Grid

      beforeEach(() => {
        grid = new Grid()
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

      it('lists a unit able to draw before it draws, and never one that only spawns', () => {
        executePlaceCharacter(grid, skillManager, 2, SILVINA, Team.ALLY)
        executePlaceCharacter(grid, skillManager, 3, PHRAESTO, Team.ALLY)

        expect(skillManager.getAllSkillTargets().size).toBe(0)
        expect(skillManager.getUnitsAbleToDraw()).toMatchObject([{ characterId: SILVINA }])
      })

      it('lists a phantimal that also spawns only while its targeting flag is on', () => {
        const listed = (seasonalTargeting: boolean): number[] => {
          const manager = new SkillManager({
            ...NO_LOOKUPS,
            seasonalTargeting: () => seasonalTargeting,
          })
          const board = new Grid()
          executePlaceCharacter(board, manager, 16, WEDGE_OF_MATTER, Team.ALLY)
          return manager.getUnitsAbleToDraw().map((unit) => unit.characterId)
        }

        expect(listed(true)).toEqual([WEDGE_OF_MATTER])
        expect(listed(false)).toEqual([])
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
          .find((t) => t.characterId === COMPANION_ID_OFFSET + 50)
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

// A board wraps its manager in reactive() and its drawings are computeds over
// these reads, so every write below has to reach them.
describe('a reactive SkillManager', () => {
  const watched = () => {
    const manager = reactive(new SkillManager(NO_LOOKUPS)) as SkillManager
    const drawn = computed(() => ({
      borders: [...manager.getTileColorModifiers()],
      fills: [...manager.getTileFillModifiers()],
      targets: [...manager.getAllSkillTargets()],
      lines: manager.getSkillLines(),
      badges: manager.getSkillBadges(),
    }))
    return { manager, drawn }
  }
  const target = { targetHexId: 5, targetCharacterId: 2 }
  const line = { fromHexId: 1, toHexId: 5, color: 'red' }
  const badge = { hexId: 5, icon: 'mark' as SkillBadge['icon'], color: 'red' }

  it.each<[string, (m: SkillManager) => void, (m: SkillManager) => void]>([
    [
      'a border',
      (m) => m.paintTiles(1, Team.ALLY, [{ hexId: 5, color: 'red' }]),
      (m) => m.clearPaintedTiles(1, Team.ALLY),
    ],
    [
      'a fill',
      (m) => m.paintTiles(1, Team.ALLY, [{ hexId: 5, color: 'red', fill: true }]),
      (m) => m.paintTiles(1, Team.ALLY, []),
    ],
    [
      'a target',
      (m) => m.setSkillTarget(1, Team.ALLY, target),
      (m) => m.clearSkillTarget(1, Team.ALLY),
    ],
    [
      'a line',
      (m) => m.setSkillLines(1, Team.ALLY, [line]),
      (m) => m.clearSkillLines(1, Team.ALLY),
    ],
    [
      'a badge',
      (m) => m.setSkillBadges(1, Team.ALLY, [badge]),
      (m) => m.clearSkillBadges(1, Team.ALLY),
    ],
    [
      'everything, until a reset',
      (m) => {
        m.paintTiles(1, Team.ALLY, [{ hexId: 5, color: 'red' }])
        m.setSkillTarget(1, Team.ALLY, target)
        m.setSkillLines(1, Team.ALLY, [line])
      },
      (m) => m.reset(),
    ],
  ])('redraws %s when it is set and when it is cleared', (_name, set, clear) => {
    const { manager, drawn } = watched()
    const empty = JSON.stringify(drawn.value)
    set(manager)
    const shown = JSON.stringify(drawn.value)
    expect(shown).not.toBe(empty)
    clear(manager)
    expect(JSON.stringify(drawn.value)).toBe(empty)
  })

  it('redraws a second painter of a tile already painted', () => {
    const { manager, drawn } = watched()
    manager.paintTiles(1, Team.ALLY, [{ hexId: 5, color: 'red' }])
    expect(drawn.value.borders).toEqual([[5, ['red']]])
    manager.paintTiles(2, Team.ALLY, [{ hexId: 5, color: 'blue' }])
    expect(drawn.value.borders).toEqual([[5, ['red', 'blue']]])
  })
})
