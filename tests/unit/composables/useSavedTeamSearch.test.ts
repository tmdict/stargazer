import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSavedTeamSearch, type SearchHero } from '@/composables/useSavedTeamSearch'
import type { TeamModeKey } from '@/lib/teams/modes'
import { lineupHeroKey } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { loadSkillLocale } from '@/utils/dataLoader'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import { GUNNAR } from '../fixtures/characters'

/* Runs over the real roster and the en name index. Rolan and Alsa are the
 * fielded heroes; Rowan and Aliceth share their prefixes but sit on no team,
 * so they prove the suggestion pool is the teams, not the roster. Gunnar
 * shares records with Rolan but never a lineup, and Duo's enemy side mirrors
 * Rolan outside the Rolan + Alsa lineup. */

const ROLAN = 121
const ALSA = 48

// A board's ally ids, then its enemy ids.
type Board = [ally: number[], enemy?: number[]]

const side = (ids: number[], team: Team, firstHex: number): [number, number, Team][] =>
  ids.map((id, i) => [firstHex + i, id, team])

const team = (name: string, ...boards: Board[]): SavedTeam => {
  const mode: TeamModeKey = boards.length === 1 ? '1v1' : '3v3'
  return {
    id: name,
    name,
    mode,
    data: encodeMultiGridStateToUrl({
      boards: boards.map(([ally, enemy = []]) => ({
        m: 'arena1',
        c: [...side(ally, Team.ALLY, 1), ...side(enemy, Team.ENEMY, 30)],
      })),
      mode,
    }),
    createdAt: 0,
    updatedAt: 0,
  }
}

const TEAMS = [
  team('Duo', [[ROLAN, ALSA], [ROLAN]]),
  team('Solo', [[ROLAN]]),
  team('Alsa squad', [[ALSA]]),
  team('Split sides', [[ROLAN], [GUNNAR]]),
  team('Split boards', [[ROLAN]], [[GUNNAR]]),
  team('Empty', [[]]),
]

type Search = ReturnType<typeof useSavedTeamSearch>

const names = (search: Search): string[] => search.results.value.map(({ team }) => team.name)
const slugs = (heroes: readonly SearchHero[]): string[] => heroes.map(({ slug }) => slug)
const ringed = (search: Search, index: number): ReadonlySet<string> =>
  search.results.value[index]!.highlightHeroes!
const ally = (slug: string, board = 0): string => lineupHeroKey(board, Team.ALLY, slug)
const enemy = (slug: string): string => lineupHeroKey(0, Team.ENEMY, slug)

let scope: EffectScope

const setup = (teams: () => readonly SavedTeam[] = () => TEAMS): Search =>
  scope.run(() => useSavedTeamSearch(teams))!

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

  it('offers only heroes sharing a lineup with every pill', () => {
    const search = setup()
    search.query.value = 'gu'
    expect(slugs(search.suggestions.value)).toEqual(['gunnar'])

    search.addHero('rolan')
    search.query.value = 'gu'
    expect(search.suggestions.value).toEqual([])
  })
})

describe('useSavedTeamSearch results', () => {
  it('keeps only the teams fielding every pill hero and rings those heroes', () => {
    const search = setup()
    expect(names(search)).toEqual([
      'Duo',
      'Solo',
      'Alsa squad',
      'Split sides',
      'Split boards',
      'Empty',
    ])
    expect(search.results.value[0]!.highlightHeroes).toBeUndefined()

    search.addHero('rolan')
    expect(names(search)).toEqual(['Duo', 'Solo', 'Split sides', 'Split boards'])
    expect(ringed(search, 0)).toEqual(new Set([ally('rolan'), enemy('rolan')]))

    // The mirrored enemy Rolan leaves the rings once only the ally side matches.
    search.addHero('alsa')
    expect(names(search)).toEqual(['Duo'])
    expect(ringed(search, 0)).toEqual(new Set([ally('rolan'), ally('alsa')]))

    search.clear()
    expect(search.heroes.value).toEqual([])
    expect(names(search)).toHaveLength(TEAMS.length)
  })

  it('pairs heroes only within one lineup, by pill or by text', async () => {
    const search = setup()
    search.addHero('gunnar')
    expect(names(search)).toEqual(['Split sides', 'Split boards'])
    expect(ringed(search, 1)).toEqual(new Set([ally('gunnar', 1)]))

    await type(search, 'rol')
    expect(names(search)).toEqual([])
    search.addHero('rolan')
    expect(names(search)).toEqual([])
  })

  it('applies the text on top of the pills, by name or by hero', async () => {
    const search = setup()
    search.addHero('alsa')
    await type(search, 'squad')
    expect(names(search)).toEqual(['Alsa squad'])
    expect(search.results.value[0]!.name).toEqual({ pre: 'Alsa ', match: 'squad', post: '' })

    await type(search, 'rol')
    expect(names(search)).toEqual(['Duo'])
    expect(ringed(search, 0)).toEqual(new Set([ally('alsa'), ally('rolan')]))
  })

  it('hands a card the same ring set across a filter pass', () => {
    const source = shallowRef(TEAMS)
    const search = setup(() => source.value)
    search.addHero('rolan')
    const rings = ringed(search, 0)

    source.value = [...TEAMS].reverse()
    expect(names(search)).toEqual(['Split boards', 'Split sides', 'Solo', 'Duo'])
    expect(ringed(search, 3)).toBe(rings)
  })

  it('lets a pick drop the text without waiting for the debounce', async () => {
    const search = setup()
    await type(search, 'solo')
    expect(names(search)).toEqual(['Solo'])

    search.addHero('rolan')
    expect(search.query.value).toBe('')
    expect(names(search)).toEqual(['Duo', 'Solo', 'Split sides', 'Split boards'])
  })
})
