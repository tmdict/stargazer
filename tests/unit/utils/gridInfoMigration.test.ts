import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Team } from '@/lib/types/team'
import { remapLegacyDisplayBytes } from '@/utils/gridInfoMigration'
import type { GridState } from '@/utils/gridStateSerializer'
import { decodeGridStateFromUrl, encodeGridStateToUrl } from '@/utils/urlStateManager'
import { stubLocalStorage } from '../fixtures/storage'

/* TEMPORARY suite for the one-time display-byte remap, including its
 * integration with useGridInfoPrefs' seed branch (marker semantics); deleted
 * together with src/utils/gridInfoMigration.ts (see its header for the
 * removal steps). Everything remap-related tests here so that deletion
 * touches no other suite. */

const ARENA_KEY = 'stargazer.arena'
const TEAMS_DISPLAY_KEY = 'stargazer.teams.display'

let storage: Map<string, string>
let setItemSpy: ReturnType<typeof stubLocalStorage>['setItemSpy']

describe('remapLegacyDisplayBytes', () => {
  beforeEach(() => {
    vi.stubEnv('SSR', false)
    ;({ storage, setItemSpy } = stubLocalStorage())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('moves each teams display bit to its new position and drops the grid-info bit', () => {
    const vectors: Array<[number, number]> = [
      [0b000001, 0b00000], // gridInfo: discarded
      [0b000010, 0b00100], // perspective
      [0b000100, 0b00010], // skills
      [0b001000, 0b10000], // teamView
      [0b010000, 0b01000], // inverted
      [0b100000, 0b00001], // wrap
      [0b111111, 0b11111],
    ]
    for (const [old, remapped] of vectors) {
      storage.set(TEAMS_DISPLAY_KEY, String(old))
      remapLegacyDisplayBytes()
      expect(storage.get(TEAMS_DISPLAY_KEY)).toBe(String(remapped))
    }
  })

  it('rewrites the arena slot d byte and preserves the board content', () => {
    const state: GridState = {
      t: [[3, 1]],
      c: [[1, 11, Team.ALLY]],
      a: [7, null],
      d: 0b100110, // old layout: perspective + skills + wrap
    }
    storage.set(ARENA_KEY, encodeGridStateToUrl(state))

    remapLegacyDisplayBytes()

    const rewritten = decodeGridStateFromUrl(storage.get(ARENA_KEY)!)!
    expect(rewritten.d).toBe(0b00111) // new layout: wrap + skills + perspective
    expect(rewritten.t).toEqual(state.t)
    expect(rewritten.c).toEqual(state.c)
    expect(rewritten.a).toEqual(state.a)
  })

  it('skips absent keys, garbage bytes, undecodable slots, and slots without d', () => {
    remapLegacyDisplayBytes()
    expect(setItemSpy).not.toHaveBeenCalled()

    storage.set(TEAMS_DISPLAY_KEY, 'not-a-number')
    const noFlagsSlot = encodeGridStateToUrl({ c: [[1, 11, Team.ALLY]] })
    storage.set(ARENA_KEY, noFlagsSlot)
    remapLegacyDisplayBytes()
    expect(storage.get(TEAMS_DISPLAY_KEY)).toBe('not-a-number')
    expect(storage.get(ARENA_KEY)).toBe(noFlagsSlot)

    // decodeFromBinary logs to console.error on failure; suppress for this expected-failure case.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    storage.set(ARENA_KEY, 'not-a-slot')
    remapLegacyDisplayBytes()
    expect(storage.get(ARENA_KEY)).toBe('not-a-slot')
    error.mockRestore()
  })
})

/* The seed-branch integration: absence of stargazer.prefs is the
 * not-yet-migrated marker, written before the remap. Asserted through the
 * observable effect on the real teams display byte (old 39 remaps to 7), not
 * through mocks; the prefs composable is a module singleton, so each test
 * re-imports it through vi.resetModules. */
describe('seed-time remap through useGridInfoPrefs', () => {
  const PREFS_KEY = 'stargazer.prefs'
  const OLD_TEAMS_BYTE = '39'
  const REMAPPED_TEAMS_BYTE = '7'

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('SSR', false)
    ;({ storage, setItemSpy } = stubLocalStorage())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const seedPrefs = async (): Promise<void> => {
    const { useGridInfoPrefs } = await import('@/composables/useGridInfoPrefs')
    useGridInfoPrefs()
  }

  it('remaps the legacy bytes when the pref key is first seeded', async () => {
    storage.set(TEAMS_DISPLAY_KEY, OLD_TEAMS_BYTE)

    await seedPrefs()

    expect(storage.get(TEAMS_DISPLAY_KEY)).toBe(REMAPPED_TEAMS_BYTE)
    expect(storage.has(PREFS_KEY)).toBe(true)
  })

  it('skips the remap when the marker write fails, leaving the bytes for a retry', async () => {
    storage.set(TEAMS_DISPLAY_KEY, OLD_TEAMS_BYTE)
    setItemSpy.mockImplementation((key: string, value: string) => {
      if (key === PREFS_KEY) throw new Error('quota')
      storage.set(key, value)
    })

    await seedPrefs()

    expect(storage.get(TEAMS_DISPLAY_KEY)).toBe(OLD_TEAMS_BYTE)
    expect(storage.has(PREFS_KEY)).toBe(false)
  })

  it('never remaps once the pref key exists, corrupt objects included', async () => {
    storage.set(TEAMS_DISPLAY_KEY, OLD_TEAMS_BYTE)
    storage.set(PREFS_KEY, 'not-json')

    await seedPrefs()

    expect(storage.get(TEAMS_DISPLAY_KEY)).toBe(OLD_TEAMS_BYTE)
  })
})
