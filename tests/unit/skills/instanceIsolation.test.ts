/**
 * Registry-wide divergent-id contract: every skill must key its instance state
 * by the placed unit id (ctx.characterId), never its config id. A synergy copy
 * (SYNERGY_ID_OFFSET + baseId) shares one Skill object with its base hero;
 * config-keyed state cross-wires the two instances. The dual-instance cycle
 * catches both failure shapes for current and future skills alike: a
 * config-keyed write clobbers the base instance's state, and a config-keyed
 * clear leaks state past deactivation.
 */
import { describe, expect, it } from 'vitest'

import {
  getAllAvailableTilesForTeam,
  getMaxTeamSize,
  getTilesWithCharacters,
} from '@/lib/characters/character'
import { executePlaceCharacter } from '@/lib/characters/place'
import { executeRemoveCharacter } from '@/lib/characters/remove'
import { decomposeUnitId, toSynergyId } from '@/lib/characters/synergy'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { getRegisteredSkills } from '@/lib/skills/registry'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../fixtures/grid'

interface ManagerSnapshot {
  targets: [string, unknown][]
  colors: [string, string][]
  images: [string, string][]
  tileColors: [number, string[]][]
  tileFills: [number, string[]][]
  lineCount: number
}

const snapshot = (sm: SkillManager): ManagerSnapshot => ({
  targets: [...sm.getAllSkillTargets().entries()],
  colors: [...sm.getColorModifiersByCharacterAndTeam().entries()],
  images: [...sm.getImageModifiersByCharacterAndTeam().entries()],
  tileColors: [...sm.getTileColorModifiers().entries()].map(([hex, colors]) => [hex, [...colors]]),
  tileFills: [...sm.getTileFillModifiers().entries()].map(([hex, colors]) => [hex, [...colors]]),
  lineCount: sm.getSkillLines().length,
})

const keyed = <T>(entries: [string, T][], id: number): [string, T][] =>
  entries.filter(([key]) => key.startsWith(`${id}-`))

const makeHarness = () => {
  const grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
  const sm = new SkillManager({
    factionOf: (id) => ['lightbearer', 'wilder', 'graveborn', 'mauler'][id % 4],
    classOf: (id) => ['tank', 'mage', 'warrior'][id % 3],
  })
  // Enemy seeds (skill-less placeholders) so targeting scans have units to find.
  const enemyTiles = getAllAvailableTilesForTeam(grid, Team.ENEMY)
  expect(executePlaceCharacter(grid, sm, enemyTiles[0]!.hex.getId(), 9001, Team.ENEMY)).toBe(true)
  expect(executePlaceCharacter(grid, sm, enemyTiles[1]!.hex.getId(), 9002, Team.ENEMY)).toBe(true)
  const freeAllyHex = () => getAllAvailableTilesForTeam(grid, Team.ALLY)[0]!.hex.getId()
  return { grid, sm, freeAllyHex }
}

describe('skill instance isolation (divergent-id contract)', () => {
  const skills = getRegisteredSkills().filter((skill) => skill.characterId < 10000)

  it('registry is populated', () => {
    expect(skills.length).toBeGreaterThan(0)
  })

  for (const skill of skills) {
    it(`${skill.id}: synergy copy leaves the base instance intact and cleans up fully`, () => {
      const { grid, sm, freeAllyHex } = makeHarness()
      const baseId = skill.characterId
      const copyId = toSynergyId(baseId)

      const baseHex = freeAllyHex()
      expect(executePlaceCharacter(grid, sm, baseHex, baseId, Team.ALLY)).toBe(true)
      const soloState = snapshot(sm)

      const copyHex = freeAllyHex()
      expect(executePlaceCharacter(grid, sm, copyHex, copyId, Team.ALLY)).toBe(true)

      // Every id-keyed entry must belong to one of the two instances or a
      // companion derived from one of them.
      const during = snapshot(sm)
      for (const [key] of [...during.targets, ...during.colors, ...during.images]) {
        const owner = decomposeUnitId(parseInt(key, 10)).localId % 10000
        expect(owner, `state key ${key} belongs to neither instance`).toBe(baseId)
      }

      // Removing the copy restores the exact solo state: the board is back to
      // the pre-copy occupancy, so any config-keyed write or clear by the
      // copy's lifecycle shows up as a diff.
      expect(executeRemoveCharacter(grid, sm, copyHex)).toBe(true)
      const after = snapshot(sm)
      expect(keyed(after.targets, baseId)).toEqual(keyed(soloState.targets, baseId))
      expect(keyed(after.colors, baseId)).toEqual(keyed(soloState.colors, baseId))
      expect(keyed(after.images, baseId)).toEqual(keyed(soloState.images, baseId))
      expect(after.tileColors).toEqual(soloState.tileColors)
      expect(after.tileFills).toEqual(soloState.tileFills)
      expect(after.lineCount).toBe(soloState.lineCount)

      // Removing the base must leave no trace anywhere.
      expect(executeRemoveCharacter(grid, sm, baseHex)).toBe(true)
      const final = snapshot(sm)
      expect(final.targets).toEqual([])
      expect(final.colors).toEqual([])
      expect(final.images).toEqual([])
      expect(final.tileColors).toEqual([])
      expect(final.tileFills).toEqual([])
      expect(final.lineCount).toBe(0)
      expect(grid.companionLinks.size).toBe(0)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
      expect(
        getTilesWithCharacters(grid)
          .map((t) => t.characterId)
          .sort(),
      ).toEqual([9001, 9002])
    })
  }

  it('two Phraestos coexist with disjoint companions, links, and modifiers', () => {
    const { grid, sm, freeAllyHex } = makeHarness()
    expect(executePlaceCharacter(grid, sm, freeAllyHex(), 50, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, sm, freeAllyHex(), toSynergyId(50), Team.ALLY)).toBe(true)

    const placed = new Set(getTilesWithCharacters(grid).map((t) => t.characterId))
    expect(placed.has(50)).toBe(true)
    expect(placed.has(10050)).toBe(true)
    expect(placed.has(200050)).toBe(true)
    expect(placed.has(210050)).toBe(true)

    expect([...grid.companionLinks.keys()].sort()).toEqual(['200050-1', '50-1'])
    const colorKeys = [...sm.getColorModifiersByCharacterAndTeam().keys()].sort()
    expect(colorKeys).toEqual(['10050-1', '200050-1', '210050-1', '50-1'])
  })

  it('a tile-highlight copy survives an update cycle without touching the base paint', () => {
    const { grid, sm, freeAllyHex } = makeHarness()
    const thador = 84
    expect(executePlaceCharacter(grid, sm, freeAllyHex(), thador, Team.ALLY)).toBe(true)
    const soloTiles = snapshot(sm).tileColors
    const soloTarget = sm.getAllSkillTargets().get(`${thador}-${Team.ALLY}`)

    const copyHex = freeAllyHex()
    expect(executePlaceCharacter(grid, sm, copyHex, toSynergyId(thador), Team.ALLY)).toBe(true)
    // A board change runs every active instance's onUpdate, exercising the
    // previous-target read path while both instances are live.
    const extraEnemy = getAllAvailableTilesForTeam(grid, Team.ENEMY)[0]!.hex.getId()
    expect(executePlaceCharacter(grid, sm, extraEnemy, 9003, Team.ENEMY)).toBe(true)
    expect(executeRemoveCharacter(grid, sm, extraEnemy)).toBe(true)

    expect(sm.getAllSkillTargets().get(`${thador}-${Team.ALLY}`)).toEqual(soloTarget)

    expect(executeRemoveCharacter(grid, sm, copyHex)).toBe(true)
    expect(snapshot(sm).tileColors).toEqual(soloTiles)
  })
})
