import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { teamsSlotKey, type ActiveSlot } from '@/composables/useGridPersistence'
import { useSeasonNotice } from '@/composables/useSeasonNotice'
import { useTeamsRestore } from '@/composables/useTeamsRestore'
import { DEFAULT_MAP_KEY } from '@/lib/maps'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { TEAM_VARIANTS, type TeamModeKey } from '@/lib/teams/modes'
import { teamVariant } from '@/lib/teams/preview'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGrids } from '@/stores/grids'
import { packDisplayFlags, type DisplayFlags } from '@/utils/gridStateSerializer'
import { runModeStoragePass } from '@/utils/upgradeMigration'
import {
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToLinkUrl,
  encodeMultiGridStateToUrl,
} from '@/utils/urlStateManager'
import { stubLocalStorage } from '../fixtures/storage'

/* The mode-switch regression suite: per-mode slot isolation (one mode's edits
 * must never overwrite another mode's save), the type switch and New on top
 * of the single 5v5 slot, plus the ?g= ingress routing (mode resolution +
 * shape normalization). Headless: node env, in-memory localStorage, SSR off. */

let storage: Map<string, string>
let setItemSpy: ReturnType<typeof stubLocalStorage>['setItemSpy']

beforeEach(() => {
  vi.stubEnv('SSR', false)
  ;({ storage, setItemSpy } = stubLocalStorage())
  // Module singleton: a notice raised in one test must not leak into the next.
  useSeasonNotice().dismiss()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const readEnvelope = (mode: TeamModeKey): ActiveSlot =>
  JSON.parse(storage.get(teamsSlotKey(mode))!) as ActiveSlot

const decodeBoards = (encoded: string) => decodeMultiGridStateFromUrl(encoded)!

const currentMaps = (grids: ReturnType<typeof useGrids>): string[] =>
  grids.contexts.map((ctx) => ctx.currentMap)

interface Harness {
  restore: ReturnType<typeof useTeamsRestore>
  grids: ReturnType<typeof useGrids>
  character: ReturnType<typeof useCharacterStore>
  flags: DisplayFlags
  wrapBoards: ReturnType<typeof ref<boolean>>
  inverted: ReturnType<typeof ref<boolean>>
}

function createHarness(resolveSourceId?: (id: string | null) => string | null): Harness {
  setActivePinia(createPinia())
  const grids = useGrids()
  const character = useCharacterStore()
  const flags: DisplayFlags = { showSkills: true, wrap: false }
  const wrapBoards = ref(false)
  const inverted = ref(false)
  const restore = useTeamsRestore({
    getFlags: () => ({ ...flags, wrap: wrapBoards.value, inverted: inverted.value }),
    applyFlags: (next) => {
      Object.assign(flags, next)
      wrapBoards.value = next.wrap ?? false
      inverted.value = next.inverted ?? false
    },
    applySize: () => {},
    resolveSourceId,
  })
  return { restore, grids, character, flags, wrapBoards, inverted }
}

describe('useTeamsRestore', () => {
  it('initialize without link or slots builds the default mode on its initial type', () => {
    const { restore, grids } = createHarness()
    const result = restore.initialize(null)
    expect(result).toEqual({ linkLoaded: false, linkFailed: false })
    expect(restore.activeMode.value).toBe('5v5')
    expect(grids.contexts).toHaveLength(5)
    expect(currentMaps(grids)).toEqual(TEAM_VARIANTS.sl.maps)
    expect(restore.variant.value).toBe('sl')
    expect(storage.get('stargazer.teams.mode')).toBe('5v5')
    expect(readEnvelope('5v5').sourceId).toBeNull()
  })

  it('REGRESSION: per-mode edits survive round-trips through other modes', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)

    // Edit the 5v5 boards: one ally on board 0, one on board 2.
    grids.setActive(0)
    expect(character.placeCharacterOnHex(1, 11, Team.ALLY)).toBe(true)
    grids.setActive(2)
    expect(character.placeCharacterOnHex(2, 12, Team.ALLY)).toBe(true)
    await nextTick() // let autosave mirror the edits
    const savedFive = readEnvelope('5v5').data

    // Switch to 3v3: clean slate on Guild Duel, correct shape, 5v5 slot untouched.
    restore.switchMode('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(currentMaps(grids)).toEqual(TEAM_VARIANTS.gd.maps)
    expect(restore.variant.value).toBe('gd')
    const fiveBoards = decodeBoards(readEnvelope('5v5').data)
    expect(fiveBoards.boards[0]!.c).toEqual([[1, 11, Team.ALLY]])
    expect(fiveBoards.boards[2]!.c).toEqual([[2, 12, Team.ALLY]])
    const threeBoards = decodeBoards(readEnvelope('3v3').data)
    expect(threeBoards.boards.every((b) => !b.c)).toBe(true)

    // Edit 3v3 (board 0 is arena1, so the hex is placeable), then bounce
    // through the other mode and back.
    grids.setActive(0)
    expect(character.placeCharacterOnHex(3, 13, Team.ALLY)).toBe(true)
    await nextTick()
    restore.switchMode('1v1')
    restore.switchMode('5v5')

    // 5v5 restored byte-identical to its pre-switch snapshot.
    expect(readEnvelope('5v5').data).toBe(savedFive)
    expect(grids.contexts).toHaveLength(5)

    // 3v3 kept its own edit.
    restore.switchMode('3v3')
    const threeAfter = decodeBoards(readEnvelope('3v3').data)
    expect(threeAfter.boards[0]!.c).toEqual([[3, 13, Team.ALLY]])
  })

  it('switchVariant rebuilds every board on the chosen list and detaches provenance', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)
    restore.sourceId.value = 'team-sl'
    grids.setActive(0)
    character.placeCharacterOnHex(1, 11, Team.ALLY)
    await nextTick()

    restore.switchVariant('default')
    expect(grids.contexts).toHaveLength(5)
    expect(currentMaps(grids)).toEqual(Array<string>(5).fill(DEFAULT_MAP_KEY))
    expect(restore.variant.value).toBe('default')
    expect(restore.sourceId.value).toBeNull()
    const slot = readEnvelope('5v5')
    expect(slot.sourceId).toBeNull()
    expect(decodeBoards(slot.data).boards.every((b) => !b.c)).toBe(true)

    restore.switchVariant('sl')
    expect(currentMaps(grids)).toEqual(TEAM_VARIANTS.sl.maps)
    expect(restore.variant.value).toBe('sl')
  })

  it('never writes the old slot after its flush nor the new slot before the baseline', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)
    grids.setActive(0)
    character.placeCharacterOnHex(1, 11, Team.ALLY)
    await nextTick()

    setItemSpy.mockClear()
    restore.switchMode('3v3')
    const keys = setItemSpy.mock.calls.map(([key]) => key)
    const oldKey = teamsSlotKey('5v5')
    const newKey = teamsSlotKey('3v3')
    // Exactly one flush of the old slot, first; the new slot written only after.
    expect(keys[0]).toBe(oldKey)
    expect(keys.filter((k) => k === oldKey)).toHaveLength(1)
    expect(keys.indexOf(newKey)).toBeGreaterThan(0)

    // The post-sequence watcher tick may re-write the NEW slot only.
    setItemSpy.mockClear()
    await nextTick()
    expect(setItemSpy.mock.calls.every(([key]) => key !== oldKey)).toBe(true)
  })

  // A slot restores the maps it holds and the type is read off them, so a
  // rotation that edits the SL row leaves an old slot on its old maps with
  // nothing lit.
  it('a restored slot keeps its maps and derives its type from them', () => {
    const { restore, grids } = createHarness()
    storage.set(
      teamsSlotKey('5v5'),
      JSON.stringify({
        v: 1,
        data: encodeMultiGridStateToUrl({
          boards: ['arena1', 'arena3', 'arena1', 'arena1', 'arena1'].map((m) => ({ m })),
          mode: '5v5',
        }),
        sourceId: null,
      } satisfies ActiveSlot),
    )
    restore.initialize(null)
    expect(currentMaps(grids)).toEqual(['arena1', 'arena3', 'arena1', 'arena1', 'arena1'])
    expect(restore.variant.value).toBeNull()
  })

  it('slot restore ignores stored display flags entirely (device prefs win)', () => {
    const { restore, flags, inverted, wrapBoards } = createHarness()
    storage.set(
      teamsSlotKey('3v3'),
      JSON.stringify({
        v: 1,
        data: encodeMultiGridStateToUrl({
          boards: [{ m: 'arena1' }, { m: 'arena1' }, { m: 'arena1' }],
          mode: '3v3',
          d: packDisplayFlags({ showSkills: false, teamView: true, inverted: true }),
        }),
        sourceId: null,
      } satisfies ActiveSlot),
    )
    restore.initialize(null)
    restore.switchMode('3v3')
    expect(flags.showSkills).toBe(true)
    expect(flags.teamView).toBeUndefined()
    expect(inverted.value).toBe(false)
    expect(wrapBoards.value).toBe(false)
  })

  it('raises the season notice when a quiet slot restore strips retired content', () => {
    const { restore } = createHarness()
    const { season } = useSeasonNotice()
    storage.set(
      teamsSlotKey('3v3'),
      JSON.stringify({
        v: 1,
        data: encodeMultiGridStateToUrl({
          boards: [{ m: 'arena1', s: [[7, 2, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
          mode: '3v3',
          season: CURRENT_SEASON - 1,
        }),
        sourceId: null,
      } satisfies ActiveSlot),
    )
    restore.initialize(null)
    expect(season.value).toBeNull()
    restore.switchMode('3v3')
    expect(season.value).toBe(CURRENT_SEASON - 1)
  })

  it('keeps the season notice quiet for a stale stamp with no seasonal content', () => {
    const { restore } = createHarness()
    const { season } = useSeasonNotice()
    storage.set(
      teamsSlotKey('3v3'),
      JSON.stringify({
        v: 1,
        data: encodeMultiGridStateToUrl({
          boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
          mode: '3v3',
          season: CURRENT_SEASON - 1,
        }),
        sourceId: null,
      } satisfies ActiveSlot),
    )
    restore.initialize(null)
    restore.switchMode('3v3')
    expect(season.value).toBeNull()
  })

  it('mode switches leave the view toggles untouched (wrap and inverted included)', () => {
    // Wrap render gating is the layout side, so the flag survives non-wrap modes
    const { restore, inverted, wrapBoards } = createHarness()
    restore.initialize(null)
    inverted.value = true
    wrapBoards.value = true
    restore.switchMode('3v3')
    expect(inverted.value).toBe(true)
    expect(wrapBoards.value).toBe(true)
  })

  it('ingress: a shared link adopts all display flags', () => {
    const { restore, flags, inverted } = createHarness()
    const link = encodeMultiGridStateToLinkUrl({
      boards: [{ m: 'arena1' }],
      mode: '1v1',
      d: packDisplayFlags({ showSkills: false, inverted: true }),
    })
    restore.initialize(link)
    expect(flags.showSkills).toBe(false)
    expect(inverted.value).toBe(true)
  })

  // The copy-link → paste round trip through the wire format: the link is
  // built exactly as TeamsView's copy action builds it (snapshot decoded and
  // re-encoded for the wire), then fed to the ingress every recipient runs.
  it('ingress: a binary teams link restores boards, mode, and slot', async () => {
    let link: string
    {
      const { restore, grids, character } = createHarness()
      restore.initialize(null)
      restore.switchMode('3v3')
      grids.setActive(0)
      expect(character.placeCharacterOnHex(1, 11, Team.ALLY)).toBe(true)
      await nextTick()
      link = encodeMultiGridStateToLinkUrl(decodeBoards(restore.snapshot()))
    }

    const { restore, grids } = createHarness()
    const result = restore.initialize(link)
    expect(result.linkLoaded).toBe(true)
    expect(restore.activeMode.value).toBe('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(restore.variant.value).toBe('gd')
    const slot = decodeBoards(readEnvelope('3v3').data)
    expect(slot.boards[0]!.c).toEqual([[1, 11, Team.ALLY]])
  })

  it('ingress: an arena-mode payload is a wrong-page link and falls back', () => {
    const { restore } = createHarness()
    const result = restore.initialize(encodeGridStateToUrl({ c: [[1, 11, Team.ALLY]] }))
    expect(result).toEqual({ linkLoaded: false, linkFailed: true })
    expect(restore.activeMode.value).toBe('5v5')
  })

  it('normalizes stale sourceIds through the resolver at slot adoption', () => {
    const resolver = vi.fn((id: string | null) => (id === 'alive' ? id : null))
    const { restore } = createHarness(resolver)
    storage.set(
      teamsSlotKey('3v3'),
      JSON.stringify({
        v: 1,
        data: encode3v3Empty(),
        sourceId: 'dead',
      } satisfies ActiveSlot),
    )
    restore.initialize(null)
    restore.switchMode('3v3')
    expect(resolver).toHaveBeenCalledWith('dead')
    expect(restore.sourceId.value).toBeNull()
  })

  it('ingress: an invalid link falls back to the saved slot and reports failure', async () => {
    // Seed a 5v5 slot with an edit via a first session.
    {
      const { restore, grids, character } = createHarness()
      restore.initialize(null)
      grids.setActive(0)
      character.placeCharacterOnHex(1, 11, Team.ALLY)
      await nextTick()
    }
    const saved = readEnvelope('5v5').data

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { restore } = createHarness()
    const result = restore.initialize('!!!not-a-payload!!!')
    expect(result).toEqual({ linkLoaded: false, linkFailed: true })
    expect(restore.activeMode.value).toBe('5v5')
    expect(readEnvelope('5v5').data).toBe(saved)
    error.mockRestore()
  })

  it('a shared link overwrites the routed mode slot with sourceId null', () => {
    const { restore } = createHarness()
    storage.set(
      teamsSlotKey('1v1'),
      JSON.stringify({
        v: 1,
        data: encode1v1WithUnit(),
        sourceId: 'team-1',
      } satisfies ActiveSlot),
    )
    const link = encodeMultiGridStateToLinkUrl({ boards: [{ m: 'arena4' }], mode: '1v1' })
    restore.initialize(link)
    expect(restore.activeMode.value).toBe('1v1')
    expect(restore.sourceId.value).toBeNull()
    const slot = readEnvelope('1v1')
    expect(slot.sourceId).toBeNull()
    expect(decodeBoards(slot.data).boards[0]!.m).toBe('arena4')
  })
})

/* TEMPORARY: pre-binary JSON teams links decode only through the shim; deleted
 * with src/utils/upgradeMigration.ts (see its removal runbook). Binary links
 * always carry a mode and an exact board count, so count-based mode resolution
 * and pad-to-shape are legacy-only behavior. */
describe('upgradeMigration legacy links via useTeamsRestore', () => {
  it('a mode-less 2-board JSON link routes to 3v3 and is padded to shape', () => {
    // The unit lands on a non-placeable hex of arena2; restore warns and skips it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { restore, grids } = createHarness()
    const link = encodeMultiGridStateToUrl({
      boards: [{ m: 'arena2', c: [[1, 11, Team.ALLY]] }, { m: 'arena3' }],
    })
    const result = restore.initialize(link)
    expect(result.linkLoaded).toBe(true)
    expect(restore.activeMode.value).toBe('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(currentMaps(grids)).toEqual(['arena2', 'arena3', 'arena1'])
    expect(restore.sourceId.value).toBeNull()
    const slot = decodeBoards(readEnvelope('3v3').data)
    expect(slot.boards).toHaveLength(3)
    expect(slot.mode).toBe('3v3')
    warn.mockRestore()
  })
})

/* TEMPORARY: the 5v5sl retirement's slot move, walked through a real startup
 * between two attempts; deleted with src/utils/upgradeMigration.ts. */
describe('upgradeMigration mode retirement via useTeamsRestore', () => {
  const RETIRED_SLOT_KEY = 'stargazer.teams.active.5v5sl'
  const MOVE_KEY = 'stargazer.migration.sl.move'
  const MARKER_KEY = 'stargazer.migration.sl'

  it('retries the slot move after a failed copy even though startup persisted 5v5', async () => {
    // A genuine retired slot: SL boards with a hero, exactly as the retired
    // mode autosaved them (tiles included; restore replays `t`, so a hand-built
    // board without it would come back blank).
    let retiredData: string
    {
      const { restore, grids, character } = createHarness()
      restore.initialize(null)
      grids.setActive(0)
      expect(character.placeCharacterOnHex(1, 11, Team.ALLY)).toBe(true)
      await nextTick()
      retiredData = encodeMultiGridStateToUrl({
        ...decodeBoards(restore.snapshot()),
        mode: '5v5sl',
      })
    }
    storage.clear()
    storage.set('stargazer.teams.mode', '5v5sl')
    storage.set(RETIRED_SLOT_KEY, JSON.stringify({ v: 1, data: retiredData, sourceId: null }))

    // First attempt: the store refuses the large slot write but not the short ones.
    const failing = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key === teamsSlotKey('5v5')) throw new Error('quota')
        storage.set(key, value)
      })
    runModeStoragePass()
    expect(storage.has(RETIRED_SLOT_KEY)).toBe(true)
    expect(storage.get(MOVE_KEY)).toBe('1')
    expect(storage.has(MARKER_KEY)).toBe(false)

    // The same load continues: the retired key is rejected and 5v5 persisted
    // as last-used, which is what a naive retry would read.
    {
      const { restore } = createHarness()
      restore.initialize(null)
      expect(restore.activeMode.value).toBe('5v5')
    }
    expect(storage.get('stargazer.teams.mode')).toBe('5v5')
    failing.mockRestore()

    // Next load: the flag carries the decision, so the old boards still move.
    runModeStoragePass()
    expect(storage.has(RETIRED_SLOT_KEY)).toBe(false)
    expect(storage.has(MOVE_KEY)).toBe(false)
    expect(storage.get(MARKER_KEY)).toBe('1')
    expect(decodeBoards(readEnvelope('5v5').data).boards[0]!.c).toEqual([[1, 11, Team.ALLY]])

    const { restore, grids } = createHarness()
    restore.initialize(null)
    expect(restore.activeMode.value).toBe('5v5')
    expect(restore.variant.value).toBe('sl')
    expect(decodeBoards(restore.snapshot()).boards[0]!.c).toEqual([[1, 11, Team.ALLY]])
    expect(grids.contexts).toHaveLength(5)
  })
})

const encode3v3Empty = (): string =>
  encodeMultiGridStateToUrl({
    boards: [{ m: 'arena1' }, { m: 'arena1' }, { m: 'arena1' }],
    mode: '3v3',
  })

const encode1v1WithUnit = (): string =>
  encodeMultiGridStateToUrl({ boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }], mode: '1v1' })

describe('useTeamsRestore + saved teams (provenance and canonical compare)', () => {
  it('canonical snapshot ignores viewer state but tracks content', () => {
    const { restore, grids, character, wrapBoards } = createHarness()
    restore.initialize(null)
    grids.setActive(0)
    character.placeCharacterOnHex(1, 11, Team.ALLY)
    const canonical = canonicalTeamData(restore.snapshot())

    // Viewer-state changes: active board, display flags: canonical is stable.
    grids.setActive(3)
    wrapBoards.value = true
    expect(canonicalTeamData(restore.snapshot())).toBe(canonical)

    // Content change: canonical moves. (Place on board 0; the active board
    // moved to a preset map where this hex may not be placeable.)
    grids.setActive(0)
    expect(character.placeCharacterOnHex(2, 12, Team.ALLY)).toBe(true)
    expect(canonicalTeamData(restore.snapshot())).not.toBe(canonical)
  })

  it('applyTeamData switches mode, applies content, and adopts provenance', () => {
    // The unit lands on a non-placeable hex of arena3; restore warns and skips it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { restore, grids } = createHarness()
    restore.initialize(null)
    expect(restore.activeMode.value).toBe('5v5')

    const data = canonicalTeamData(
      encodeMultiGridStateToUrl({
        boards: [{ m: 'arena3', c: [[1, 11, Team.ALLY]] }],
        mode: '1v1',
      }),
    )!
    expect(restore.applyTeamData('1v1', data, 'team-9')).toBe(true)
    expect(restore.activeMode.value).toBe('1v1')
    expect(grids.contexts).toHaveLength(1)
    expect(grids.contexts[0]!.currentMap).toBe('arena3')
    expect(restore.sourceId.value).toBe('team-9')
    expect(readEnvelope('1v1').sourceId).toBe('team-9')
    warn.mockRestore()
  })

  it('newTeam rebuilds a mode without types on its default map and detaches provenance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { restore, grids } = createHarness()
    restore.initialize(null)
    const data = canonicalTeamData(
      encodeMultiGridStateToUrl({
        boards: [{ m: 'arena3', c: [[1, 11, Team.ALLY]] }],
        mode: '1v1',
      }),
    )!
    restore.applyTeamData('1v1', data, 'team-9')
    expect(restore.sourceId.value).toBe('team-9')

    restore.newTeam()
    expect(restore.activeMode.value).toBe('1v1')
    expect(grids.contexts).toHaveLength(1)
    expect(grids.contexts[0]!.currentMap).toBe('arena1')
    expect(restore.sourceId.value).toBeNull()
    // The slot mirrors the fresh boards, so a reload cannot resurrect the tie.
    const slot = readEnvelope('1v1')
    expect(slot.sourceId).toBeNull()
    expect(decodeBoards(slot.data).boards[0]!.c).toBeUndefined()
    warn.mockRestore()
  })

  it('newTeam keeps the matched type and falls back to the initial type on custom maps', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)
    restore.switchVariant('default')
    grids.setActive(0)
    expect(character.placeCharacterOnHex(1, 11, Team.ALLY)).toBe(true)
    await nextTick()

    restore.newTeam()
    expect(currentMaps(grids)).toEqual(Array<string>(5).fill(DEFAULT_MAP_KEY))
    expect(restore.variant.value).toBe('default')
    expect(decodeBoards(restore.snapshot()).boards[0]!.c).toBeUndefined()

    grids.contexts[1]!.switchMap('arena3')
    expect(restore.variant.value).toBeNull()
    restore.newTeam()
    expect(currentMaps(grids)).toEqual(TEAM_VARIANTS.sl.maps)
    expect(restore.variant.value).toBe('sl')
  })

  // A hand-crafted record whose boards carry no map key: canonicalization
  // fills the key through the restore's own rule (tiles, else the default
  // map), so the record chip and the live picker read the same maps.
  it('a key-less record canonicalizes and restores onto the same maps', () => {
    const { restore, grids } = createHarness()
    restore.initialize(null)
    restore.switchMode('1v1')
    grids.contexts[0]!.switchMap('arena2')
    const arena2Tiles = decodeBoards(restore.snapshot()).boards[0]!.t!
    expect(arena2Tiles.length).toBeGreaterThan(0)

    const crafted = encodeMultiGridStateToUrl({ boards: [{ t: arena2Tiles }, {}, {}], mode: '3v3' })
    const canonical = canonicalTeamData(crafted)!
    expect(decodeBoards(canonical).boards.map((b) => b.m)).toEqual(['arena2', 'arena1', 'arena1'])
    expect(teamVariant(canonical)).toBeNull()

    expect(restore.applyTeamData('3v3', canonical, 'crafted')).toBe(true)
    expect(currentMaps(grids)).toEqual(['arena2', 'arena1', 'arena1'])
    expect(restore.variant.value).toBe(teamVariant(canonical))
  })

  it('applyTeamData with corrupt data falls back to the initial boards and clears provenance', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { restore, grids } = createHarness()
    restore.initialize(null)
    expect(restore.applyTeamData('3v3', '!!!corrupt!!!', 'team-1')).toBe(false)
    expect(restore.activeMode.value).toBe('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(currentMaps(grids)).toEqual(TEAM_VARIANTS.gd.maps)
    expect(restore.sourceId.value).toBeNull()
    error.mockRestore()
  })

  it('selecting a team keeps current display flags and view rotation', () => {
    const { restore, flags, inverted } = createHarness()
    restore.initialize(null)
    flags.showSkills = false
    inverted.value = true
    // The payload carries contrary display flags; applyTeamData restores with
    // adoptFlags=false, so they must be ignored.
    const data = encodeMultiGridStateToUrl({
      boards: [{ m: 'arena1' }],
      mode: '1v1',
      d: packDisplayFlags({ showSkills: true, inverted: false }),
    })
    expect(restore.applyTeamData('1v1', data, 'x')).toBe(true)
    expect(flags.showSkills).toBe(false)
    expect(inverted.value).toBe(true)
  })
})
