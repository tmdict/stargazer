import { describe, expect, it, vi } from 'vitest'

import { canonicalTeamData, type SavedTeam } from '@/lib/teams/savedTeam'
import { buildExport, parseImport } from '@/lib/teams/transfer'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* parseImport is the only place untrusted file content enters the app; this
 * suite exhausts its rejection paths, plus the merge/dedupe/id-stability rules. */

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
  JSON.stringify({ app: 'stargazer', kind: 'saved-teams', teams, ...overrides })

describe('buildExport', () => {
  // parseImport accepting the export proves the envelope is well-formed; its
  // rejection paths below pin every envelope field.
  it('round-trips through parseImport', () => {
    const file = buildExport([record()], '2026-07-04T00:00:00.000Z')
    expect(file.exportedAt).toBe('2026-07-04T00:00:00.000Z')
    const result = parseImport(JSON.stringify(file), [])
    expect(result).toMatchObject({ skipped: 0, accepted: [expect.any(Object)] })
  })
})

describe('parseImport envelope rejection', () => {
  it.each([
    ['not json', 'garbage{'],
    ['non-object', '"string"'],
    ['wrong app', envelope([], { app: 'other' })],
    ['wrong kind', envelope([], { kind: 'settings' })],
    ['teams not an array', JSON.stringify({ app: 'stargazer', kind: 'saved-teams', teams: 'x' })],
  ])('rejects %s wholesale', (_label, raw) => {
    expect(parseImport(raw, [])).toBeNull()
  })
})

describe('parseImport record validation', () => {
  // Record-rejection variants are validateSavedTeam's, pinned in
  // savedTeam.test.ts; this pins skip-not-reject and the skipped count.
  it('skips invalid records without rejecting the file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = parseImport(
      envelope([
        record(),
        record({ mode: '9v9' as never }),
        'not-an-object',
        // A section of the wrong shape would throw in the preview and restore
        // consumers; the decode boundary drops the record instead.
        record({ data: encode({ boards: [{ a: {} }, {}, {}] } as never) }),
      ]),
      [],
    )
    expect(result).toMatchObject({ skipped: 3, accepted: [expect.any(Object)] })
    warn.mockRestore()
  })

  it('keeps the file id so a record round-trips with its identity', () => {
    const result = parseImport(envelope([record({ id: 'stable-id' })]), [])!
    expect(result.accepted[0]!.id).toBe('stable-id')
    expect(result.conflicts).toBe(0)
  })

  it('marks an old version of an existing team (its id is taken) as a conflict', () => {
    const existing = record({ id: 'existing', name: 'Other' })
    const result = parseImport(envelope([record({ id: 'existing' })]), [existing])!
    expect(result.conflicts).toBe(1)
    expect(result.accepted[0]!.id).not.toBe('existing')
    expect(result.accepted[0]!.name).toBe('Alpha (imported)')
  })

  it('regenerates in-file duplicate ids without marking a conflict', () => {
    const result = parseImport(
      envelope([record({ id: 'dupe' }), record({ id: 'dupe', name: 'Other' })]),
      [],
    )!
    expect(result.accepted[0]!.id).toBe('dupe')
    expect(result.accepted[1]!.id).not.toBe('dupe')
    expect(result.accepted[1]!.name).toBe('Other')
    expect(result.conflicts).toBe(0)
  })

  it('regenerates overlong ids', () => {
    const result = parseImport(envelope([record({ id: 'x'.repeat(65) })]), [])!
    expect(result.accepted[0]!.id).toHaveLength(36)
  })

  it('skips duplicates of existing teams and within the file (data + name)', () => {
    const existing: SavedTeam = {
      ...record({ id: 'existing-id' }),
      data: canonicalTeamData(DATA_3V3)!,
    }
    const result = parseImport(
      envelope([
        record(), // duplicate of existing (same canonical data + name)
        record({ name: 'Different name' }), // same data, new name → kept
        record({ name: 'Different name' }), // in-file duplicate → skipped
      ]),
      [existing],
    )
    expect(result).toMatchObject({
      skipped: 2,
      accepted: [expect.objectContaining({ name: 'Different name' })],
    })
  })
})
