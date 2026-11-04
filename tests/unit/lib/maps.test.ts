import { describe, expect, it } from 'vitest'

import { buffTiles, configTiles, findMapByTiles, MAPS, tilesLayout } from '@/lib/maps'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// A preset as the serializer would emit it: [hexId, state] for every
// non-default tile.
const tilesOf = (key: string): number[][] =>
  MAPS[key]!.grid.flatMap(({ type, hex }) => hex.map((id) => [id, type]))

const layoutOf = (key: string): Set<string> => new Set(tilesOf(key).map(String))

describe('findMapByTiles', () => {
  it('identifies every preset from its own tiles, whatever their order', () => {
    // Two presets can share a layout; the match then names one of them.
    for (const key of Object.keys(MAPS)) {
      const found = findMapByTiles(tilesOf(key).reverse())
      expect(found).toBeDefined()
      expect(layoutOf(found!)).toEqual(layoutOf(key))
    }
  })

  it("names the map on a team type's list when presets share a layout", () => {
    for (const key of Object.values(TEAM_VARIANTS).flatMap((variant) => variant.maps)) {
      expect(findMapByTiles(tilesOf(key))).toBe(key)
    }
  })

  it('matches nothing for an edited or empty layout', () => {
    expect(findMapByTiles([...tilesOf('arena1'), [20, State.BLOCKED]])).toBeUndefined()
    expect(findMapByTiles(tilesOf('arena1').slice(1))).toBeUndefined()
    expect(findMapByTiles([])).toBeUndefined()
  })
})

describe('tilesLayout', () => {
  it("gives a preset's tiles that preset's key and buff tiles", () => {
    const layout = tilesLayout(tilesOf('preset-sr1'))
    expect(layout.key).toBe('preset-sr1')
    expect(layout.buffTiles).toEqual(buffTiles('preset-sr1'))
  })

  // The key seeds the engine's search and keys its cached fits, so a board
  // whose units move keeps the same one.
  it('keys an edited layout by its tiles alone, whatever their order or occupants', () => {
    const edited = [...tilesOf('arena1'), [20, State.BLOCKED]]
    const layout = tilesLayout(edited)
    const occupied = edited.map(([id, state]) => [
      id!,
      state === State.AVAILABLE_ALLY ? State.OCCUPIED_ALLY : state!,
    ])
    expect(tilesLayout([...occupied].reverse()).key).toBe(layout.key)
    expect(tilesLayout(tilesOf('arena1').slice(1)).key).not.toBe(layout.key)
    expect(layout.key).not.toBe('arena1')
    expect(layout.buffTiles).toEqual([])
    expect(configTiles(layout.config, Team.ALLY)).toEqual(configTiles(MAPS.arena1!, Team.ALLY))
  })
})
