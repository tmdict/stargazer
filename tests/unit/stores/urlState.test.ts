import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { useUrlStateStore } from '@/stores/urlState'
import { serializeGridState, type DisplayFlags } from '@/utils/gridStateSerializer'
import { encodeGridStateToUrl } from '@/utils/urlStateManager'

/**
 * Round-trip tests for the urlState store's restore path: state is built with
 * the real grid/character/artifact stores, serialized and encoded with the real
 * URL utils, then restored into fresh stores via restoreFromEncodedState.
 *
 * Default map (arena1): ally spawns are hexes 1-10/12/13/16, enemy spawns are
 * hexes 30/33/34/36-45; everything else is DEFAULT.
 */

// Character ids with no registered skill, so placement has no side effects.
const ALLY_A = 11
const ALLY_B = 12
const ENEMY_A = 21
const ENEMY_B = 22

const PHRAESTO = 50
const PHRAESTO_COMPANION = COMPANION_ID_OFFSET + PHRAESTO

interface TestStores {
  grid: ReturnType<typeof useGridStore>
  character: ReturnType<typeof useCharacterStore>
  artifact: ReturnType<typeof useArtifactStore>
  urlState: ReturnType<typeof useUrlStateStore>
}

// Swaps in a fresh Pinia, so a second call yields pristine restore-target
// stores while the first set keeps working against its own Pinia instance.
const createStores = (): TestStores => {
  setActivePinia(createPinia())
  return {
    grid: useGridStore(),
    character: useCharacterStore(),
    artifact: useArtifactStore(),
    urlState: useUrlStateStore(),
  }
}

const encodeStores = ({ grid, artifact }: TestStores, displayFlags?: DisplayFlags): string =>
  encodeGridStateToUrl(
    serializeGridState(
      grid.getAllTiles,
      artifact.allyArtifactId,
      artifact.enemyArtifactId,
      displayFlags,
    ),
  )

interface TileSnapshot {
  hexId: number
  state: State
  characterId: number | undefined
  team: Team | undefined
}

const snapshotTiles = (grid: TestStores['grid']): TileSnapshot[] =>
  grid.getAllTiles.map((tile) => ({
    hexId: tile.hex.getId(),
    state: tile.state,
    characterId: tile.characterId,
    team: tile.team,
  }))

describe('urlStateStore.restoreFromEncodedState', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('round-trips characters, tile states, artifacts, and display flags', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(7, ALLY_B, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(40, ENEMY_A, Team.ENEMY)).toBe(true)
    expect(source.character.placeCharacterOnHex(45, ENEMY_B, Team.ENEMY)).toBe(true)
    source.grid.setState(source.grid.getHexById(20), State.BLOCKED)
    source.grid.setState(source.grid.getHexById(23), State.BLOCKED_BREAKABLE)
    source.artifact.placeArtifact(3, Team.ALLY)
    source.artifact.placeArtifact(5, Team.ENEMY)

    const flags: DisplayFlags = {
      showHexIds: true,
      showArrows: false,
      showPerspective: false,
      showSkills: true,
      teamView: true,
      inverted: true,
    }
    const encoded = encodeStores(source, flags)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    const result = restored.urlState.restoreFromEncodedState(encoded)

    expect(result.success).toBe(true)
    expect(result.displayFlags).toEqual(flags)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
    expect(restored.grid.getTile(2).characterId).toBe(ALLY_A)
    expect(restored.grid.getTile(2).team).toBe(Team.ALLY)
    expect(restored.grid.getTile(45).characterId).toBe(ENEMY_B)
    expect(restored.grid.getTile(45).team).toBe(Team.ENEMY)
    expect(restored.grid.getTile(20).state).toBe(State.BLOCKED)
    expect(restored.grid.getTile(23).state).toBe(State.BLOCKED_BREAKABLE)
    expect(restored.artifact.allyArtifactId).toBe(3)
    expect(restored.artifact.enemyArtifactId).toBe(5)
  })

  it('restores a moved companion at its encoded hex, not the auto-spawn hex', () => {
    const source = createStores()
    // Phraesto's companion skill spawns the companion on a random free ally tile.
    expect(source.character.placeCharacterOnHex(5, PHRAESTO, Team.ALLY)).toBe(true)
    const spawnTile = source.grid.getAllTiles.find((t) => t.characterId === PHRAESTO_COMPANION)
    expect(spawnTile).toBeDefined()
    const spawnHexId = spawnTile!.hex.getId()

    // Move the companion off its auto-spawn hex before encoding, so the encoded
    // hex can only be reached through the restore's locate-and-move branch
    // (16/13 are free ally spawns; pick one the companion didn't land on).
    const companionHexId = [16, 13].find((id) => id !== spawnHexId)!
    expect(source.character.moveCharacter(spawnHexId, companionHexId, PHRAESTO_COMPANION)).toBe(
      true,
    )

    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.urlState.restoreFromEncodedState(encoded).success).toBe(true)

    expect(restored.grid.getTile(5).characterId).toBe(PHRAESTO)
    expect(restored.grid.getTile(companionHexId).characterId).toBe(PHRAESTO_COMPANION)
    expect(restored.grid.getTile(companionHexId).team).toBe(Team.ALLY)
    // Exactly one companion on the board, and the restore-time auto-spawn tile
    // was vacated again: the whole grid matches the encoded layout.
    expect(
      restored.grid.getAllTiles.filter((t) => t.characterId === PHRAESTO_COMPANION),
    ).toHaveLength(1)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
  })

  it('round-trips phantimals through their local-id mapping', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(3, toPhantimalId(2), Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(44, toPhantimalId(1), Team.ENEMY)).toBe(true)

    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.urlState.restoreFromEncodedState(encoded).success).toBe(true)

    // Serialized as local ids (2/1); restored tiles carry the namespaced ids again.
    expect(restored.grid.getTile(3).characterId).toBe(toPhantimalId(2))
    expect(restored.grid.getTile(3).team).toBe(Team.ALLY)
    expect(restored.grid.getTile(44).characterId).toBe(toPhantimalId(1))
    expect(restored.grid.getTile(44).team).toBe(Team.ENEMY)
    expect(restored.grid.getTile(1).characterId).toBe(ALLY_A)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
  })

  it('fails without applying anything when no state is provided', () => {
    const stores = createStores()
    const result = stores.urlState.restoreFromEncodedState(null)
    expect(result).toEqual({ success: false, error: 'No state provided' })
  })

  it('rejects a garbage encoded string and leaves existing state untouched', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stores = createStores()
    expect(stores.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    stores.artifact.placeArtifact(3, Team.ALLY)
    const before = snapshotTiles(stores.grid)

    // '!' and '$' are outside the URL-safe alphabet, so decoding fails outright.
    const result = stores.urlState.restoreFromEncodedState('!!!not-an-encoded-state$$$')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid state data')
    expect(result.displayFlags).toBeUndefined()
    expect(snapshotTiles(stores.grid)).toEqual(before)
    expect(stores.artifact.allyArtifactId).toBe(3)
  })

  it('rejects valid-alphabet garbage that decodes to zero bytes, leaving state untouched', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const stores = createStores()
    expect(stores.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    const before = snapshotTiles(stores.grid)

    // 'A' is inside the URL-safe alphabet but too short to decode to any bytes
    const result = stores.urlState.restoreFromEncodedState('A')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid state data')
    expect(snapshotTiles(stores.grid)).toEqual(before)
  })

  it('clears pre-existing state before applying the encoded state', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(40, ENEMY_A, Team.ENEMY)).toBe(true)
    source.artifact.placeArtifact(7, Team.ALLY)
    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const target = createStores()
    expect(target.character.placeCharacterOnHex(1, ALLY_A, Team.ALLY)).toBe(true)
    target.artifact.placeArtifact(9, Team.ENEMY)
    target.grid.setState(target.grid.getHexById(20), State.BLOCKED)

    const result = target.urlState.restoreFromEncodedState(encoded)

    expect(result.success).toBe(true)
    // No flags were encoded, so the store reports the defaults.
    expect(result.displayFlags).toEqual({
      showHexIds: true,
      showArrows: true,
      showPerspective: true,
      showSkills: true,
      teamView: false,
      inverted: false,
    })
    // Old placement, artifact, and custom tile state are gone.
    expect(target.grid.getTile(1).characterId).toBeUndefined()
    expect(target.grid.getTile(20).state).toBe(State.DEFAULT)
    expect(target.artifact.enemyArtifactId).toBeNull()
    // Encoded state applied.
    expect(target.grid.getTile(40).characterId).toBe(ENEMY_A)
    expect(target.artifact.allyArtifactId).toBe(7)
    expect(snapshotTiles(target.grid)).toEqual(expected)
  })
})

describe('urlStateStore.swapTeamsAllBoards', () => {
  it('mirrors units onto the opposite team and leaves no stale occupied tiles', () => {
    const s = createStores()
    const gridRef = useGrids().active!.grid
    const mirror = (hexId: number) => gridRef.getRotatedHexId(hexId)!

    // 2 and 40 are not rotation partners (2->44, 40->6), so their target tiles stay
    // empty and the sources vacate cleanly (exercising the occupied -> available
    // demotion).
    expect(s.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    expect(s.character.placeCharacterOnHex(40, ENEMY_A, Team.ENEMY)).toBe(true)

    s.urlState.swapTeamsAllBoards()

    // Each unit sits on its mirror tile, now on the opposite team.
    expect(s.grid.getTile(mirror(2)).characterId).toBe(ALLY_A)
    expect(s.grid.getTile(mirror(2)).team).toBe(Team.ENEMY)
    expect(s.grid.getTile(mirror(40)).characterId).toBe(ENEMY_A)
    expect(s.grid.getTile(mirror(40)).team).toBe(Team.ALLY)

    // Source tiles vacated, back to an available (not occupied) state.
    expect(s.grid.getTile(2).characterId).toBeUndefined()
    expect(s.grid.getTile(2).state).toBe(State.AVAILABLE_ALLY)
    expect(s.grid.getTile(40).characterId).toBeUndefined()
    expect(s.grid.getTile(40).state).toBe(State.AVAILABLE_ENEMY)

    // Global invariant: a tile is in an occupied state iff it holds a character.
    for (const tile of s.grid.getAllTiles) {
      const occupied = tile.state === State.OCCUPIED_ALLY || tile.state === State.OCCUPIED_ENEMY
      expect(occupied).toBe(tile.characterId !== undefined)
    }
  })

  it('swaps the artifact slots', () => {
    const s = createStores()
    s.artifact.placeArtifact(3, Team.ALLY)
    s.artifact.placeArtifact(5, Team.ENEMY)

    s.urlState.swapTeamsAllBoards()

    expect(s.artifact.allyArtifactId).toBe(5)
    expect(s.artifact.enemyArtifactId).toBe(3)
  })

  it('is an involution: swapping twice restores the original layout', () => {
    const s = createStores()
    expect(s.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    expect(s.character.placeCharacterOnHex(40, ENEMY_A, Team.ENEMY)).toBe(true)
    s.artifact.placeArtifact(3, Team.ALLY)
    const before = snapshotTiles(s.grid)

    s.urlState.swapTeamsAllBoards()
    s.urlState.swapTeamsAllBoards()

    expect(snapshotTiles(s.grid)).toEqual(before)
    expect(s.artifact.allyArtifactId).toBe(3)
    expect(s.artifact.enemyArtifactId).toBeNull()
  })
})
