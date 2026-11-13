import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { decomposeUnitId, toSynergyId } from '@/lib/characters/synergy'
import { encodeGridStateToUrl, encodeTeamData } from '@/lib/teams/codec'
import {
  serializeGridState,
  serializeMultiGridState,
  type DisplayFlags,
} from '@/lib/teams/gridStateSerializer'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useBoardRestore } from '@/stores/boardRestore'
import { useCharacterStore } from '@/stores/character'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { MAX_GRID_COUNT, useGrids } from '@/stores/grids'
import {
  ALLY_A,
  ALLY_B,
  ALLY_C,
  ENEMY_A,
  ENEMY_B,
  EVIE,
  PHRAESTO,
  PHRAESTO_COMPANION,
} from '../fixtures/characters'

/**
 * Round-trip tests for the boardRestore store's restore path: state is built with
 * the real grid/character/artifact stores, serialized and encoded with the real
 * URL utils, then restored into fresh stores via restoreFromEncodedState.
 *
 * Default map (arena1): ally spawns are hexes 1-10/12/13/16, enemy spawns are
 * hexes 30/33/34/36-45; everything else is DEFAULT.
 */

interface TestStores {
  grid: ReturnType<typeof useGridStore>
  character: ReturnType<typeof useCharacterStore>
  artifact: ReturnType<typeof useArtifactStore>
  boardRestore: ReturnType<typeof useBoardRestore>
}

// Swaps in a fresh Pinia, so a second call yields pristine restore-target
// stores while the first set keeps working against its own Pinia instance.
const createStores = (): TestStores => {
  setActivePinia(createPinia())
  return {
    grid: useGridStore(),
    character: useCharacterStore(),
    artifact: useArtifactStore(),
    boardRestore: useBoardRestore(),
  }
}

const encodeStores = ({ grid, artifact }: TestStores, displayFlags: DisplayFlags = {}): string =>
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

describe('boardRestore.restoreFromEncodedState', () => {
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
      showPerspective: false,
      showSkills: true,
      teamView: true,
      inverted: true,
      wrap: true,
    }
    const encoded = encodeStores(source, flags)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    const result = restored.boardRestore.restoreFromEncodedState(encoded)

    expect(result.success).toBe(true)
    expect(result.displayFlags).toEqual(flags)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
    expect(restored.artifact.allyArtifactId).toBe(3)
    expect(restored.artifact.enemyArtifactId).toBe(5)
  })

  it('round-trips upgrade attrs into the restored board', () => {
    const source = createStores()
    const sourceGrids = useGrids()
    expect(source.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(40, ENEMY_A, Team.ENEMY)).toBe(true)
    sourceGrids.active!.setAttr(Team.ALLY, ALLY_A, ATTR_PARAGON, 4)
    sourceGrids.active!.setAttr(Team.ALLY, ALLY_A, ATTR_REFINEMENT, 3)
    sourceGrids.active!.setAttr(Team.ENEMY, ENEMY_A, ATTR_PARAGON, 2)

    const encoded = encodeGridStateToUrl(
      serializeGridState(
        source.grid.getAllTiles,
        source.artifact.allyArtifactId,
        source.artifact.enemyArtifactId,
        {},
        sourceGrids.active!.getAttrs,
      ),
    )

    const target = createStores()
    const targetGrids = useGrids()
    expect(target.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)
    // Both attrs of a two-key record survive: restore merges per-row setAttr
    // calls into one record rather than replacing it.
    expect(targetGrids.active!.getAttr(Team.ALLY, ALLY_A, ATTR_PARAGON)).toBe(4)
    expect(targetGrids.active!.getAttr(Team.ALLY, ALLY_A, ATTR_REFINEMENT)).toBe(3)
    expect(targetGrids.active!.getAttr(Team.ENEMY, ENEMY_A, ATTR_PARAGON)).toBe(2)
    // A hero with no stored level defaults to 0.
    expect(targetGrids.active!.getAttr(Team.ALLY, ALLY_B, ATTR_PARAGON)).toBe(0)
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
    expect(useGrids().active!.move(spawnHexId, companionHexId, PHRAESTO_COMPANION)).toBe(true)

    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

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

  it('recomputes skill targeting once the last companion is settled', () => {
    // Evie's quill follows the rearmost ally (the lowest ally hex), so a
    // companion settled on hex 1 after its main's placement is her target only
    // if the skills are refreshed at the end. The spawn is pinned so the
    // companion never lands on hex 1 by chance.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const source = createStores()
    expect(source.character.placeCharacterOnHex(5, EVIE, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(6, PHRAESTO, Team.ALLY)).toBe(true)
    const spawnHexId = source.grid.getAllTiles
      .find((t) => t.characterId === PHRAESTO_COMPANION)!
      .hex.getId()
    expect(spawnHexId).not.toBe(1)
    expect(useGrids().active!.move(spawnHexId, 1, PHRAESTO_COMPANION)).toBe(true)
    const encoded = encodeStores(source)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

    expect(restored.grid.getTile(1).characterId).toBe(PHRAESTO_COMPANION)
    const ctx = useGrids().active!
    expect(ctx.skillManager.getSkillTarget(EVIE, Team.ALLY)?.targetHexId).toBe(1)
  })

  it('adopts the preset a map-less payload reproduces, populated or not', () => {
    const source = createStores()
    expect(source.grid.switchMap('arena2')).toBe(true)
    const spawn = source.grid.getAllTiles.find((t) => t.state === State.AVAILABLE_ALLY)!
    expect(source.character.placeCharacterOnHex(spawn.hex.getId(), ALLY_A, Team.ALLY)).toBe(true)
    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

    expect(restored.grid.currentMap).toBe('arena2')
    expect(snapshotTiles(restored.grid)).toEqual(expected)
  })

  it('keeps the current map when the tiles match no preset', () => {
    const source = createStores()
    source.grid.setState(source.grid.getHexById(20), State.BLOCKED)
    const encoded = encodeStores(source)

    const restored = createStores()
    expect(restored.grid.switchMap('arena2')).toBe(true)
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

    expect(restored.grid.currentMap).toBe('arena2')
    expect(restored.grid.getTile(20).state).toBe(State.BLOCKED)
    expect(snapshotTiles(restored.grid)).toEqual(snapshotTiles(source.grid))
  })

  it('round-trips phantimals through their local-id mapping', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(3, toPhantimalId(2), Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(44, toPhantimalId(1), Team.ENEMY)).toBe(true)

    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

    // Serialized as local ids (2/1); restored tiles carry the namespaced ids again.
    expect(snapshotTiles(restored.grid)).toEqual(expected)
  })

  it('leaves the Non-Seasonal format for a link with seasonal content, which lands whole', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(3, toPhantimalId(2), Team.ALLY)).toBe(true)
    source.artifact.placeArtifact(8, Team.ENEMY)
    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    useGrids().setNonSeasonal(true)
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)

    expect(useGrids().nonSeasonal).toBe(false)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
    expect(restored.artifact.enemyArtifactId).toBe(8)
  })

  it('rejects garbage encoded strings and leaves existing state untouched', () => {
    const stores = createStores()
    expect(stores.character.placeCharacterOnHex(2, ALLY_A, Team.ALLY)).toBe(true)
    stores.artifact.placeArtifact(3, Team.ALLY)
    const before = snapshotTiles(stores.grid)

    // '!' and '$' are outside the URL-safe alphabet, so decoding fails outright;
    // 'A' is inside the alphabet but too short to decode to a single byte.
    for (const garbage of ['!!!not-an-encoded-state$$$', 'A']) {
      const result = stores.boardRestore.restoreFromEncodedState(garbage)

      expect(result.success).toBe(false)
      expect(result.displayFlags).toBeUndefined()
      expect(snapshotTiles(stores.grid)).toEqual(before)
    }
    expect(stores.artifact.allyArtifactId).toBe(3)
  })

  it('keeps a summoner whose units fill its side exactly', () => {
    const source = createStores()
    // Shrink the ally zone to the six tiles a full side with Phraesto's shadow
    // fills, so a saved layout leaves no other tile free for his skill.
    for (const hexId of [7, 8, 9, 10, 12, 13, 16]) {
      source.grid.setState(source.grid.getHexById(hexId), State.DEFAULT)
    }
    expect(source.character.placeCharacterOnHex(1, PHRAESTO, Team.ALLY)).toBe(true)
    const free = source.grid.getAllTiles
      .filter((t) => t.state === State.AVAILABLE_ALLY && t.characterId === undefined)
      .map((t) => t.hex.getId())
    expect(free).toHaveLength(4)
    ;[ALLY_A, ALLY_B, ALLY_C, ENEMY_A].forEach((id, i) => {
      expect(source.character.placeCharacterOnHex(free[i]!, id, Team.ALLY)).toBe(true)
    })
    const encoded = encodeStores(source)
    const expected = snapshotTiles(source.grid)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
  })

  it('frees a saved tile marked occupied with nothing on it', () => {
    const source = createStores()
    source.grid.setState(source.grid.getHexById(9), State.OCCUPIED_ALLY)
    const encoded = encodeStores(source)

    const restored = createStores()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)
    expect(restored.grid.getTile(9).state).toBe(State.AVAILABLE_ALLY)
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

    const result = target.boardRestore.restoreFromEncodedState(encoded)

    expect(result.success).toBe(true)
    expect(target.grid.getTile(1).characterId).toBeUndefined()
    expect(target.grid.getTile(20).state).toBe(State.DEFAULT)
    expect(target.artifact.enemyArtifactId).toBeNull()
    expect(target.grid.getTile(40).characterId).toBe(ENEMY_A)
    expect(target.artifact.allyArtifactId).toBe(7)
    expect(snapshotTiles(target.grid)).toEqual(expected)
  })
})

describe('boardRestore.restoreMultiFromEncodedState', () => {
  const encodeBoards = (grids: ReturnType<typeof useGrids>): string =>
    encodeTeamData(
      serializeMultiGridState(
        grids.contexts.map((ctx) => ({
          tiles: ctx.grid.getAllTiles(),
          allyArtifact: ctx.artifacts.ally,
          enemyArtifact: ctx.artifacts.enemy,
          map: ctx.currentMap,
          getAttrs: ctx.getAttrs,
        })),
        grids.activeId,
      ),
    )

  it('restores each board with its serialized map key', () => {
    createStores()
    const grids = useGrids()
    grids.setGridCount(2, ['arena2', 'preset-sr1'])
    const encoded = encodeBoards(grids)

    const restored = createStores()
    expect(restored.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    expect(useGrids().contexts.map((ctx) => ctx.currentMap)).toEqual(['arena2', 'preset-sr1'])
  })

  it('caps a crafted URL at the supported board count', () => {
    const s = createStores()
    const encoded = encodeTeamData({
      boards: Array.from({ length: MAX_GRID_COUNT + 3 }, () => ({})),
    })

    expect(s.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    expect(useGrids().contexts).toHaveLength(MAX_GRID_COUNT)
  })

  it('drops a malformed unit row on its own and restores the rest of the saved team', () => {
    const restored = createStores()
    const encoded = canonicalTeamData(
      encodeTeamData({
        boards: [
          {
            m: 'arena1',
            t: [1, 2, 3, 4, 5].map((hexId) => [hexId, State.AVAILABLE_ALLY]),
            c: [
              [1, ALLY_A, Team.ALLY],
              [2],
              [3, ALLY_B],
              [4, toSynergyId(ALLY_B), Team.ALLY],
              [5, ALLY_C, Team.ALLY],
            ],
            u: [[Team.ALLY, ALLY_C, ATTR_PARAGON, 2], [Team.ALLY]],
            a: [1, null],
          },
        ],
      }),
    )

    expect(restored.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    expect(restored.character.charactersPlaced).toBe(2)
    expect(restored.grid.getTile(1).characterId).toBe(ALLY_A)
    expect(restored.grid.getTile(5).characterId).toBe(ALLY_C)
    expect(useGrids().active!.getAttrs(Team.ALLY, ALLY_C)).toEqual({ [ATTR_PARAGON]: 2 })
    expect(restored.artifact.allyArtifactId).toBe(1)
  })

  it('dedupes a character restored on the same team of two boards, keeping the first', () => {
    createStores()
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    // ctx.place validates per grid only, so the page-wide duplicate can be built
    // and serialized; restore must repair it.
    expect(a!.place(1, ALLY_A, Team.ALLY)).toBe(true)
    expect(b!.place(2, ALLY_A, Team.ALLY)).toBe(true)
    const encoded = encodeBoards(grids)

    const restored = createStores()
    expect(restored.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    const fresh = useGrids()
    expect(fresh.contexts[0]!.grid.getTileById(1).characterId).toBe(ALLY_A)
    expect(fresh.contexts[1]!.grid.getTileById(2).characterId).toBeUndefined()
  })
})

describe('synergy restore', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('round-trips a synergy duplicate and its companions onto their saved hexes', () => {
    const source = createStores()
    expect(source.character.placeCharacterOnHex(2, PHRAESTO, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(7, toSynergyId(PHRAESTO), Team.ALLY)).toBe(true)

    const expected = snapshotTiles(source.grid)
    const encoded = encodeStores(source)

    const restored = createStores()
    const restoredGrids = useGrids()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)
    expect(snapshotTiles(restored.grid)).toEqual(expected)
    expect(restoredGrids.synergy).toBe(true)
  })

  it('restores a phantimal whose faction requirement depends on the synergy hero', () => {
    const FACTIONS: Record<number, string> = { 601: 'wilder', 602: 'wilder', 603: 'wilder' }
    const wilderPhantimal = {
      id: 1,
      name: 'test-phantimal',
      season: 7,
      range: 2,
      damage: 'physical',
      faction: 'wilder',
      class: 'warrior',
    }
    const mockGameData = (): void => {
      const gameData = useGameDataStore()
      vi.spyOn(gameData, 'getCharacterFaction').mockImplementation(
        (id: number) => FACTIONS[decomposeUnitId(id).localId],
      )
      vi.spyOn(gameData, 'getPhantimalById').mockReturnValue(wilderPhantimal)
    }

    const source = createStores()
    mockGameData()
    expect(source.character.placeCharacterOnHex(1, 601, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(2, 602, Team.ALLY)).toBe(true)
    expect(source.character.placeCharacterOnHex(3, toSynergyId(603), Team.ALLY)).toBe(true)
    expect(source.character.placePhantimalOnHex(4, toPhantimalId(1), Team.ALLY)).toBe(true)
    const encoded = encodeStores(source)

    const restored = createStores()
    mockGameData()
    expect(restored.boardRestore.restoreFromEncodedState(encoded).success).toBe(true)
    expect(restored.grid.getTile(3).characterId).toBe(toSynergyId(603))
    expect(restored.grid.getTile(4).characterId).toBe(toPhantimalId(1))
  })

  it('drops crafted out-of-band ids instead of misplacing them', () => {
    const restored = createStores()
    const encoded = encodeTeamData({
      boards: [{ c: [[1, toSynergyId(PHRAESTO), Team.ALLY]], y: [[2, 100005, Team.ALLY]] }],
    })
    expect(restored.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    expect(restored.character.charactersPlaced).toBe(0)
  })

  it('skips a unit on a tile the board lacks and restores the rest', () => {
    const restored = createStores()
    // Restore replays t; a payload without it restores a blank map.
    const { t } = serializeGridState(restored.grid.getAllTiles, null, null)
    const encoded = encodeTeamData({
      boards: [
        {
          t,
          c: [
            [0, 601, Team.ALLY],
            [99, 602, Team.ALLY],
            [1, 603, Team.ALLY],
          ],
        },
      ],
    })
    expect(restored.boardRestore.restoreMultiFromEncodedState(encoded).success).toBe(true)
    expect(restored.grid.getTile(1).characterId).toBe(603)
    expect(restored.character.charactersPlaced).toBe(1)
  })
})
