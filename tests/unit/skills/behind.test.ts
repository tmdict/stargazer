import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

// Several heroes share the behind-highlight skill; Gunnar stands in for all of
// them here. The behind-tile geometry is pinned in utils/targeting.test.ts;
// this suite only pins the skill wiring on top of it.
const GUNNAR = 106

describe('behind-tile highlight skill', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: 23,
    team: Team.ALLY,
    characterId: GUNNAR,
    skillManager,
  })

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, 23, GUNNAR, Team.ALLY)
  })

  it('highlights the ally behind on activate and clears it on deactivate', () => {
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(GUNNAR)!

    skill.onActivate(ctx())
    expect(skillManager.getTileFillModifier(16)).toBeDefined()

    skill.onDeactivate(ctx())
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })
})
