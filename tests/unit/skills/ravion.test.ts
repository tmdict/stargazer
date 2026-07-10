import { beforeEach, describe, expect, it } from 'vitest'

import { executePlaceCharacter } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Ravion (90, Designated Duty) targets the 2 rearmost allies on his own team.
// Rearmost follows the grid convention (findRearmostTarget): smallest hex IDs
// for the ally team, largest for the enemy team.
const RAVION = 90

describe('ravion (Designated Duty)', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  const availableIds = (state: State) =>
    grid
      .getAllTiles()
      .filter((t) => t.state === state)
      .map((t) => t.hex.getId())
      .sort((a, b) => a - b)

  const arrowTargets = (team: Team) =>
    (skillManager.getSkillTarget(RAVION, team)?.metadata?.arrows ?? [])
      .map((a) => a.toHexId)
      .sort((a, b) => a - b)

  it('targets the two smallest hex IDs on the ally team', () => {
    const ids = availableIds(State.AVAILABLE_ALLY)
    // Ravion at the largest ally tile so he is never his own rearmost
    expect(executePlaceCharacter(grid, skillManager, ids.at(-1)!, RAVION, Team.ALLY)).toBe(true)
    for (const [i, hexId] of [ids[0]!, ids[1]!, ids[2]!].entries()) {
      expect(executePlaceCharacter(grid, skillManager, hexId, 100 + i, Team.ALLY)).toBe(true)
    }

    expect(arrowTargets(Team.ALLY)).toEqual([ids[0], ids[1]])
  })

  it('targets the two largest hex IDs on the enemy team', () => {
    const ids = availableIds(State.AVAILABLE_ENEMY)
    // Ravion at the smallest enemy tile so he is never his own rearmost
    expect(executePlaceCharacter(grid, skillManager, ids[0]!, RAVION, Team.ENEMY)).toBe(true)
    for (const [i, hexId] of [ids.at(-1)!, ids.at(-2)!, ids.at(-3)!].entries()) {
      expect(executePlaceCharacter(grid, skillManager, hexId, 200 + i, Team.ENEMY)).toBe(true)
    }

    expect(arrowTargets(Team.ENEMY)).toEqual([ids.at(-2), ids.at(-1)])
  })

  it('never targets himself even when he sits on the rearmost tile', () => {
    const ids = availableIds(State.AVAILABLE_ALLY)
    expect(executePlaceCharacter(grid, skillManager, ids[0]!, RAVION, Team.ALLY)).toBe(true)
    for (const [i, hexId] of [ids[1]!, ids[2]!, ids[3]!].entries()) {
      expect(executePlaceCharacter(grid, skillManager, hexId, 100 + i, Team.ALLY)).toBe(true)
    }

    expect(arrowTargets(Team.ALLY)).toEqual([ids[1], ids[2]])
  })

  it('targets a single ally when only one other ally exists', () => {
    const ids = availableIds(State.AVAILABLE_ALLY)
    expect(executePlaceCharacter(grid, skillManager, ids.at(-1)!, RAVION, Team.ALLY)).toBe(true)
    expect(executePlaceCharacter(grid, skillManager, ids[0]!, 100, Team.ALLY)).toBe(true)

    expect(arrowTargets(Team.ALLY)).toEqual([ids[0]])
  })
})
