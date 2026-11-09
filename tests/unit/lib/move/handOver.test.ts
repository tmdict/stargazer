import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LINK_MARK, MAX_CODE_LENGTH, TRAVEL_KEYS } from '@/lib/move/config'
import { packLink } from '@/lib/move/pack'
import { applyHandOver } from '@/lib/move/receive'
import { MAX_SAVED_TEAMS } from '@/lib/teams/modes'
import { canonicalTeamData, type SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { encodeGridStateToUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import { stubLocalStorage } from '../../fixtures/storage'

/* A hand-over end to end: an old address's storage is packed into a link code
 * by the function the old pages inline, and applied to the new address's
 * storage through the real stores. */

const teamData = (hero: number): string =>
  canonicalTeamData(
    encodeMultiGridStateToUrl({
      boards: [{ m: 'arena1', c: [[1, hero, Team.ALLY]] }],
      mode: '1v1',
    }),
  )!

const team = (id: string, name: string, hero = 11): SavedTeam => ({
  id,
  name,
  mode: '1v1',
  data: teamData(hero),
  createdAt: 1,
  updatedAt: 1,
})

const roster = (id: string, name: string, hero = 1) => ({
  id,
  name,
  heroes: { [hero]: {} },
  createdAt: 1,
  updatedAt: 1,
})

const ARENA_WITH_HERO = encodeGridStateToUrl({ c: [[1, 11, Team.ALLY]] })
const ARENA_EMPTY = encodeGridStateToUrl({})

const slot = (hero?: number): string =>
  JSON.stringify({
    data: encodeMultiGridStateToUrl({
      boards: [{ m: 'arena1', ...(hero ? { c: [[1, hero, Team.ALLY]] } : {}) }],
      mode: '1v1',
    }),
    sourceId: null,
  })

const pack = async (old: Record<string, string>): Promise<string> => {
  const link = await packLink(
    { getItem: (key) => old[key] ?? null },
    TRAVEL_KEYS,
    LINK_MARK,
    MAX_CODE_LENGTH,
  )
  return link!.slice(LINK_MARK.length)
}

const OLD = {
  'stargazer.teams.saved': JSON.stringify([team('t1', 'Alpha'), team('t2', 'Beta', 12)]),
  'stargazer.rosters': JSON.stringify([roster('r1', 'Main'), roster('r2', 'Alt', 2)]),
  'stargazer.rosters.active': 'r2',
  'stargazer.arena': ARENA_WITH_HERO,
  'stargazer.season': '8',
  'stargazer.arena.variant': 'gd',
  'stargazer.teams.mode': '1v1',
  'stargazer.teams.active.1v1': slot(11),
  'stargazer.locale': 'zh',
  'stargazer.prefs': JSON.stringify({ theme: 'dark', gridInfo: { master: false } }),
  'stargazer.skillLocale': 'ja',
  'stargazer.recentHeroes': '["evie"]',
}

let storage: Map<string, string>

const travels = (key: string): boolean => (TRAVEL_KEYS as readonly string[]).includes(key)

const savedTeams = (): SavedTeam[] =>
  JSON.parse(storage.get('stargazer.teams.saved') ?? '[]') as SavedTeam[]
const moved = (): boolean => 'moved' in JSON.parse(storage.get('stargazer.flags') ?? '{}')

beforeEach(() => {
  vi.stubEnv('SSR', false)
  storage = stubLocalStorage().storage
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('packLink', () => {
  it('has nothing to send when no carried item is stored', async () => {
    const link = await packLink(
      { getItem: (key) => (key === 'stargazer.recentHeroes' ? '[]' : null) },
      TRAVEL_KEYS,
      LINK_MARK,
      MAX_CODE_LENGTH,
    )
    expect(link).toBeNull()
  })

  it('sends the mark alone when the code would be too long for a link', async () => {
    const link = await packLink({ getItem: () => 'x' }, TRAVEL_KEYS, LINK_MARK, 4)
    expect(link).toBe(LINK_MARK)
  })
})

describe('applyHandOver', () => {
  it('brings every carried item to a fresh address, and nothing else', async () => {
    const result = await applyHandOver(await pack(OLD), false, createPinia())

    expect(result).toEqual({ ok: true, teams: 2, rosters: 2, teamsLeft: 0, rostersLeft: 0 })
    const carried = Object.fromEntries(Object.entries(OLD).filter(([key]) => travels(key)))
    expect(Object.fromEntries([...storage].filter(([key]) => travels(key)))).toEqual(carried)
    expect(storage.has('stargazer.recentHeroes')).toBe(false)
    expect(moved()).toBe(true)
  })

  it('ignores a code that was not asked for once a hand-over has arrived', async () => {
    const code = await pack(OLD)
    await applyHandOver(code, false, createPinia())
    storage.set('stargazer.teams.saved', '[]')

    expect(await applyHandOver(code, false, createPinia())).toBeNull()
    expect(savedTeams()).toEqual([])
  })

  it('merges a requested hand-over into work made here, and adds nothing the second time', async () => {
    const edited = team('t1', 'Alpha edited', 13)
    const own = team('own', 'New here', 14)
    storage.set('stargazer.teams.saved', JSON.stringify([edited, own]))
    storage.set('stargazer.rosters', JSON.stringify([roster('mine', 'Mine', 3)]))
    storage.set('stargazer.rosters.active', 'mine')
    storage.set('stargazer.arena', ARENA_EMPTY)
    storage.set('stargazer.season', '8')
    storage.set('stargazer.teams.active.1v1', slot(15))
    storage.set('stargazer.locale', 'ko')
    storage.set('stargazer.prefs', JSON.stringify({ gridInfo: { master: true } }))
    const code = await pack(OLD)

    const first = await applyHandOver(code, true, createPinia())
    expect(first).toMatchObject({ ok: true, teams: 2, rosters: 2 })
    expect(savedTeams().map((t) => t.name)).toEqual([
      'Alpha edited',
      'New here',
      'Alpha (imported)',
      'Beta',
    ])
    // The roster picked here stays active.
    expect(storage.get('stargazer.rosters.active')).toBe('mine')
    // The empty Arena board gives way with its pick; the Teams board in use,
    // the language and the Grid Info set here stay, and the look fills in.
    expect(storage.get('stargazer.arena')).toBe(ARENA_WITH_HERO)
    expect(storage.get('stargazer.arena.variant')).toBe('gd')
    expect(storage.get('stargazer.teams.active.1v1')).toBe(slot(15))
    expect(storage.get('stargazer.locale')).toBe('ko')
    expect(JSON.parse(storage.get('stargazer.prefs')!)).toEqual({
      theme: 'dark',
      gridInfo: { master: true },
    })

    const second = await applyHandOver(code, true, createPinia())
    expect(second).toMatchObject({ ok: true, teams: 0, rosters: 0 })
    expect(savedTeams()).toHaveLength(4)
  })

  it('unlinks a carried board from a saved team that was edited here', async () => {
    const linked = (sourceId: string): string =>
      JSON.stringify({ ...(JSON.parse(slot(11)) as object), sourceId })
    const code = await pack({ ...OLD, 'stargazer.teams.active.1v1': linked('t1') })

    storage.set('stargazer.teams.saved', JSON.stringify([team('t1', 'Alpha')]))
    await applyHandOver(code, true, createPinia())
    expect(storage.get('stargazer.teams.active.1v1')).toBe(linked('t1'))

    storage.delete('stargazer.teams.active.1v1')
    storage.set('stargazer.teams.saved', JSON.stringify([team('t1', 'Alpha edited', 13)]))
    await applyHandOver(code, true, createPinia())
    expect(JSON.parse(storage.get('stargazer.teams.active.1v1')!)).toMatchObject({ sourceId: null })
  })

  it('stops at the library limit, reports what did not fit and stays open for the rest', async () => {
    const full = Array.from({ length: MAX_SAVED_TEAMS - 1 }, (_, i) => team(`own${i}`, `Own ${i}`))
    storage.set('stargazer.teams.saved', JSON.stringify(full))

    const result = await applyHandOver(await pack(OLD), true, createPinia())
    expect(result).toMatchObject({ ok: true, teams: 1, teamsLeft: 1 })
    expect(savedTeams()).toHaveLength(MAX_SAVED_TEAMS)

    // With room made, the same link brings the rest without being asked for.
    expect(moved()).toBe(false)
    storage.set('stargazer.teams.saved', JSON.stringify(savedTeams().slice(1)))
    const later = await applyHandOver(await pack(OLD), false, createPinia())
    expect(later).toMatchObject({ ok: true, teams: 1, teamsLeft: 0 })
    expect(moved()).toBe(true)
  })

  it('reports a failure, and records no hand-over, for the mark alone or a broken code', async () => {
    expect(await applyHandOver('', false, createPinia())).toMatchObject({ ok: false })
    expect(await applyHandOver('not-a-code', false, createPinia())).toMatchObject({ ok: false })
    expect(moved()).toBe(false)
  })

  it('still brings the libraries when a setting does not parse', async () => {
    const result = await applyHandOver(
      await pack({ ...OLD, 'stargazer.prefs': 'garbage{' }),
      false,
      createPinia(),
    )
    expect(result).toMatchObject({ ok: true, teams: 2, rosters: 2 })
    expect(storage.has('stargazer.prefs')).toBe(false)
  })
})
