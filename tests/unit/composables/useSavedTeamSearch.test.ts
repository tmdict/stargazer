import { effectScope, nextTick, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSavedTeamSearch, type SearchHero } from '@/composables/useSavedTeamSearch'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { loadSkillLocale } from '@/utils/dataLoader'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* Runs over the real roster and the en name index. Rolan and Alsa are the
 * fielded heroes; Rowan and Aliceth share their prefixes but sit on no team,
 * so they prove the suggestion pool is the teams, not the roster. */

const ROLAN = 121
const ALSA = 48

const record = (ids: number[]): string =>
  encodeMultiGridStateToUrl({
    boards: [
      { m: 'arena1', c: ids.map((id, i): [number, number, Team] => [i + 1, id, Team.ALLY]) },
    ],
    mode: '1v1',
  })

const team = (name: string, ids: number[]): SavedTeam => ({
  id: name,
  name,
  mode: '1v1',
  data: record(ids),
  createdAt: 0,
  updatedAt: 0,
})

const TEAMS = [
  team('Duo', [ROLAN, ALSA]),
  team('Solo', [ROLAN]),
  team('Alsa squad', [ALSA]),
  team('Empty', []),
]

type Search = ReturnType<typeof useSavedTeamSearch>

const names = (search: Search): string[] => search.results.value.map(({ team }) => team.name)
const slugs = (heroes: readonly SearchHero[]): string[] => heroes.map(({ slug }) => slug)
const ringed = (search: Search, index: number): ReadonlySet<string> =>
  search.results.value[index]!.highlightHeroes!

let scope: EffectScope

const setup = (): Search => scope.run(() => useSavedTeamSearch(() => TEAMS))!

// The text filter waits out the typing debounce; a pick or a clear does not.
const type = async (search: Search, text: string): Promise<void> => {
  search.query.value = text
  await nextTick()
  vi.advanceTimersByTime(200)
}

beforeAll(async () => {
  await loadSkillLocale('en')
})

beforeEach(() => {
  setActivePinia(createPinia())
  useGameDataStore().initializeContentData()
  scope = effectScope()
  vi.useFakeTimers()
})

afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

describe('useSavedTeamSearch suggestions', () => {
  it('lists the heroes the text matches among the teams the pills leave', () => {
    const search = setup()
    search.query.value = 'r'
    expect(search.suggestions.value).toEqual([])
    search.query.value = 'ro'
    expect(search.suggestions.value).toEqual([{ slug: 'rolan', label: 'Rolan' }])
    search.query.value = 'ali'
    expect(search.suggestions.value).toEqual([])

    search.addHero('rolan')
    expect(search.query.value).toBe('')
    expect(search.heroes.value).toEqual([{ slug: 'rolan', label: 'Rolan' }])
    // A picked hero leaves the list; Alsa stays because Duo fields both.
    search.query.value = 'ro'
    expect(search.suggestions.value).toEqual([])
    search.query.value = 'al'
    expect(slugs(search.suggestions.value)).toEqual(['alsa'])

    search.addHero('alsa')
    search.query.value = 'al'
    expect(search.suggestions.value).toEqual([])
    search.removeHero('alsa')
    expect(slugs(search.suggestions.value)).toEqual(['alsa'])
  })
})

describe('useSavedTeamSearch results', () => {
  it('keeps only the teams fielding every pill hero and rings those heroes', () => {
    const search = setup()
    expect(names(search)).toEqual(['Duo', 'Solo', 'Alsa squad', 'Empty'])
    expect(search.results.value[0]!.highlightHeroes).toBeUndefined()

    search.addHero('rolan')
    expect(names(search)).toEqual(['Duo', 'Solo'])
    expect([...ringed(search, 0)]).toEqual(['rolan'])

    search.addHero('alsa')
    expect(names(search)).toEqual(['Duo'])
    expect([...ringed(search, 0)]).toEqual(['rolan', 'alsa'])

    search.clear()
    expect(search.heroes.value).toEqual([])
    expect(names(search)).toHaveLength(4)
  })

  it('applies the text on top of the pills, by name or by hero', async () => {
    const search = setup()
    search.addHero('alsa')
    await type(search, 'squad')
    expect(names(search)).toEqual(['Alsa squad'])
    expect(search.results.value[0]!.name).toEqual({ pre: 'Alsa ', match: 'squad', post: '' })

    await type(search, 'rol')
    expect(names(search)).toEqual(['Duo'])
    expect(ringed(search, 0).has('alsa')).toBe(true)
    expect(ringed(search, 0).has('rolan')).toBe(true)
  })

  it('lets a pick drop the text without waiting for the debounce', async () => {
    const search = setup()
    await type(search, 'solo')
    expect(names(search)).toEqual(['Solo'])

    search.addHero('rolan')
    expect(search.query.value).toBe('')
    expect(names(search)).toEqual(['Duo', 'Solo'])
  })
})
