import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { convertLegacyBoard, runUpgradeStoragePass } from '@/utils/upgradeMigration'
import {
  decodeMultiGridStateFromUrl,
  encodeGridStateToUrl,
  encodeMultiGridStateToUrl,
} from '@/utils/urlStateManager'
import { stubLocalStorage } from '../fixtures/storage'

/* TEMPORARY suite for the one-time p -> u conversion; deleted together with
 * src/utils/upgradeMigration.ts (see its header for the removal steps). */

const MARKER_KEY = 'stargazer.migration.u'
const ARENA_KEY = 'stargazer.arena'
const LIBRARY_KEY = 'stargazer.teams.saved'
const SLOT_KEY = 'stargazer.teams.active.5v5sl'

// Mirrors the retired binary layout so the arena-slot conversion can be fed a
// genuine pre-`u` value: header (1 char, extended), flags bit 1, one character
// [2,100,ally], one paragon row [ally,100,4]. LSB-first like BitWriter.
const legacyArenaValue = (): string => {
  const bits: number[] = []
  const push = (value: number, count: number): void => {
    for (let i = 0; i < count; i++) bits.push((value >> i) & 1)
  }
  push(0x88, 8) // header: 1 character, extended header present
  push(0x02, 8) // extended flags: legacy paragon only
  push(2, 6) // character hexId
  push(100, 16) // character id
  push(0, 1) // team ally
  push(1, 5) // paragon count
  push(0, 1) // team ally
  push(100, 16) // character id
  push(4, 3) // level
  const bytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8 && i + j < bits.length; j++) byte |= bits[i + j]! << j
    bytes.push(byte)
  }
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let out = ''
  let acc = 0
  let count = 0
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    count += 8
    while (count >= 6) {
      count -= 6
      out += CHARS[(acc >> count) & 0x3f]
    }
  }
  if (count > 0) out += CHARS[(acc << (6 - count)) & 0x3f]
  return out
}

const legacyTeams = (p: number[][]): string =>
  encodeMultiGridStateToUrl({
    boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], p } as never],
    mode: '1v1',
  } as MultiGridState)

let storage: Map<string, string>

beforeEach(() => {
  vi.stubEnv('SSR', false)
  ;({ storage } = stubLocalStorage())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('upgradeMigration convertLegacyBoard', () => {
  it('converts p rows to sorted u rows with attrId 1', () => {
    const board: Record<string, unknown> = {
      p: [
        [Team.ENEMY, 21, 2],
        [Team.ALLY, 11, 3],
      ],
    }
    convertLegacyBoard(board)
    expect(board.p).toBeUndefined()
    expect(board.u).toEqual([
      [Team.ALLY, 11, 1, 3],
      [Team.ENEMY, 21, 1, 2],
    ])
  })

  it('filters malformed rows, clamps, drops zeroes, dedupes last-wins', () => {
    const board: Record<string, unknown> = {
      p: [
        [Team.ALLY, 11], // short
        [Team.ALLY, '11', 3], // non-numeric
        [Team.ALLY, 12, 9], // clamps to 4
        [Team.ALLY, 13, 0], // default: dropped
        [Team.ALLY, 14, 1],
        [Team.ALLY, 14, 2], // last wins
      ],
    }
    convertLegacyBoard(board)
    expect(board.u).toEqual([
      [Team.ALLY, 12, 1, 4],
      [Team.ALLY, 14, 1, 2],
    ])
  })

  // The old format was applied by sequential setParagon calls, so a duplicate
  // ending at 0 ended at 0 — last-wins must include the trailing default.
  it('dedupes to the trailing default: a final zero deletes the row', () => {
    const board: Record<string, unknown> = {
      p: [
        [Team.ALLY, 11, 3],
        [Team.ALLY, 11, 0],
        [3, 12, 2], // team outside {1, 2}: dropped
        [Team.ALLY, 12.5, 2], // non-integer characterId: dropped
      ],
    }
    convertLegacyBoard(board)
    expect(board.u).toBeUndefined()
  })

  it('always deletes p, and never touches an existing u', () => {
    const board: Record<string, unknown> = { p: [[Team.ALLY, 11, 3]], u: [[Team.ALLY, 11, 1, 1]] }
    convertLegacyBoard(board)
    expect(board.p).toBeUndefined()
    expect(board.u).toEqual([[Team.ALLY, 11, 1, 1]])
    const bare: Record<string, unknown> = { c: [[1, 11, Team.ALLY]] }
    convertLegacyBoard(bare)
    expect(bare).toEqual({ c: [[1, 11, Team.ALLY]] })
  })

  it('runs inside decodeMultiGridStateFromUrl (the JSON choke point)', () => {
    const decoded = decodeMultiGridStateFromUrl(legacyTeams([[Team.ALLY, 11, 3]]))
    expect(decoded?.boards[0]?.u).toEqual([[Team.ALLY, 11, 1, 3]])
    expect((decoded?.boards[0] as Record<string, unknown>).p).toBeUndefined()
  })

  it('canonicalizes a legacy record byte-equal to the same content in u form', () => {
    const legacy = canonicalTeamData(legacyTeams([[Team.ALLY, 11, 3]]))
    const fresh = canonicalTeamData(
      encodeMultiGridStateToUrl({
        boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], u: [[Team.ALLY, 11, 1, 3]] }],
        mode: '1v1',
      }),
    )
    expect(legacy).not.toBeNull()
    expect(legacy).toBe(fresh)
  })
})

describe('upgradeMigration storage pass', () => {
  // At-rest bytes are asserted exactly: a decode-based check would route
  // through the converting decoder and pass even if legacy p-form bytes were
  // still stored.
  it('rewrites the arena slot from the legacy binary section', () => {
    storage.set(ARENA_KEY, legacyArenaValue())
    runUpgradeStoragePass()
    expect(storage.get(ARENA_KEY)).toBe(
      encodeGridStateToUrl({ c: [[2, 100, Team.ALLY]], u: [[Team.ALLY, 100, 1, 4]] }),
    )
    expect(storage.get(MARKER_KEY)).toBe('1')
  })

  it('converts a mode slot in place, preserving the envelope fields', () => {
    const slot = { v: 1, data: legacyTeams([[Team.ALLY, 11, 2]]), sourceId: 'abc', defaults: 'x,y' }
    storage.set(SLOT_KEY, JSON.stringify(slot))
    runUpgradeStoragePass()
    const after = JSON.parse(storage.get(SLOT_KEY)!) as typeof slot
    expect(after.v).toBe(1)
    expect(after.sourceId).toBe('abc')
    expect(after.defaults).toBe('x,y')
    expect(after.data).toBe(
      encodeMultiGridStateToUrl({
        boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], u: [[Team.ALLY, 11, 1, 2]] } as never],
        mode: '1v1',
      } as MultiGridState),
    )
  })

  it('leaves unparsable or wrong-shape values untouched', () => {
    storage.set(SLOT_KEY, 'not json')
    storage.set(ARENA_KEY, '!!!invalid!!!')
    storage.set(LIBRARY_KEY, JSON.stringify({ v: 2, teams: [] }))
    runUpgradeStoragePass()
    expect(storage.get(SLOT_KEY)).toBe('not json')
    expect(storage.get(ARENA_KEY)).toBe('!!!invalid!!!')
    expect(storage.get(LIBRARY_KEY)).toBe(JSON.stringify({ v: 2, teams: [] }))
    expect(storage.get(MARKER_KEY)).toBe('1')
  })

  it('rewrites library records to canonical u form, preserving invalid records raw', () => {
    const record = {
      id: 'team-1',
      name: 'Legacy',
      mode: '1v1',
      data: legacyTeams([[Team.ALLY, 11, 4]]),
      createdAt: 1,
      updatedAt: 2,
    }
    const junk = { id: 'junk', data: 42 }
    storage.set(LIBRARY_KEY, JSON.stringify({ v: 1, teams: [record, junk] }))
    runUpgradeStoragePass()
    const blob = JSON.parse(storage.get(LIBRARY_KEY)!) as { v: number; teams: unknown[] }
    expect(blob.v).toBe(1)
    const [converted, keptJunk] = blob.teams as [typeof record, typeof junk]
    expect(converted.id).toBe('team-1')
    expect(converted.data).toBe(canonicalTeamData(record.data))
    expect(decodeMultiGridStateFromUrl(converted.data)!.boards[0]!.u).toEqual([
      [Team.ALLY, 11, 1, 4],
    ])
    expect(keptJunk).toEqual(junk)
  })

  it('is idempotent and skipped once the marker is set', () => {
    storage.set(SLOT_KEY, JSON.stringify({ v: 1, data: legacyTeams([[Team.ALLY, 11, 2]]) }))
    runUpgradeStoragePass()
    const first = storage.get(SLOT_KEY)
    runUpgradeStoragePass()
    expect(storage.get(SLOT_KEY)).toBe(first)
    storage.delete(MARKER_KEY)
    runUpgradeStoragePass()
    expect(storage.get(SLOT_KEY)).toBe(first)
  })

  it('writes the marker LAST: a failed write leaves it absent for a retry', () => {
    storage.set(LIBRARY_KEY, JSON.stringify({ v: 1, teams: [] }))
    storage.set(SLOT_KEY, JSON.stringify({ v: 1, data: legacyTeams([[Team.ALLY, 11, 2]]) }))
    const failing = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    runUpgradeStoragePass()
    expect(storage.get(MARKER_KEY)).toBeUndefined()
    failing.mockRestore()
    runUpgradeStoragePass()
    expect(storage.get(MARKER_KEY)).toBe('1')
    expect(
      decodeMultiGridStateFromUrl((JSON.parse(storage.get(SLOT_KEY)!) as { data: string }).data)!
        .boards[0]!.u,
    ).toEqual([[Team.ALLY, 11, 1, 2]])
  })
})
