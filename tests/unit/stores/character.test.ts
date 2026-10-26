import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  setActivePinia(createPinia())
  gridStore = useGridStore()
  store = useCharacterStore()
  grids = useGrids()
})

// One phantimal per team is enforced on the picker-drop path, so it is pinned here.
describe('characterStore phantimals', () => {
  it('routes a picker phantimal drop through one-per-team placement', () => {
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
  }

  const aurelian: PhantimalType = {
    id: 1,
    name: 'aurelian',
    season: 7,
    range: 20,
    damage: 'magic',
    faction: 'lightbearer',
  }

  beforeEach(() => {
    const gameData = useGameDataStore()
    vi.spyOn(gameData, 'getCharacterFaction').mockImplementation((id: number) => FACTIONS[id])
    vi.spyOn(gameData, 'getPhantimalById').mockReturnValue(aurelian)
  })

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

  it('auto-removes a phantimal when its faction drops below the requirement', async () => {
    const heroHexes = fieldHeroes(Team.ALLY, [1, 2, 3])
    const target = tilesByState(State.AVAILABLE_ALLY)[3]!
    store.placePhantimalOnHex(target.getId(), toPhantimalId(1), Team.ALLY)
    expect(gridStore.getTile(target.getId()).characterId).toBe(toPhantimalId(1))

    // Removing a lightbearer drops the count to 2, so the phantimal must leave.
    store.removeCharacterFromHex(heroHexes[0]!)
    await nextTick()

    expect(gridStore.getTile(target.getId()).characterId).toBeUndefined()
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
