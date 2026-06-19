import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const EVIE = 113
// Evie on 16 mirrors to enemy tile 30; the symmetrical tile and its neighbours
// span enemy-zone tiles 30, 33, 34, 37 and middle (non-enemy) tiles 23, 26, 27.
const EVIE_HEX = 16

describe('evie symmetrical enemy-tile highlight', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: EVIE_HEX,
    team: Team.ALLY,
    characterId: EVIE,
    skillManager,
  })

  const evie = () => getCharacterSkill(EVIE)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, EVIE_HEX, EVIE, Team.ALLY)
  })

  it('outlines the symmetrical enemy-zone cells (occupied or not) and skips non-enemy cells', () => {
    // Occupy one enemy cell to confirm only the zone matters, not occupancy.
    grid.getTileById(30).state = State.OCCUPIED_ENEMY
    placeOnTile(grid, 30, 200, Team.ENEMY)

    evie().onActivate(ctx())

    for (const hexId of [30, 33, 34, 37]) {
      expect(skillManager.getTileColorModifier(hexId)).toBeDefined()
    }
    for (const hexId of [23, 26, 27]) {
      expect(skillManager.getTileColorModifier(hexId)).toBeUndefined()
    }
  })

  it('clears the highlights on deactivate', () => {
    evie().onActivate(ctx())
    expect(skillManager.getTileColorModifier(30)).toBeDefined()

    evie().onDeactivate(ctx())

    for (const hexId of [30, 33, 34, 37]) {
      expect(skillManager.getTileColorModifier(hexId)).toBeUndefined()
    }
  })

  it('still targets the rearmost ally (base skill preserved under withTilePaint)', () => {
    placeOnTile(grid, 1, 200, Team.ALLY)

    evie().onActivate(ctx())

    const target = skillManager.getSkillTarget(EVIE, Team.ALLY)
    expect(target?.targetHexId).toBe(1)
    expect(target?.metadata?.arrows?.some((a) => a.type === 'ally')).toBe(true)
  })
})
