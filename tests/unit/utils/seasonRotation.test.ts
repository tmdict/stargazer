import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CURRENT_SEASON } from '@/lib/seasonal'
import { Team } from '@/lib/types/team'
import { runSeasonRotationPass } from '@/utils/seasonRotation'
import { encodeGridStateToUrl } from '@/utils/urlStateManager'
import { stubLocalStorage } from '../fixtures/storage'

const SEASON_KEY = 'stargazer.season'
const ARENA_KEY = 'stargazer.arena'

const staleArenaValue = (): string =>
  encodeGridStateToUrl({
    c: [[1, 100, Team.ALLY]],
    s: [[7, 2, Team.ALLY]],
    a: [1, 14],
    d: 6,
  })

let storage: Map<string, string>

beforeEach(() => {
  vi.stubEnv('SSR', false)
  ;({ storage } = stubLocalStorage())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('seasonRotation', () => {
  it('does nothing when the marker matches the current season', () => {
    storage.set(SEASON_KEY, String(CURRENT_SEASON))
    const value = staleArenaValue()
    storage.set(ARENA_KEY, value)
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(ARENA_KEY)).toBe(value)
  })

  // An absent marker means the first stamped season, which is also the
  // current one pre-cutover — a fresh device's autosave must NOT be stripped.
  it('does nothing on a fresh device before any cutover', () => {
    const value = staleArenaValue()
    storage.set(ARENA_KEY, value)
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(ARENA_KEY)).toBe(value)
  })

  it('strips seasonal content from the autosave on a season flip', () => {
    storage.set(SEASON_KEY, String(CURRENT_SEASON - 1))
    storage.set(ARENA_KEY, staleArenaValue())
    // The return value names the stripped season, the page banner's cue.
    expect(runSeasonRotationPass()).toBe(CURRENT_SEASON - 1)
    // Phantimal gone, seasonal artifact nulled, permanent artifact + hero +
    // display flags intact.
    expect(storage.get(ARENA_KEY)).toBe(
      encodeGridStateToUrl({ c: [[1, 100, Team.ALLY]], a: [1, null], d: 6 }),
    )
    expect(storage.get(SEASON_KEY)).toBe(String(CURRENT_SEASON))
  })

  it('leaves a seasonal-free autosave byte-stable and still re-aligns the marker', () => {
    storage.set(SEASON_KEY, String(CURRENT_SEASON - 1))
    const clean = encodeGridStateToUrl({ c: [[1, 100, Team.ALLY]], a: [1, null], d: 6 })
    storage.set(ARENA_KEY, clean)
    const writes = vi.spyOn(globalThis.localStorage, 'setItem')
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(ARENA_KEY)).toBe(clean)
    expect(storage.get(SEASON_KEY)).toBe(String(CURRENT_SEASON))
    // Only the marker was written: the identical re-encode skipped its write.
    expect(writes.mock.calls.map(([key]) => key)).toEqual([SEASON_KEY])
    writes.mockRestore()
  })

  it('leaves an undecodable autosave untouched but re-aligns the marker', () => {
    storage.set(SEASON_KEY, String(CURRENT_SEASON - 1))
    storage.set(ARENA_KEY, '!!!garbage!!!')
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(ARENA_KEY)).toBe('!!!garbage!!!')
    expect(storage.get(SEASON_KEY)).toBe(String(CURRENT_SEASON))
  })

  it('treats a garbage marker as the first stamped season', () => {
    storage.set(SEASON_KEY, 'banana')
    const value = staleArenaValue()
    storage.set(ARENA_KEY, value)
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(ARENA_KEY)).toBe(value)
  })

  it('withholds the marker when the strip write fails, so it retries', () => {
    storage.set(SEASON_KEY, String(CURRENT_SEASON - 1))
    storage.set(ARENA_KEY, staleArenaValue())
    const failing = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(runSeasonRotationPass()).toBeNull()
    expect(storage.get(SEASON_KEY)).toBe(String(CURRENT_SEASON - 1))
    failing.mockRestore()
    expect(runSeasonRotationPass()).toBe(CURRENT_SEASON - 1)
    expect(storage.get(SEASON_KEY)).toBe(String(CURRENT_SEASON))
    expect(storage.get(ARENA_KEY)).toBe(
      encodeGridStateToUrl({ c: [[1, 100, Team.ALLY]], a: [1, null], d: 6 }),
    )
  })

  // Number("") coerces to 0, an integer — a corrupted empty marker must fall
  // back to the seed instead of reading as "season 0" and stripping current
  // content.
  it('treats an empty or coercible-garbage marker as the seed, not season 0', () => {
    for (const junk of ['', ' ', '0x10', '1e2']) {
      storage.set(SEASON_KEY, junk)
      const value = staleArenaValue()
      storage.set(ARENA_KEY, value)
      expect(runSeasonRotationPass()).toBeNull()
      expect(storage.get(ARENA_KEY)).toBe(value)
    }
  })
})
