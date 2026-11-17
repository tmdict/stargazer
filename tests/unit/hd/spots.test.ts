import { describe, expect, it } from 'vitest'

import { artifactHostHex, Grid } from '@/lib/grid'
import { DUEL_SPOTS, duelSpotHex } from '@/lib/hd/spots'
import { getMapByKey } from '@/lib/maps'
import { FULL_GRID } from '@/lib/types/grid'
import { Team } from '@/lib/types/team'

describe('the off-field spots of an Honor Duel board', () => {
  it('are twelve cells of their own, off the tiles and the artifact places', () => {
    const grid = new Grid(FULL_GRID, getMapByKey('arena1')!)
    const teams = [Team.ALLY, Team.ENEMY]
    const spots = teams.flatMap((team) => DUEL_SPOTS.map((spot) => duelSpotHex(grid, team, spot)))
    const taken = [
      ...grid.getAllTiles().map((tile) => tile.hex),
      ...teams.map((team) => artifactHostHex(grid, team)),
    ].map(String)

    expect(new Set(spots.map(String)).size).toBe(12)
    expect(spots.map(String).filter((spot) => taken.includes(spot))).toEqual([])
  })
})
