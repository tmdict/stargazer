import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_SAVED_TEAMS } from '@/lib/teams/modes'
import { canonicalTeamData, type SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const LIBRARY_KEY = 'stargazer.teams.saved'

const storage = new Map<string, string>()

const CANONICAL_3V3 = canonicalTeamData(
  encodeMultiGridStateToUrl({
    boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
    mode: '3v3',
  }),
)!

const CANONICAL_1V1 = canonicalTeamData(
  encodeMultiGridStateToUrl({ boards: [{ m: 'arena2' }], mode: '1v1' }),
)!

const record = (id: string, name: string): SavedTeam => ({
  id,
  name,
  mode: '3v3',
  data: CANONICAL_3V3,
  createdAt: 1,
  updatedAt: 1,
})

const seed = (teams: SavedTeam[], version = 1): void => {
  storage.set(LIBRARY_KEY, JSON.stringify({ v: version, teams }))
}

const stored = (): SavedTeam[] => JSON.parse(storage.get(LIBRARY_KEY)!).teams as SavedTeam[]

beforeEach(() => {
  vi.stubEnv('SSR', false)
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('useTeamLibrary', () => {
  it('hydrates valid records and drops invalid ones with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed([record('a', 'Alpha'), { ...record('b', 'Broken'), mode: '9v9' } as never])
    const library = useTeamLibrary()
    expect(library.teams.map((t) => t.id)).toEqual(['a'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('treats unknown versions and corrupt blobs as empty', () => {
    seed([record('a', 'Alpha')], 2)
    expect(useTeamLibrary().teams).toHaveLength(0)

    setActivePinia(createPinia())
    storage.set(LIBRARY_KEY, 'not json')
    expect(useTeamLibrary().teams).toHaveLength(0)
  })

  it('preserves an unknown-version blob under the backup key before overwriting it', () => {
    seed([record('a', 'Alpha')], 2)
    const library = useTeamLibrary()
    expect(library.teams).toHaveLength(0)

    library.saveAsNew('3v3', CANONICAL_3V3, 'New')
    expect(JSON.parse(storage.get(LIBRARY_KEY)!).v).toBe(1)
    const backup = JSON.parse(storage.get(`${LIBRARY_KEY}.backup`)!) as {
      v: number
      teams: unknown[]
    }
    expect(backup.v).toBe(2)
    expect(backup.teams).toHaveLength(1)
  })

  it('one poison record drops alone without hiding the rest of the library', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed([
      record('a', 'Alpha'),
      { ...record('p', 'Poison'), data: encodeMultiGridStateToUrl({ boards: [null] } as never) },
    ])
    const library = useTeamLibrary()
    expect(library.teams.map((t) => t.id)).toEqual(['a'])
    warn.mockRestore()
  })

  it('saveAsNew and update canonicalize data and reject garbage', () => {
    const library = useTeamLibrary()
    const withViewerState = encodeMultiGridStateToUrl({
      boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena1' }, { m: 'arena1' }],
      active: 2,
      d: 127,
      mode: '3v3',
    })
    const team = library.saveAsNew('3v3', withViewerState)!
    expect(team.data).toBe(canonicalTeamData(withViewerState))

    expect(library.update(team.id, withViewerState)).toBe(true)
    expect(library.get(team.id)!.data).toBe(canonicalTeamData(withViewerState))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(library.saveAsNew('3v3', 'garbage')).toBeNull()
    expect(library.update(team.id, 'garbage')).toBe(false)
    warn.mockRestore()
  })

  it('saveAsNew assigns auto-names and sanitizes custom names', () => {
    const library = useTeamLibrary()
    const first = library.saveAsNew('3v3', CANONICAL_3V3)!
    expect(first.name).toBe('Team 1')
    const second = library.saveAsNew('3v3', CANONICAL_3V3, '  My Comp  ')!
    expect(second.name).toBe('My Comp')
    expect(library.count).toBe(2)
    expect(stored()).toHaveLength(2)
    expect(first.id).not.toBe(second.id)
  })

  it('enforces the cap on saveAsNew and duplicate', () => {
    seed(Array.from({ length: MAX_SAVED_TEAMS }, (_, i) => record(`id-${i}`, `Team ${i + 1}`)))
    const library = useTeamLibrary()
    expect(library.atCap).toBe(true)
    expect(library.saveAsNew('1v1', CANONICAL_1V1)).toBeNull()
    expect(library.duplicate('id-0')).toBeNull()
    expect(library.count).toBe(MAX_SAVED_TEAMS)
  })

  it('update rewrites data + updatedAt and keeps name/createdAt', () => {
    seed([record('a', 'Alpha')])
    const library = useTeamLibrary()
    const before = library.get('a')!
    expect(library.update('a', CANONICAL_3V3)).toBe(true)
    const after = library.get('a')!
    expect(after.name).toBe('Alpha')
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt)
    expect(library.update('missing', CANONICAL_3V3)).toBe(false)
  })

  it('rename validates, duplicate copies with a fresh id and (copy) name', () => {
    seed([record('a', 'Alpha')])
    const library = useTeamLibrary()
    expect(library.rename('a', '  Bravo  ')).toBe(true)
    expect(library.get('a')!.name).toBe('Bravo')
    expect(library.rename('a', '   ')).toBe(false)

    const copy = library.duplicate('a')!
    expect(copy.id).not.toBe('a')
    expect(copy.name).toBe('Bravo (copy)')
    expect(copy.data).toBe(library.get('a')!.data)
    expect(library.duplicate('missing')).toBeNull()
  })

  it('remove and removeAll persist immediately', () => {
    seed([record('a', 'Alpha'), record('b', 'Bravo')])
    const library = useTeamLibrary()
    library.remove('a')
    expect(stored().map((t) => t.id)).toEqual(['b'])
    library.removeAll()
    expect(stored()).toHaveLength(0)
    expect(library.count).toBe(0)
  })

  it('mutations read-modify-write against fresh storage (another tab wrote)', () => {
    seed([record('a', 'Alpha')])
    const library = useTeamLibrary()
    // Simulate a second tab adding a record behind this store's back.
    seed([record('a', 'Alpha'), record('b', 'Bravo')])
    library.saveAsNew('1v1', CANONICAL_1V1, 'Charlie')
    expect(
      stored()
        .map((t) => t.name)
        .sort(),
    ).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(library.teams).toHaveLength(3)
  })
})

describe('useTeamLibrary export/import', () => {
  it('export -> wipe -> import restores the library (fresh ids)', () => {
    seed([record('a', 'Alpha'), record('b', 'Bravo')])
    const library = useTeamLibrary()
    const file = JSON.stringify(library.exportAll())

    library.removeAll()
    expect(library.count).toBe(0)

    const result = library.importTeams(file)
    expect(result).toEqual({ imported: 2, skipped: 0, invalid: false })
    expect(library.teams.map((t) => t.name).sort()).toEqual(['Alpha', 'Bravo'])
    expect(stored().map((t) => t.id)).not.toContain('a')
  })

  it('import merges and skips duplicates of current records', () => {
    seed([record('a', 'Alpha')])
    const library = useTeamLibrary()
    const file = JSON.stringify(library.exportAll())
    const result = library.importTeams(file)
    expect(result).toEqual({ imported: 0, skipped: 1, invalid: false })
    expect(library.count).toBe(1)
  })

  it('rejects invalid envelopes without touching the library', () => {
    seed([record('a', 'Alpha')])
    const library = useTeamLibrary()
    expect(library.importTeams('nope')).toEqual({ imported: 0, skipped: 0, invalid: true })
    expect(library.count).toBe(1)
  })

  it('counts cap overflow as skipped', () => {
    seed(Array.from({ length: MAX_SAVED_TEAMS - 1 }, (_, i) => record(`id-${i}`, `Team ${i + 1}`)))
    const library = useTeamLibrary()
    const file = JSON.stringify({
      app: 'stargazer',
      kind: 'saved-teams',
      version: 1,
      teams: [record('x', 'New One'), record('y', 'New Two')],
    })
    const result = library.importTeams(file)
    expect(result).toEqual({ imported: 1, skipped: 1, invalid: false })
    expect(library.count).toBe(MAX_SAVED_TEAMS)
  })
})
