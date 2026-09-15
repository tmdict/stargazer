import { describe, expect, it } from 'vitest'

import { findMapByTiles, MAPS } from '@/lib/maps'
import { State } from '@/lib/types/state'

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

  it('reads occupied tiles as their available state', () => {
    const tiles = tilesOf('arena2').map(([id, state]) => [
      id!,
      state === State.AVAILABLE_ALLY ? State.OCCUPIED_ALLY : state!,
    ])
    expect(findMapByTiles(tiles)).toBe('arena2')
  })

  it('matches nothing for an edited or empty layout', () => {
    expect(findMapByTiles([...tilesOf('arena1'), [20, State.BLOCKED]])).toBeUndefined()
    expect(findMapByTiles(tilesOf('arena1').slice(1))).toBeUndefined()
    expect(findMapByTiles([])).toBeUndefined()
  })
})
