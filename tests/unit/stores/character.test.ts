import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getAvailableTeamSize, getMaxTeamSize } from '@/lib/characters/character'
import { toPhantimalId } from '@/lib/characters/phantimal'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'

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
  tags: {},
  ...(sourceHexId !== undefined ? { sourceHexId } : {}),
})

let store: ReturnType<typeof useCharacterStore>
let gridStore: ReturnType<typeof useGridStore>
let grids: ReturnType<typeof useGrids>

const tilesByState = (state: State) =>
  gridStore.hexes.filter((h) => gridStore.getTile(h.getId()).state === state)

const firstTile = (state: State) => {
  const tile = tilesByState(state)[0]
  if (!tile) throw new Error(`Test setup: no tile in state ${state} in default map`)
  return tile
}

beforeEach(() => {
  setActivePinia(createPinia())
  gridStore = useGridStore()
  store = useCharacterStore()
  grids = useGrids()
})

// Drop routing (place / move / swap / phantimal rules) lives on the GridContext;
// the app reaches it via grids.routeDrop's same-board path. These exercise that
// handler on the active board directly (sourceHexId without sourceGridId = a
// same-board move, which is handleDrop's contract, not routeDrop's).
describe('active grid — drop routing (handleDrop)', () => {
  describe('selection drop (no sourceHexId)', () => {
    it.each([
      [Team.ALLY, State.AVAILABLE_ALLY, 101],
      [Team.ENEMY, State.AVAILABLE_ENEMY, 202],
    ])('places a character on a valid %s tile', (team, state, characterId) => {
      const tile = firstTile(state)

      const ok = grids.active!.handleDrop(
        { character: buildCharacter(characterId), characterId },
        tile.getId(),
      )

      expect(ok).toBe(true)
      expect(gridStore.getTile(tile.getId()).characterId).toBe(characterId)
      expect(gridStore.getTile(tile.getId()).team).toBe(team)
    })

    it('returns false when target tile is not a valid placement state', () => {
      const defaultTile = firstTile(State.DEFAULT)

      const ok = grids.active!.handleDrop(
        { character: buildCharacter(101), characterId: 101 },
        defaultTile.getId(),
      )

      expect(ok).toBe(false)
      expect(gridStore.getTile(defaultTile.getId()).characterId).toBeUndefined()
    })

    it('returns false when team is at capacity', () => {
      const allyTiles = tilesByState(State.AVAILABLE_ALLY)
      const maxAlly = getMaxTeamSize(grids.active!.grid, Team.ALLY)
      const allyHexIds = allyTiles.slice(0, maxAlly).map((h) => h.getId())
      allyHexIds.forEach((id, i) => store.placeCharacterOnHex(id, 100 + i, Team.ALLY))

      expect(getAvailableTeamSize(grids.active!.grid, Team.ALLY)).toBe(0)

      const remaining = allyTiles[allyHexIds.length]
      if (!remaining) throw new Error('Test setup: default map has no spare ally tile')

      const ok = grids.active!.handleDrop(
        { character: buildCharacter(999), characterId: 999 },
        remaining.getId(),
      )

      expect(ok).toBe(false)
    })
  })

  describe('grid-source drop (sourceHexId set)', () => {
    it('moves a character to an empty target', () => {
      const allyTiles = tilesByState(State.AVAILABLE_ALLY)
      if (allyTiles.length < 2) throw new Error('Test setup: need at least 2 ally tiles')

      const sourceId = allyTiles[0]!.getId()
      const targetId = allyTiles[1]!.getId()
      store.placeCharacterOnHex(sourceId, 101, Team.ALLY)

      const ok = grids.active!.handleDrop(
        { character: buildCharacter(101, sourceId), characterId: 101 },
        targetId,
      )

      expect(ok).toBe(true)
      expect(gridStore.getTile(sourceId).characterId).toBeUndefined()
      expect(gridStore.getTile(targetId).characterId).toBe(101)
    })

    it('swaps when target is occupied', () => {
      const allyTiles = tilesByState(State.AVAILABLE_ALLY)
      if (allyTiles.length < 2) throw new Error('Test setup: need at least 2 ally tiles')

      const sourceId = allyTiles[0]!.getId()
      const targetId = allyTiles[1]!.getId()
      store.placeCharacterOnHex(sourceId, 101, Team.ALLY)
      store.placeCharacterOnHex(targetId, 202, Team.ALLY)

      const ok = grids.active!.handleDrop(
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

describe('characterStore.removeCharacterFromHex', () => {
  it('removes an occupied character and is an idempotent success when empty', () => {
    const allyTile = firstTile(State.AVAILABLE_ALLY)
    store.placeCharacterOnHex(allyTile.getId(), 101, Team.ALLY)

    expect(store.removeCharacterFromHex(allyTile.getId())).toBe(true)
    expect(gridStore.getTile(allyTile.getId()).characterId).toBeUndefined()

    // Removing again succeeds without a character present
    expect(store.removeCharacterFromHex(allyTile.getId())).toBe(true)
  })
})

describe('characterStore phantimals', () => {
  it('places a phantimal without consuming team size', () => {
    const tiles = tilesByState(State.AVAILABLE_ALLY)
    const before = getAvailableTeamSize(grids.active!.grid, Team.ALLY)
    const ok = store.placePhantimalOnHex(tiles[0]!.getId(), toPhantimalId(1), Team.ALLY)

    expect(ok).toBe(true)
    expect(gridStore.getTile(tiles[0]!.getId()).characterId).toBe(toPhantimalId(1))
    expect(getAvailableTeamSize(grids.active!.grid, Team.ALLY)).toBe(before) // unchanged by the phantimal
  })

  it('keeps at most one phantimal per team (replace on add)', () => {
    const tiles = tilesByState(State.AVAILABLE_ALLY)
    store.placePhantimalOnHex(tiles[0]!.getId(), toPhantimalId(1), Team.ALLY)
    store.placePhantimalOnHex(tiles[1]!.getId(), toPhantimalId(2), Team.ALLY)

    expect(gridStore.getTile(tiles[0]!.getId()).characterId).toBeUndefined()
    expect(gridStore.getTile(tiles[1]!.getId()).characterId).toBe(toPhantimalId(2))
  })

  it('routes a roster phantimal drop through one-per-team placement', () => {
    const tiles = tilesByState(State.AVAILABLE_ALLY)
    grids.active!.handleDrop(
      { character: buildCharacter(toPhantimalId(1)), characterId: toPhantimalId(1) },
      tiles[0]!.getId(),
    )
    grids.active!.handleDrop(
      { character: buildCharacter(toPhantimalId(2)), characterId: toPhantimalId(2) },
      tiles[1]!.getId(),
    )

    expect(gridStore.getTile(tiles[0]!.getId()).characterId).toBeUndefined()
    expect(gridStore.getTile(tiles[1]!.getId()).characterId).toBe(toPhantimalId(2))
  })
})

describe('characterStore phantimal faction rule', () => {
  // Character id → faction, fed to the (spied) data store so the rule is active.
  const FACTIONS: Record<number, string> = {
    1: 'lightbearer',
    2: 'lightbearer',
    3: 'lightbearer',
    4: 'lightbearer',
    5: 'lightbearer',
    6: 'lightbearer',
    7: 'lightbearer',
  }

  const aurelian: PhantimalType = {
    id: 1,
    name: 'aurelian',
    season: 7,
    range: 20,
    faction: 'lightbearer',
  }

  beforeEach(() => {
    const gameData = useGameDataStore()
    vi.spyOn(gameData, 'getCharacterFaction').mockImplementation((id: number) => FACTIONS[id])
    vi.spyOn(gameData, 'getPhantimalById').mockReturnValue(aurelian)
  })

  // Field `count` faction heroes on a team, returning the used hex ids
  const fieldHeroes = (team: Team, ids: number[]): number[] => {
    const state = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
    const tiles = tilesByState(state)
    return ids.map((id, i) => {
      const hexId = tiles[i]!.getId()
      store.placeCharacterOnHex(hexId, id, team)
      return hexId
    })
  }

  it('blocks placement below the faction requirement', () => {
    fieldHeroes(Team.ALLY, [1, 2]) // only 2 lightbearers
    const target = tilesByState(State.AVAILABLE_ALLY)[2]!

    const ok = store.placePhantimalOnHex(target.getId(), toPhantimalId(1), Team.ALLY)

    expect(ok).toBe(false)
    expect(gridStore.getTile(target.getId()).characterId).toBeUndefined()
  })

  it('allows placement once the faction requirement is met', () => {
    fieldHeroes(Team.ALLY, [1, 2, 3])
    const target = tilesByState(State.AVAILABLE_ALLY)[3]!

    const ok = store.placePhantimalOnHex(target.getId(), toPhantimalId(1), Team.ALLY)

    expect(ok).toBe(true)
    expect(gridStore.getTile(target.getId()).characterId).toBe(toPhantimalId(1))
  })

  it('auto-removes a phantimal when its faction drops below the requirement', async () => {
    const heroHexes = fieldHeroes(Team.ALLY, [1, 2, 3])
    const target = tilesByState(State.AVAILABLE_ALLY)[3]!
    store.placePhantimalOnHex(target.getId(), toPhantimalId(1), Team.ALLY)
    expect(gridStore.getTile(target.getId()).characterId).toBe(toPhantimalId(1))

    // Removing a lightbearer drops the count to 2 — the phantimal must leave.
    store.removeCharacterFromHex(heroHexes[0]!)
    await nextTick()

    expect(gridStore.getTile(target.getId()).characterId).toBeUndefined()
  })

  it('rejects a cross-team phantimal swap even when the faction requirement would survive', async () => {
    fieldHeroes(Team.ALLY, [1, 2, 3])
    // One above the requirement: cross-team phantimal swaps are rejected
    // outright, independent of faction counts
    const enemyHexes = fieldHeroes(Team.ENEMY, [4, 5, 6, 7])
    const phantimalHex = tilesByState(State.AVAILABLE_ALLY)[3]!.getId()
    store.placePhantimalOnHex(phantimalHex, toPhantimalId(1), Team.ALLY)
    await nextTick()

    const ok = grids.active!.handleDrop(
      { character: buildCharacter(toPhantimalId(1), phantimalHex), characterId: toPhantimalId(1) },
      enemyHexes[0]!,
    )

    expect(ok).toBe(false)
    expect(gridStore.getTile(phantimalHex).characterId).toBe(toPhantimalId(1))
    expect(gridStore.getTile(enemyHexes[0]!).characterId).toBe(4)
  })

  it('moving a phantimal to an empty enemy tile displaces the enemy phantimal', async () => {
    fieldHeroes(Team.ALLY, [1, 2, 3])
    fieldHeroes(Team.ENEMY, [4, 5, 6])
    const allyPhantimalHex = tilesByState(State.AVAILABLE_ALLY)[3]!.getId()
    store.placePhantimalOnHex(allyPhantimalHex, toPhantimalId(1), Team.ALLY)
    const enemyPhantimalHex = tilesByState(State.AVAILABLE_ENEMY)[3]!.getId()
    store.placePhantimalOnHex(enemyPhantimalHex, toPhantimalId(2), Team.ENEMY)
    const emptyEnemyHex = tilesByState(State.AVAILABLE_ENEMY)[4]!.getId()
    await nextTick()

    const ok = grids.active!.handleDrop(
      {
        character: buildCharacter(toPhantimalId(1), allyPhantimalHex),
        characterId: toPhantimalId(1),
      },
      emptyEnemyHex,
    )

    expect(ok).toBe(true)
    // One phantimal per team: the enemy's previous phantimal is gone
    expect(gridStore.getTile(emptyEnemyHex).characterId).toBe(toPhantimalId(1))
    expect(gridStore.getTile(enemyPhantimalHex).characterId).toBeUndefined()
    expect(gridStore.getTile(allyPhantimalHex).characterId).toBeUndefined()
  })
})
