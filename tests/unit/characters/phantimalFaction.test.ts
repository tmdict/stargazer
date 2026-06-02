import { beforeEach, describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import {
  countTeamFaction,
  PHANTIMAL_FACTION_REQUIREMENT,
  requiredFactions,
} from '@/lib/characters/phantimalFaction'
import { performPlace } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('phantimalFaction', () => {
  describe('requiredFactions', () => {
    it('uses the phantimal faction by default', () => {
      expect(requiredFactions('aurelian', 'lightbearer')).toEqual(['lightbearer'])
    })

    it('counts both hypogean and celestial for midnight-hunter', () => {
      expect(requiredFactions('midnight-hunter', 'hypogean')).toEqual(['hypogean', 'celestial'])
    })
  })

  describe('countTeamFaction', () => {
    let grid: Grid
    const factionOf = (id: number): string | undefined =>
      ({ 100: 'lightbearer', 101: 'lightbearer', 102: 'mauler', 200: 'lightbearer' })[id]

    beforeEach(() => {
      grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
      performPlace(grid, 1, 100, Team.ALLY, true)
      performPlace(grid, 2, 101, Team.ALLY, true)
      performPlace(grid, 3, 102, Team.ALLY, true)
      performPlace(grid, 4, 200, Team.ENEMY, true)
      performPlace(grid, 5, toPhantimalId(1), Team.ENEMY, true) // phantimal: never counted
    })

    it('counts only matching-faction characters on the team', () => {
      expect(countTeamFaction(grid, Team.ALLY, ['lightbearer'], factionOf)).toBe(2)
      expect(countTeamFaction(grid, Team.ALLY, ['lightbearer', 'mauler'], factionOf)).toBe(3)
    })

    it('scopes the count to the given team', () => {
      expect(countTeamFaction(grid, Team.ENEMY, ['lightbearer'], factionOf)).toBe(1)
    })

    it('excludes phantimals from the count', () => {
      // The enemy phantimal at hex 5 is ignored even if its faction would match.
      expect(countTeamFaction(grid, Team.ENEMY, ['lightbearer', 'graveborn'], factionOf)).toBe(1)
    })

    it('excludes companions — only distinct heroes count', () => {
      const g = new Grid(STANDARD_GRID, STANDARD_ARENA)
      performPlace(g, 1, 100, Team.ALLY, true) // lightbearer hero
      performPlace(g, 2, 10100, Team.ALLY, true) // companion (10000+), must not count
      expect(countTeamFaction(g, Team.ALLY, ['lightbearer'], factionOf)).toBe(1)
    })
  })

  it('requires three faction units', () => {
    expect(PHANTIMAL_FACTION_REQUIREMENT).toBe(3)
  })
})
