import { beforeEach, describe, expect, it } from 'vitest'

import { findCharacterHex, getAvailableTeamSize } from '@/lib/characters/character'
import { addCompanionLink } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillLookups } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { NO_LOOKUPS, placeOnTile } from '../fixtures/skills'

// Retire with src/lib/skills/seasonal/phantimal.ts.
describe('season 8', () => {
  const WEDGE_OF_MATTER = toPhantimalId(5)
  const WEDGE_OF_POWER = WEDGE_OF_MATTER + 10000

  it('wedge of matter brings wedge of power, which holds no team slot', () => {
    const grid = new Grid()
    const skillManager = new SkillManager(NO_LOOKUPS)
    expect(executePlaceCharacter(grid, skillManager, 16, WEDGE_OF_MATTER, Team.ALLY)).toBe(true)
    expect(findCharacterHex(grid, WEDGE_OF_POWER, Team.ALLY)).not.toBeNull()
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
  })

  describe('wedge marks, with targeting on', () => {
    let grid: Grid
    let skillManager: SkillManager
    const lookups: SkillLookups = { ...NO_LOOKUPS, seasonalTargeting: () => true }

    // Raw placement with a hand-made link, so both wedges stand on known hexes
    // (hex 4 ally front chain: 9 > 6 > 7; hex 23 behind: 16).
    const paintWedges = (matterHex: number, powerHex: number): void => {
      placeOnTile(grid, matterHex, WEDGE_OF_MATTER, Team.ALLY)
      placeOnTile(grid, powerHex, WEDGE_OF_POWER, Team.ALLY)
      addCompanionLink(grid, WEDGE_OF_MATTER, WEDGE_OF_POWER, Team.ALLY)
      getCharacterSkill(WEDGE_OF_MATTER)!.onUpdate!({
        grid,
        hexId: matterHex,
        team: Team.ALLY,
        characterId: WEDGE_OF_MATTER,
        skillManager,
        lookups,
      })
    }

    beforeEach(() => {
      grid = new Grid()
      skillManager = new SkillManager(lookups)
    })

    it('marks the hero in front of wedge of matter and the one behind wedge of power', () => {
      placeOnTile(grid, 9, 100, Team.ALLY)
      placeOnTile(grid, 16, 101, Team.ALLY)
      paintWedges(4, 23)
      expect(skillManager.getTileFillModifier(9)).toBeDefined()
      expect(skillManager.getTileFillModifier(16)).toBeDefined()
    })

    it('never marks the other wedge', () => {
      placeOnTile(grid, 6, 101, Team.ALLY)
      paintWedges(4, 9)
      expect(skillManager.getTileFillModifier(9)).toBeUndefined()
      expect(skillManager.getTileFillModifier(6)).toBeDefined()
    })
  })
})
