import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { teamsSlotKey, type ActiveSlot } from '@/composables/useGridPersistence'
import { useTeamsRestore } from '@/composables/useTeamsRestore'
import type { TeamModeKey } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGrids } from '@/stores/grids'
import type { DisplayFlags, MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* The mode-switch regression suite: encodes the failure of the old single-slot
 * 3v3 attempt (one mode's edits overwriting another's save) as a permanent
 * guard, plus the ?g= ingress routing (mode resolution + shape normalization).
 * Headless: node env, in-memory localStorage, SSR off. */

const storage = new Map<string, string>()
const setItemSpy = vi.fn((key: string, value: string) => {
  storage.set(key, value)
})

const readEnvelope = (mode: TeamModeKey): ActiveSlot =>
  JSON.parse(storage.get(teamsSlotKey(mode))!) as ActiveSlot

const decodeBoards = (encoded: string): MultiGridState =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ),
  ) as MultiGridState

interface Harness {
  restore: ReturnType<typeof useTeamsRestore>
  grids: ReturnType<typeof useGrids>
  character: ReturnType<typeof useCharacterStore>
  flags: DisplayFlags
  wrapBoards: ReturnType<typeof ref<boolean>>
  applySize: ReturnType<typeof vi.fn>
}

function createHarness(resolveSourceId?: (id: string | null) => string | null): Harness {
  setActivePinia(createPinia())
  const grids = useGrids()
  const character = useCharacterStore()
  const flags: DisplayFlags = { showGridInfo: true, showArrows: false, wrap: false }
  const wrapBoards = ref(false)
  const applySize = vi.fn()
  const restore = useTeamsRestore({
    getFlags: () => ({ ...flags, wrap: wrapBoards.value }),
    applyFlags: (next) => {
      Object.assign(flags, next)
      wrapBoards.value = next.wrap ?? false
    },
    wrapBoards,
    applySize,
    resolveSourceId,
  })
  return { restore, grids, character, flags, wrapBoards, applySize }
}

describe('useTeamsRestore', () => {
  beforeEach(() => {
    vi.stubEnv('SSR', false)
    storage.clear()
    setItemSpy.mockClear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: setItemSpy,
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('initialize without link or slots builds the default mode', () => {
    const { restore, grids } = createHarness()
    const result = restore.initialize(null)
    expect(result).toEqual({ linkLoaded: false, linkFailed: false })
    expect(restore.activeMode.value).toBe('5v5sl')
    expect(grids.contexts).toHaveLength(5)
    expect(grids.contexts.map((ctx) => ctx.currentMap)).toEqual([
      'arena1',
      'arena2',
      'arena3',
      'preset-sr11',
      'preset-sr1',
    ])
    expect(storage.get('stargazer.teams.mode')).toBe('5v5sl')
    expect(readEnvelope('5v5sl').sourceId).toBeNull()
  })

  it('REGRESSION: per-mode edits survive round-trips through other modes', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)

    // Edit the 5v5sl boards: one ally on board 0, one on board 2.
    grids.setActive(0)
    expect(character.placeCharacterOnHex(1, 11, Team.ALLY)).toBe(true)
    grids.setActive(2)
    expect(character.placeCharacterOnHex(2, 12, Team.ALLY)).toBe(true)
    await nextTick() // let autosave mirror the edits
    const savedSl = readEnvelope('5v5sl').data

    // Switch to 3v3: clean slate, correct shape, SL slot untouched.
    restore.switchMode('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(grids.contexts.every((ctx) => ctx.currentMap === 'arena1')).toBe(true)
    const slBoards = decodeBoards(readEnvelope('5v5sl').data)
    expect(slBoards.boards[0]!.c).toEqual([[1, 11, Team.ALLY]])
    expect(slBoards.boards[2]!.c).toEqual([[2, 12, Team.ALLY]])
    const threeBoards = decodeBoards(readEnvelope('3v3').data)
    expect(threeBoards.boards.every((b) => !b.c)).toBe(true)

    // Edit 3v3, then bounce through every other mode and back.
    grids.setActive(1)
    expect(character.placeCharacterOnHex(3, 13, Team.ALLY)).toBe(true)
    await nextTick()
    restore.switchMode('1v1')
    restore.switchMode('5v5')
    restore.switchMode('5v5sl')

    // 5v5sl restored byte-identical to its pre-switch snapshot.
    expect(readEnvelope('5v5sl').data).toBe(savedSl)
    expect(grids.contexts).toHaveLength(5)

    // 3v3 kept its own edit.
    restore.switchMode('3v3')
    const threeAfter = decodeBoards(readEnvelope('3v3').data)
    expect(threeAfter.boards[1]!.c).toEqual([[3, 13, Team.ALLY]])
  })

  it('REGRESSION: equal-count switch (5v5 <-> 5v5sl) still rebuilds maps and state', async () => {
    const { restore, grids, character } = createHarness()
    restore.initialize(null)
    grids.setActive(0)
    character.placeCharacterOnHex(1, 11, Team.ALLY)
    await nextTick()

    restore.switchMode('5v5')
    expect(grids.contexts).toHaveLength(5)
    expect(grids.contexts.every((ctx) => ctx.currentMap === 'arena1')).toBe(true)
    expect(decodeBoards(readEnvelope('5v5').data).boards.every((b) => !b.c)).toBe(true)

    restore.switchMode('5v5sl')
    expect(grids.contexts.map((ctx) => ctx.currentMap)).toEqual([
      'arena1',
      'arena2',
      'arena3',
      'preset-sr11',
      'preset-sr1',
    ])
    const restored = decodeBoards(readEnvelope('5v5sl').data)
    expect(restored.boards[0]!.c).toEqual([[1, 11, Team.ALLY]])
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
    const oldKey = teamsSlotKey('5v5sl')
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

  it('forces wrap off when entering a non-wrap mode', () => {
    const { restore, wrapBoards } = createHarness()
    restore.initialize(null)
    wrapBoards.value = true
    restore.switchMode('3v3')
    expect(wrapBoards.value).toBe(false)
  })

  it('normalizes stale sourceIds through the resolver at slot adoption', () => {
    const resolver = vi.fn((id: string | null) => (id === 'alive' ? id : null))
    const { restore } = createHarness(resolver)
    storage.set(
      teamsSlotKey('3v3'),
      JSON.stringify({ v: 1, data: encode3v3Empty(), sourceId: 'dead' } satisfies ActiveSlot),
    )
    restore.initialize(null)
    restore.switchMode('3v3')
    expect(resolver).toHaveBeenCalledWith('dead')
    expect(restore.sourceId.value).toBeNull()
  })

  it('ingress: a crafted 2-board link routes to 3v3 and is padded to shape', () => {
    const { restore, grids } = createHarness()
    const link = encodeMultiGridStateToUrl({
      boards: [{ m: 'arena2', c: [[1, 11, Team.ALLY]] }, { m: 'arena3' }],
    })
    const result = restore.initialize(link)
    expect(result.linkLoaded).toBe(true)
    expect(restore.activeMode.value).toBe('3v3')
    expect(grids.contexts).toHaveLength(3)
    expect(grids.contexts.map((ctx) => ctx.currentMap)).toEqual(['arena2', 'arena3', 'arena1'])
    expect(restore.sourceId.value).toBeNull()
    const slot = decodeBoards(readEnvelope('3v3').data)
    expect(slot.boards).toHaveLength(3)
    expect(slot.mode).toBe('3v3')
  })

  it('ingress: a contradictory declared mode is overridden by the board count', () => {
    const { restore, grids } = createHarness()
    const link = encodeMultiGridStateToUrl({ boards: [{ m: 'arena1' }], mode: '5v5sl' })
    restore.initialize(link)
    expect(restore.activeMode.value).toBe('1v1')
    expect(grids.contexts).toHaveLength(1)
  })

  it('ingress: an invalid link falls back to the saved slot and reports failure', async () => {
    // Seed a 5v5sl slot with an edit via a first session.
    {
      const { restore, grids, character } = createHarness()
      restore.initialize(null)
      grids.setActive(0)
      character.placeCharacterOnHex(1, 11, Team.ALLY)
      await nextTick()
    }
    const saved = readEnvelope('5v5sl').data

    const { restore } = createHarness()
    const result = restore.initialize('!!!not-a-payload!!!')
    expect(result).toEqual({ linkLoaded: false, linkFailed: true })
    expect(restore.activeMode.value).toBe('5v5sl')
    expect(readEnvelope('5v5sl').data).toBe(saved)
  })

  it('a shared link overwrites the routed mode slot with sourceId null', () => {
    const { restore } = createHarness()
    storage.set(
      teamsSlotKey('1v1'),
      JSON.stringify({ v: 1, data: encode1v1WithUnit(), sourceId: 'team-1' } satisfies ActiveSlot),
    )
    const link = encodeMultiGridStateToUrl({ boards: [{ m: 'arena4' }], mode: '1v1' })
    restore.initialize(link)
    expect(restore.activeMode.value).toBe('1v1')
    expect(restore.sourceId.value).toBeNull()
    const slot = readEnvelope('1v1')
    expect(slot.sourceId).toBeNull()
    expect(decodeBoards(slot.data).boards[0]!.m).toBe('arena4')
  })
})

const encode3v3Empty = (): string =>
  encodeMultiGridStateToUrl({
    boards: [{ m: 'arena1' }, { m: 'arena1' }, { m: 'arena1' }],
    mode: '3v3',
  })

const encode1v1WithUnit = (): string =>
  encodeMultiGridStateToUrl({ boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }], mode: '1v1' })
