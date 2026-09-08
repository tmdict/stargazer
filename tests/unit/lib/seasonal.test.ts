import { describe, expect, it } from 'vitest'

import {
  CURRENT_SEASON,
  hasRetiredSeasonal,
  isPermanentArtifactId,
  isRetiredSeason,
  stripRetiredSeasonal,
  stripRetiredSeasonalBoard,
} from '@/lib/seasonal'
import { normalizeTeamPayload } from '@/lib/teams/modes'
import { teamPreviewBoards } from '@/lib/teams/preview'
import { canonicalTeamData, teamContentKey } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { loadArtifacts, loadPhantimals } from '@/utils/dataLoader'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

describe('seasonal', () => {
  it('derives the current season from the loaded data pool', () => {
    const maxDataSeason = Math.max(
      0,
      ...loadArtifacts().map((a) => a.season),
      ...loadPhantimals().map((p) => p.season),
    )
    expect(CURRENT_SEASON).toBe(maxDataSeason)
    // Pins that today's data really is the season-7 pool, which the shim's
    // legacy stamp and the rotation pass's marker seed both assume.
    expect(CURRENT_SEASON).toBe(7)
  })

  it('classifies permanent vs seasonal artifact ids from the data', () => {
    for (const artifact of loadArtifacts()) {
      expect(isPermanentArtifactId(artifact.id)).toBe(artifact.season === 0)
    }
    expect(isPermanentArtifactId(999)).toBe(false)
  })

  it('treats only the current season as live', () => {
    expect(isRetiredSeason(CURRENT_SEASON)).toBe(false)
    expect(isRetiredSeason(CURRENT_SEASON - 1)).toBe(true)
    expect(isRetiredSeason(CURRENT_SEASON + 1)).toBe(true)
  })

  it('strips phantimals and seasonal artifacts from a retired board', () => {
    const board = {
      c: [[1, 11, Team.ALLY]],
      s: [[7, 2, Team.ALLY]],
      y: [[9, 50, Team.ALLY]],
      a: [1, 14] as (number | null)[],
    }
    const stripped = stripRetiredSeasonalBoard(board)
    // Heroes and synergy units are never seasonal; the permanent artifact
    // survives while the seasonal one nulls.
    expect(stripped).toEqual({ c: board.c, y: board.y, a: [1, null] })
    expect(board.s).toBeDefined() // input untouched
  })

  it('drops a fully-seasonal artifact pair instead of keeping [null, null]', () => {
    expect(stripRetiredSeasonalBoard({ a: [14, 18] })).toEqual({})
  })

  it('strips a payload only when its season is retired', () => {
    const stale: MultiGridState = {
      boards: [{ s: [[7, 2, Team.ALLY]], a: [14, null] }],
      mode: '1v1',
      season: CURRENT_SEASON - 1,
    }
    expect(stripRetiredSeasonal(stale).boards[0]).toEqual({})
    expect(hasRetiredSeasonal(stale)).toBe(true)

    const current: MultiGridState = { ...stale, season: CURRENT_SEASON }
    expect(stripRetiredSeasonal(current)).toBe(current)
    expect(hasRetiredSeasonal(current)).toBe(false)

    const unstamped: MultiGridState = { boards: stale.boards, mode: '1v1' }
    expect(stripRetiredSeasonal(unstamped)).toBe(unstamped)
    expect(hasRetiredSeasonal(unstamped)).toBe(false)
  })

  it('reports nothing to strip for a stale payload with no seasonal content', () => {
    const stale: MultiGridState = {
      boards: [{ c: [[1, 11, Team.ALLY]], a: [1, null] }],
      mode: '1v1',
      season: CURRENT_SEASON - 1,
    }
    expect(hasRetiredSeasonal(stale)).toBe(false)
    expect(stripRetiredSeasonal(stale).boards[0]).toEqual(stale.boards[0])
  })
})

describe('season provenance across surfaces', () => {
  const encode = (state: Partial<MultiGridState>): string =>
    encodeMultiGridStateToUrl(state as MultiGridState)

  it('canonicalTeamData preserves a stale stamp', () => {
    // Provenance is preserved, never re-stamped: a record keeps saying which
    // pool it was built from, content included.
    const stale = canonicalTeamData(
      encode({
        boards: [{ m: 'arena1', s: [[7, 2, Team.ALLY]], a: [14, null] }],
        mode: '1v1',
        season: CURRENT_SEASON - 1,
      }),
    )
    const decoded = decodeMultiGridStateFromUrl(stale!)!
    expect(decoded.season).toBe(CURRENT_SEASON - 1)
    expect(decoded.boards[0]!.s).toEqual([[7, 2, Team.ALLY]])
  })

  it('normalizeTeamPayload strips retired content at ingress', () => {
    const stale = decodeMultiGridStateFromUrl(
      encode({
        boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], s: [[7, 2, Team.ALLY]], a: [1, 14] }],
        mode: '1v1',
        season: CURRENT_SEASON - 1,
      }),
    )!
    const normalized = normalizeTeamPayload(stale, '1v1')
    expect(normalized.boards[0]).toEqual({ m: 'arena1', c: [[1, 11, Team.ALLY]], a: [1, null] })

    const current = decodeMultiGridStateFromUrl(
      encode({
        boards: [{ m: 'arena1', s: [[7, 2, Team.ALLY]], a: [1, 14] }],
        mode: '1v1',
        season: CURRENT_SEASON,
      }),
    )!
    expect(normalizeTeamPayload(current, '1v1').boards[0]!.s).toEqual([[7, 2, Team.ALLY]])
  })

  it('teamPreviewBoards masks retired refs instead of resolving reused ids', () => {
    const stale = encode({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], s: [[7, 2, Team.ENEMY]], a: [1, 14] }],
      mode: '1v1',
      season: CURRENT_SEASON - 1,
    })
    const board = teamPreviewBoards(stale)![0]!
    const phantimal = board.units.find((u) => u.hexId === 7)!
    expect(phantimal.retiredSeason).toBe(CURRENT_SEASON - 1)
    expect(phantimal.phantimalId).toBeUndefined()
    expect(board.artifacts.ally).toBe(1)
    expect(board.artifacts.enemy).toEqual({ retiredSeason: CURRENT_SEASON - 1 })

    const current = encode({
      boards: [{ m: 'arena1', s: [[7, 2, Team.ENEMY]], a: [1, 14] }],
      mode: '1v1',
      season: CURRENT_SEASON,
    })
    const currentBoard = teamPreviewBoards(current)![0]!
    expect(currentBoard.units.find((u) => u.hexId === 7)!.phantimalId).toBe(2)
    expect(currentBoard.artifacts.enemy).toBe(14)
  })
})

describe('season data contract', () => {
  // A cutover must bump every seasonal record: a partial bump flips
  // CURRENT_SEASON while stale entries linger, and a wholly forgotten bump
  // leaves stale records rendering new content — both wrong.
  it('every non-zero data season equals the current season', () => {
    for (const artifact of loadArtifacts()) {
      if (artifact.season !== 0) expect(artifact.season).toBe(CURRENT_SEASON)
    }
    for (const phantimal of loadPhantimals()) {
      expect(phantimal.season).toBe(CURRENT_SEASON)
    }
  })
})

describe('teamContentKey', () => {
  const key = (state: Partial<MultiGridState>): string | null =>
    teamContentKey(encodeMultiGridStateToUrl(state as MultiGridState))

  // A reused seasonal id names a different artifact each season, so the stamp
  // is part of the team's identity exactly when seasonal refs exist.
  it('distinguishes same-layout teams whose seasonal content is from different pools', () => {
    const boards = [{ m: 'arena1', c: [[1, 11, Team.ALLY]], a: [null, 14] }]
    expect(key({ boards, mode: '1v1', season: CURRENT_SEASON })).not.toBe(
      key({ boards, mode: '1v1', season: CURRENT_SEASON - 1 }),
    )
  })

  it('ignores the stamp on seasonal-free teams (dirty dot, import dedupe)', () => {
    const boards = [{ m: 'arena1', c: [[1, 11, Team.ALLY]], a: [1, null] }]
    const a = key({ boards, mode: '1v1', season: CURRENT_SEASON })
    const b = key({ boards, mode: '1v1', season: CURRENT_SEASON - 1 })
    const unstamped = key({ boards, mode: '1v1' })
    expect(a).toBe(b)
    expect(a).toBe(unstamped)
  })

  it('differing content differs regardless of stamps', () => {
    const withArtifact = key({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]], a: [null, 14] }],
      mode: '1v1',
      season: CURRENT_SEASON,
    })
    const without = key({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }],
      mode: '1v1',
      season: CURRENT_SEASON,
    })
    expect(withArtifact).not.toBe(without)
  })
})
