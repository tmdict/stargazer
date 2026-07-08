import { describe, expect, it } from 'vitest'

import { canonicalTeamData, type SavedTeam } from '@/lib/teams/savedTeam'
import { buildExport, parseImport } from '@/lib/teams/transfer'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* parseImport is the only place untrusted file content enters the app; this
 * suite exhausts its rejection paths, plus the merge/dedupe/fresh-id rules. */

const encode = (state: MultiGridState): string => encodeMultiGridStateToUrl(state)

const DATA_3V3 = encode({
  boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
  mode: '3v3',
})

const record = (overrides: Partial<SavedTeam> = {}): SavedTeam => ({
  id: 'file-id',
  name: 'Alpha',
  mode: '3v3',
  data: DATA_3V3,
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
})

const envelope = (teams: unknown[], overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({ app: 'stargazer', kind: 'saved-teams', version: 1, teams, ...overrides })

describe('buildExport', () => {
  it('wraps the library in the versioned envelope', () => {
    const file = buildExport([record()], '2026-07-04T00:00:00.000Z')
    expect(file.app).toBe('stargazer')
    expect(file.kind).toBe('saved-teams')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toBe('2026-07-04T00:00:00.000Z')
    expect(file.teams).toHaveLength(1)
  })

  it('round-trips through parseImport', () => {
    const file = buildExport([record()], new Date(0).toISOString())
    const result = parseImport(JSON.stringify(file), [])
    expect(result).toMatchObject({ ok: true, skipped: 0, teams: [expect.any(Object)] })
  })
})

describe('parseImport envelope rejection', () => {
  it.each([
    ['not json', 'garbage{'],
    ['non-object', '"string"'],
    ['wrong app', envelope([], { app: 'other' })],
    ['wrong kind', envelope([], { kind: 'settings' })],
    ['wrong version', envelope([], { version: 2 })],
    [
      'teams not an array',
      JSON.stringify({ app: 'stargazer', kind: 'saved-teams', version: 1, teams: 'x' }),
    ],
  ])('rejects %s wholesale', (_label, raw) => {
    expect(parseImport(raw, [])).toEqual({ ok: false })
  })
})

describe('parseImport record validation', () => {
  it('skips invalid records without rejecting the file', () => {
    const result = parseImport(
      envelope([
        record(),
        record({ mode: '9v9' as never }),
        record({ data: 'undecodable' }),
        record({ data: encode({ boards: [{ m: 'arena1' }], mode: '1v1' }) }), // count mismatch vs 3v3
        record({ data: encode({ boards: [null, {}, {}] } as never) }), // non-object board entry
        record({ name: '   ' }),
        'not-an-object',
      ]),
      [],
    )
    expect(result).toMatchObject({ ok: true, skipped: 6, teams: [expect.any(Object)] })
  })

  it('canonicalizes accepted data (viewer state stripped, byte-stable)', () => {
    const withViewerState = encode({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
      active: 2,
      d: 127,
      mode: '3v3',
    })
    const result = parseImport(envelope([record({ data: withViewerState })]), [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = result.teams[0]!.data
    expect(stored).toBe(canonicalTeamData(withViewerState))
    const decoded = decodeMultiGridStateFromUrl(stored)!
    expect(decoded.active).toBeUndefined()
    expect(decoded.d).toBeUndefined()
    // Round-trips to itself, so a selected import can never start dirty.
    expect(canonicalTeamData(stored)).toBe(stored)
  })

  it('clamps names and preserves timestamps', () => {
    const result = parseImport(
      envelope([record({ name: `  ${'x'.repeat(80)}  `, createdAt: 42, updatedAt: 43 })]),
      [],
    )
    if (!result.ok) throw new Error('expected ok')
    expect(result.teams[0]!.name).toHaveLength(60)
    expect(result.teams[0]!.createdAt).toBe(42)
    expect(result.teams[0]!.updatedAt).toBe(43)
  })

  it('assigns fresh ids so imports never collide with existing records', () => {
    const existing = record({ id: 'existing', name: 'Other' })
    const result = parseImport(envelope([record({ id: 'existing' })]), [existing])
    if (!result.ok) throw new Error('expected ok')
    expect(result.teams[0]!.id).not.toBe('existing')
  })

  it('skips duplicates of existing teams and within the file (data + name)', () => {
    const existing: SavedTeam = { ...record(), data: canonicalTeamData(DATA_3V3)! }
    const result = parseImport(
      envelope([
        record(), // duplicate of existing (same canonical data + name)
        record({ name: 'Different name' }), // same data, new name → kept
        record({ name: 'Different name' }), // in-file duplicate → skipped
      ]),
      [existing],
    )
    expect(result).toMatchObject({
      ok: true,
      skipped: 2,
      teams: [expect.objectContaining({ name: 'Different name' })],
    })
  })
})
