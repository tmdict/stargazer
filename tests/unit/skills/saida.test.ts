import { beforeEach, describe, expect, it } from 'vitest'

import { PHANTIMAL_ID_OFFSET } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { NO_LOOKUPS, placeOnTile } from '../fixtures/skills'

const SAIDA = 87
const ELIJAH = 68
const LAILAH = 10000 + ELIJAH
const PHANTIMAL = PHANTIMAL_ID_OFFSET + 1

// Battles on the ally side: Saida's tile, her teammates' tiles (by unit id where
// the unit matters) and the two tiles that received seeds.
const BATTLES: Array<[string, number, Record<number, number>, number[]]> = [
  ['the nearest win, counting steps', 16, { 12: 1, 6: 2, 3: 3, 1: 4 }, [6, 12]],
  ['nearer beats further forward', 9, { 4: 1, 16: 2, 8: 3, 10: 4 }, [4, 16]],
  ['the further forward of two as near', 9, { 12: 1, 6: 2, 4: 3, 1: 4 }, [6, 12]],
  ['the right-hand tile in a row (12 over 13)', 9, { 16: 1, 12: 2, 13: 3, 4: 4 }, [12, 16]],
  ['the right-hand tile in a row (8 over 10)', 9, { 16: 1, 8: 2, 10: 3, 1: 4 }, [8, 16]],
  ['each twin', 9, { 12: ELIJAH, 16: LAILAH, 4: 1, 1: 2, 2: 3 }, [12, 16]],
  ['the phantimal', 9, { 16: PHANTIMAL, 12: 1, 4: 2, 1: 3, 2: 4 }, [12, 16]],
]

describe('saida drain seeds', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  it.each(BATTLES)('seeds %s', (_, saidaHex, teammates, expected) => {
    placeOnTile(grid, saidaHex, SAIDA, Team.ALLY)
    for (const [hexId, unitId] of Object.entries(teammates)) {
      placeOnTile(grid, Number(hexId), unitId, Team.ALLY)
    }
    getCharacterSkill(SAIDA)!.onActivate({
      grid,
      hexId: saidaHex,
      team: Team.ALLY,
      characterId: SAIDA,
      skillManager,
      lookups: NO_LOOKUPS,
    })

    const arrows = skillManager.getSkillTarget(SAIDA, Team.ALLY)?.metadata?.arrows ?? []
    expect(arrows.map((arrow) => arrow.toHexId).sort((a, b) => a - b)).toEqual(expected)
  })
})
