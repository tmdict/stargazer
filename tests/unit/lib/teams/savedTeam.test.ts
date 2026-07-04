import { describe, expect, it } from 'vitest'

import {
  canonicalTeamData,
  duplicateName,
  nextAutoName,
  sanitizeTeamName,
  validateSavedTeam,
} from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const encode = (state: MultiGridState): string => encodeMultiGridStateToUrl(state)

const THREE_BOARDS: MultiGridState = {
  boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena2' }, { m: 'arena3' }],
  mode: '3v3',
}

describe('canonicalTeamData', () => {
  it('strips viewer state (active + display flags) and keeps content + mode', () => {
    const raw = encode({ ...THREE_BOARDS, active: 2, d: 127 })
    const canonical = canonicalTeamData(raw)!
    const decoded = decodeMultiGridStateFromUrl(canonical)!
    expect(decoded.active).toBeUndefined()
    expect(decoded.d).toBeUndefined()
    expect(decoded.mode).toBe('3v3')
    expect(decoded.boards).toEqual(THREE_BOARDS.boards)
  })

  it('is idempotent and independent of input key order', () => {
    const canonical = canonicalTeamData(encode(THREE_BOARDS))!
    expect(canonicalTeamData(canonical)).toBe(canonical)

    // Same content, hand-ordered keys (m before c) — must produce identical bytes.
    const reordered = encode({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena2' }, { m: 'arena3' }].map(
        (board) => (board.c ? { m: board.m, c: board.c } : board),
      ),
      mode: '3v3',
    })
    expect(canonicalTeamData(reordered)).toBe(canonical)
  })

  it('re-resolves a missing or contradictory mode from the board count', () => {
    const noMode = encode({ boards: THREE_BOARDS.boards })
    expect(decodeMultiGridStateFromUrl(canonicalTeamData(noMode)!)!.mode).toBe('3v3')
    const wrongMode = encode({ boards: THREE_BOARDS.boards, mode: '5v5sl' })
    expect(decodeMultiGridStateFromUrl(canonicalTeamData(wrongMode)!)!.mode).toBe('3v3')
  })

  it('returns null for undecodable or empty payloads', () => {
    expect(canonicalTeamData('!!!')).toBeNull()
    expect(canonicalTeamData(encode({ boards: [] }))).toBeNull()
  })
})

describe('team naming', () => {
  it('sanitizeTeamName trims, clamps to 60, and rejects empties', () => {
    expect(sanitizeTeamName('  My Team  ')).toBe('My Team')
    expect(sanitizeTeamName('x'.repeat(80))).toHaveLength(60)
    expect(sanitizeTeamName('   ')).toBeNull()
    expect(sanitizeTeamName(undefined)).toBeNull()
    expect(sanitizeTeamName(42)).toBeNull()
  })

  it('nextAutoName picks the next free Team N', () => {
    expect(nextAutoName([])).toBe('Team 1')
    expect(nextAutoName(['Team 1'])).toBe('Team 2')
    expect(nextAutoName(['Team 1', 'Team 2', 'custom'])).toBe('Team 4')
    expect(nextAutoName(['Team 2', 'foo', 'Team 4'])).toBe('Team 5')
  })

  it('duplicateName appends (copy) within the length cap', () => {
    expect(duplicateName('Alpha')).toBe('Alpha (copy)')
    expect(duplicateName('x'.repeat(60))).toHaveLength(60)
  })
})

describe('validateSavedTeam', () => {
  const record = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'id-1',
    name: 'Alpha',
    mode: '3v3',
    data: encode(THREE_BOARDS),
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  })

  it('accepts a valid record and canonicalizes its data', () => {
    const valid = validateSavedTeam(record({ data: encode({ ...THREE_BOARDS, active: 1, d: 3 }) }))
    expect(valid).not.toBeNull()
    expect(valid!.name).toBe('Alpha')
    expect(valid!.data).toBe(canonicalTeamData(encode(THREE_BOARDS)))
  })

  it('rejects unknown modes, count mismatches, and unknown map keys', () => {
    expect(validateSavedTeam(record({ mode: '9v9' }))).toBeNull()
    expect(validateSavedTeam(record({ mode: '5v5' }))).toBeNull()
    expect(
      validateSavedTeam(
        record({ data: encode({ boards: [{ m: 'nope' }, { m: 'arena1' }, { m: 'arena1' }] }) }),
      ),
    ).toBeNull()
  })

  it('rejects structural garbage', () => {
    expect(validateSavedTeam(null)).toBeNull()
    expect(validateSavedTeam('x')).toBeNull()
    expect(validateSavedTeam(record({ id: '' }))).toBeNull()
    expect(validateSavedTeam(record({ name: '  ' }))).toBeNull()
    expect(validateSavedTeam(record({ data: 'garbage' }))).toBeNull()
  })

  it('normalizes non-numeric timestamps to 0', () => {
    const valid = validateSavedTeam(record({ createdAt: 'yesterday', updatedAt: null }))
    expect(valid!.createdAt).toBe(0)
    expect(valid!.updatedAt).toBe(0)
  })
})
