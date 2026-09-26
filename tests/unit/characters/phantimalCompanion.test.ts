/**
 * Companions spawned by a phantimal's skill: the mirrored id band, the generic
 * companion lifecycle running inside it, and the serialization, restore and
 * side-load paths that carry them. Uses a test-only owner (local id 13; ids
 * 13-15 are reserved for tests, which caps a season at 12 phantimals) so the
 * suite outlives any season's roster; delete this file together with the
 * phantimal-companion seams if the feature is removed.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  findCharacterHex,
  getAvailableTeamSize,
  getMaxTeamSize,
  isCompanionUnitId,
} from '@/lib/characters/character'
import { getMainCharacterId, isCompanionId } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import {
  companionLocalId,
  inPhantimalBand,
  isPhantimalId,
  joinPhantimalBandLocal,
  PHANTIMAL_COMPANION_STRIDE,
  phantimalBandLocal,
  phantimalOwnerId,
  splitPhantimalBandLocal,
  toLocalPhantimalId,
  toPhantimalId,
} from '@/lib/characters/phantimal'
import { countTeamFaction } from '@/lib/characters/phantimalFaction'
import { executePlaceCharacter } from '@/lib/characters/place'
import { executeRemoveCharacter } from '@/lib/characters/remove'
import { BASE_TEAM_SIZE, COMPANION_ID_OFFSET, Grid } from '@/lib/grid'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { registerSkill, SkillManager } from '@/lib/skills/skill'
import { createCompanionSkill } from '@/lib/skills/utils/builders'
import { buildSideLoadPlan } from '@/lib/teams/sideLoad'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useGridStore } from '@/stores/grid'
import { useUrlStateStore } from '@/stores/urlState'
import { serializeGridState } from '@/utils/gridStateSerializer'
import {
  decodeGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
} from '@/utils/urlStateManager'
import { ALLY_A, ALLY_B, ALLY_C, ENEMY_A, ENEMY_B } from '../fixtures/characters'

const OWNER_LOCAL = 13
const OWNER = toPhantimalId(OWNER_LOCAL)
const COMPANION = OWNER + 10000

registerSkill(
  createCompanionSkill({
    id: 'test-phantimal-companion',
    characterId: OWNER,
    raisesCapacity: false,
    companionImageModifier: 'test-companion',
    companionRange: 20,
  }),
)

// Default map (arena1): ally spawns are hexes 1-10/12/13/16, enemy spawns are
// hexes 30/33/34/36-45.
const allyHexes = (grid: Grid): number[] =>
  grid
    .getAllTiles()
    .filter((tile) => tile.state === State.AVAILABLE_ALLY)
    .map((tile) => tile.hex.getId())

describe('phantimal companion ids', () => {
  const grid = new Grid()

  it('splits the band into the phantimal and the companions it spawns', () => {
    expect(inPhantimalBand(OWNER)).toBe(true)
    expect(inPhantimalBand(COMPANION)).toBe(true)
    expect(isPhantimalId(OWNER)).toBe(true)
    expect(isPhantimalId(COMPANION)).toBe(false)
    expect(phantimalBandLocal(COMPANION)).toBe(10000 + OWNER_LOCAL)
    expect(phantimalOwnerId(COMPANION)).toBe(OWNER)
    expect(phantimalOwnerId(OWNER)).toBe(OWNER)
    expect(toLocalPhantimalId(COMPANION)).toBe(OWNER_LOCAL)
  })

  // The leaf module spells the stride as a literal; the generic companion
  // arithmetic uses COMPANION_ID_OFFSET, so the two must agree.
  it('mirrors the companion stride of the base band', () => {
    expect(PHANTIMAL_COMPANION_STRIDE).toBe(COMPANION_ID_OFFSET)
    expect(splitPhantimalBandLocal(10000 + OWNER_LOCAL)).toEqual({
      ownerLocal: OWNER_LOCAL,
      index: 1,
    })
    expect(joinPhantimalBandLocal(OWNER_LOCAL, 1)).toBe(10000 + OWNER_LOCAL)
  })

  it('classifies the companion like any companion, owned by its phantimal', () => {
    expect(companionLocalId(COMPANION)).toBe(10000 + OWNER_LOCAL)
    expect(isCompanionId(grid, COMPANION)).toBe(true)
    expect(isCompanionUnitId(COMPANION)).toBe(true)
    expect(getMainCharacterId(grid, COMPANION)).toBe(OWNER)
    expect(isCompanionId(grid, OWNER)).toBe(false)
    expect(isCompanionUnitId(OWNER)).toBe(false)
  })
})

describe('phantimal companion lifecycle', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  it('spawns the companion on a free tile of the phantimal team', () => {
    const free = allyHexes(grid).filter((hexId) => hexId !== 1)
    expect(executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)).toBe(true)
    expect(free).toContain(findCharacterHex(grid, COMPANION, Team.ALLY))
  })

  it('holds no team slot and leaves capacity untouched', () => {
    executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)

    executeRemoveCharacter(grid, skillManager, 1)
    expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
  })

  // The common path: the third qualifying hero is often the fifth, so the
  // phantimal lands on a full team and its companion must still spawn and move.
  it('spawns and moves the companion on a full team', () => {
    for (const [hexId, heroId] of [
      [2, 100],
      [3, 101],
      [4, 102],
      [5, 103],
      [6, 104],
    ]) {
      expect(executePlaceCharacter(grid, skillManager, hexId!, heroId!, Team.ALLY)).toBe(true)
    }
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(0)

    expect(executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)).toBe(true)
    const companionHex = findCharacterHex(grid, COMPANION, Team.ALLY)!
    expect(companionHex).not.toBeNull()

    const free = allyHexes(grid).find((hexId) => hexId !== companionHex)!
    expect(executeMoveCharacter(grid, skillManager, companionHex, free, COMPANION)).toBe(true)
    expect(findCharacterHex(grid, COMPANION, Team.ALLY)).toBe(free)
  })

  it('removes both when either is removed', () => {
    executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)
    const companionHex = findCharacterHex(grid, COMPANION, Team.ALLY)!
    expect(executeRemoveCharacter(grid, skillManager, companionHex)).toBe(true)
    expect(findCharacterHex(grid, OWNER, Team.ALLY)).toBeNull()
    expect(findCharacterHex(grid, COMPANION, Team.ALLY)).toBeNull()
  })

  it('cannot change teams', () => {
    executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)
    const companionHex = findCharacterHex(grid, COMPANION, Team.ALLY)!
    expect(executeMoveCharacter(grid, skillManager, companionHex, 40, COMPANION)).toBe(false)
    expect(findCharacterHex(grid, COMPANION, Team.ALLY)).toBe(companionHex)
  })

  it('never counts toward a phantimal faction requirement', () => {
    executePlaceCharacter(grid, skillManager, 1, OWNER, Team.ALLY)
    expect(countTeamFaction(grid, Team.ALLY, ['celestial'], () => 'celestial')).toBe(0)
  })
})

describe('phantimal companion serialization', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    executePlaceCharacter(grid, skillManager, 16, OWNER, Team.ALLY)
  })

  it('stores the companion band-local in s, after its phantimal and out of c', () => {
    const state = serializeGridState(grid.getAllTiles(), null, null)
    const companionHex = findCharacterHex(grid, COMPANION, Team.ALLY)!
    expect(state.c).toBeUndefined()
    expect(state.s).toEqual([
      [16, OWNER_LOCAL, Team.ALLY],
      [companionHex, 10000 + OWNER_LOCAL, Team.ALLY],
    ])
  })

  it('round-trips through a binary link unchanged', () => {
    const state = serializeGridState(grid.getAllTiles(), null, null)
    expect(decodeGridStateFromUrl(encodeGridStateToUrl(state))?.s).toEqual(state.s)
  })

  // The companion section (bit 6) without the phantimal section (bit 3).
  it('round-trips a companion row without its phantimal', () => {
    const s = [[9, 10000 + OWNER_LOCAL, Team.ALLY]]
    expect(decodeGridStateFromUrl(encodeGridStateToUrl({ s }))?.s).toEqual(s)
  })

  it('restores the companion onto its saved hex', () => {
    // Every ally hex is tried as the saved spot, so the restore's random
    // spawn landing on the target can't make a broken settle pass.
    const arena = new Grid().getAllTiles()
    // Restore replays t; a payload without it restores a blank map.
    const { t } = serializeGridState(arena, null, null)
    const targets = arena
      .filter((tile) => tile.state === State.AVAILABLE_ALLY && tile.hex.getId() !== 16)
      .map((tile) => tile.hex.getId())
    for (const target of targets) {
      setActivePinia(createPinia())
      const gridStore = useGridStore()
      const encoded = encodeGridStateToUrl({
        t,
        s: [
          [16, OWNER_LOCAL, Team.ALLY],
          [target, 10000 + OWNER_LOCAL, Team.ALLY],
        ],
      })

      expect(useUrlStateStore().restoreFromEncodedState(encoded).success).toBe(true)
      expect(gridStore.getTile(16).characterId).toBe(OWNER)
      expect(gridStore.getTile(target).characterId).toBe(COMPANION)
      expect(gridStore.getAllTiles.filter((tile) => tile.characterId === COMPANION)).toHaveLength(1)
    }
  })

  it('restores the phantimal and its companion onto a full team', () => {
    setActivePinia(createPinia())
    const gridStore = useGridStore()
    const { t } = serializeGridState(new Grid().getAllTiles(), null, null)
    const encoded = encodeGridStateToUrl({
      t,
      c: [
        [1, ALLY_A, Team.ALLY],
        [2, ALLY_B, Team.ALLY],
        [3, ALLY_C, Team.ALLY],
        [4, ENEMY_A, Team.ALLY],
        [5, ENEMY_B, Team.ALLY],
      ],
      s: [
        [16, OWNER_LOCAL, Team.ALLY],
        [9, 10000 + OWNER_LOCAL, Team.ALLY],
      ],
    })

    expect(useUrlStateStore().restoreFromEncodedState(encoded).success).toBe(true)
    expect(gridStore.getTile(16).characterId).toBe(OWNER)
    expect(gridStore.getTile(9).characterId).toBe(COMPANION)
  })

  it('side-loads the companion as a settle target of its phantimal', () => {
    const record = encodeMultiGridStateToUrl({
      boards: [
        {
          m: 'arena1',
          s: [
            [16, OWNER_LOCAL, Team.ALLY],
            [9, 10000 + OWNER_LOCAL, Team.ALLY],
          ],
        },
      ],
      mode: '1v1',
      season: CURRENT_SEASON,
    })
    const board = buildSideLoadPlan(record, false)!.boards[0]!
    expect(board.phantimal).toEqual({ unitId: OWNER, hexId: 16, attrs: {} })
    expect(board.companions).toEqual([{ unitId: COMPANION, hexId: 9, mainUnitId: OWNER }])
  })
})
