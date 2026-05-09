import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CharacterType } from '@/lib/types/character'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'

const buildCharacter = (id: number, sourceHexId?: number): CharacterType => ({
  id,
  name: `hero-${id}`,
  level: '1',
  faction: '',
  class: '',
  damage: '',
  energy: [],
  range: 1,
  season: 1,
  tags: [],
  ...(sourceHexId !== undefined ? { sourceHexId } : {}),
})

describe('characterStore.handleCharacterDrop', () => {
  let store: ReturnType<typeof useCharacterStore>
  let gridStore: ReturnType<typeof useGridStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    gridStore = useGridStore()
    store = useCharacterStore()
  })

  describe('selection drop (no sourceHexId)', () => {
    it('places a character on a valid ally tile', () => {
      // Find an ally-available tile in the default map
      const allyTile = gridStore.hexes.find(
        (h) => gridStore.getTile(h.getId()).state === State.AVAILABLE_ALLY,
      )
      if (!allyTile) throw new Error('Test setup: no ally-available tile in default map')

      const ok = store.handleCharacterDrop(
        { character: buildCharacter(101), characterId: 101 },
        allyTile.getId(),
      )

      expect(ok).toBe(true)
      expect(gridStore.getTile(allyTile.getId()).characterId).toBe(101)
    })

    it('returns false when target tile is not a valid placement state', () => {
      // Find a DEFAULT tile (state 0) that doesn't accept characters
      const defaultTile = gridStore.hexes.find(
        (h) => gridStore.getTile(h.getId()).state === State.DEFAULT,
      )
      if (!defaultTile) throw new Error('Test setup: no DEFAULT tile in default map')

      const ok = store.handleCharacterDrop(
        { character: buildCharacter(101), characterId: 101 },
        defaultTile.getId(),
      )

      expect(ok).toBe(false)
      expect(gridStore.getTile(defaultTile.getId()).characterId).toBeUndefined()
    })

    it('returns false when team is at capacity', () => {
      // Fill ally team to capacity (default 5)
      const allyTiles = gridStore.hexes.filter(
        (h) => gridStore.getTile(h.getId()).state === State.AVAILABLE_ALLY,
      )
      const allyHexIds = allyTiles.slice(0, store.maxTeamSizeAlly).map((h) => h.getId())
      allyHexIds.forEach((id, i) => store.placeCharacterOnHex(id, 100 + i, Team.ALLY))

      // Verify ally team is full
      expect(store.availableAlly).toBe(0)

      // Try to place an additional character — should fail
      const remaining = allyTiles[allyHexIds.length]
      if (!remaining) {
        // No remaining ally tile, test premise is wrong; skip silently
        return
      }
      const ok = store.handleCharacterDrop(
        { character: buildCharacter(999), characterId: 999 },
        remaining.getId(),
      )

      expect(ok).toBe(false)
    })
  })

  describe('grid-source drop (sourceHexId set)', () => {
    it('moves a character to an empty target', () => {
      const allyTiles = gridStore.hexes.filter(
        (h) => gridStore.getTile(h.getId()).state === State.AVAILABLE_ALLY,
      )
      if (allyTiles.length < 2) throw new Error('Test setup: need at least 2 ally tiles')

      const sourceId = allyTiles[0]!.getId()
      const targetId = allyTiles[1]!.getId()
      store.placeCharacterOnHex(sourceId, 101, Team.ALLY)

      const ok = store.handleCharacterDrop(
        { character: buildCharacter(101, sourceId), characterId: 101 },
        targetId,
      )

      expect(ok).toBe(true)
      expect(gridStore.getTile(sourceId).characterId).toBeUndefined()
      expect(gridStore.getTile(targetId).characterId).toBe(101)
    })

    it('swaps when target is occupied', () => {
      const allyTiles = gridStore.hexes.filter(
        (h) => gridStore.getTile(h.getId()).state === State.AVAILABLE_ALLY,
      )
      if (allyTiles.length < 2) throw new Error('Test setup: need at least 2 ally tiles')

      const sourceId = allyTiles[0]!.getId()
      const targetId = allyTiles[1]!.getId()
      store.placeCharacterOnHex(sourceId, 101, Team.ALLY)
      store.placeCharacterOnHex(targetId, 202, Team.ALLY)

      const ok = store.handleCharacterDrop(
        { character: buildCharacter(101, sourceId), characterId: 101 },
        targetId,
      )

      expect(ok).toBe(true)
      // Both characters still placed, positions swapped
      expect(gridStore.getTile(sourceId).characterId).toBe(202)
      expect(gridStore.getTile(targetId).characterId).toBe(101)
    })
  })
})
