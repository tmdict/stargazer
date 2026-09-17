// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import SavedTeamsList from '@/components/teams/SavedTeamsList.vue'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { loadSkillLocale } from '@/utils/dataLoader'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* The type filter row (offered only for a board count with named types,
 * reset to All on every change of the Teams filter, classifying records by
 * their maps) and the search field's hero pills. */

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  localStorage.clear()
})

const record = (state: MultiGridState): string =>
  canonicalTeamData(encodeMultiGridStateToUrl(state))!

const mapsRecord = (maps: readonly string[], mode: string): string =>
  record({ boards: maps.map((m) => ({ m })), mode })

type Library = ReturnType<typeof useTeamLibrary>

const seedTypes = (library: Library): void => {
  library.saveAsNew('5v5', mapsRecord(TEAM_VARIANTS.sl.maps, '5v5'), 'S7 SL')
  library.saveAsNew(
    '5v5',
    mapsRecord(['arena1', 'arena3', 'arena1', 'arena1', 'arena1'], '5v5'),
    'Custom',
  )
  library.saveAsNew('3v3', mapsRecord(TEAM_VARIANTS.gd.maps, '3v3'), 'S7 GD')
}

// Real roster ids: Rolan (121) and Alsa (48). Hero matching needs the store's
// id-to-slug lookup and the en name index.
const heroRecord = (ids: number[]): string =>
  record({
    boards: [
      { m: 'arena1', c: ids.map((id, i): [number, number, Team] => [i + 1, id, Team.ALLY]) },
    ],
    mode: '1v1',
  })

const seedHeroes = (library: Library): void => {
  useGameDataStore().initializeContentData()
  library.saveAsNew('1v1', heroRecord([121, 48]), 'Duo')
  library.saveAsNew('1v1', heroRecord([121]), 'Solo')
  library.saveAsNew('1v1', heroRecord([48]), 'Alsa squad')
}

const mountList = async (seed: (library: Library) => void = seedTypes) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  seed(useTeamLibrary())
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(SavedTeamsList, { loadedTeamId: null }) })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
}

const byText = (selector: string, label: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>(selector)].find(
    (el) => el.textContent?.trim() === label,
  )!

const typeChips = (): string[] =>
  [...document.querySelectorAll('.type-chip')].map((el) => el.textContent?.trim() ?? '')

// Sorted: the three records share an updatedAt, so their list order is not
// part of what these tests assert.
const cardNames = (): string[] =>
  [...document.querySelectorAll('.team-card .team-name')]
    .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .sort()

describe('SavedTeamsList type filter', () => {
  it('offers the type chips only for a board count with named types', async () => {
    await mountList()
    expect(document.querySelector('.type-group')).toBeNull()

    byText('.seg-btn', '5v5').click()
    await nextTick()
    expect(typeChips()).toEqual(['All', 'Default', 'SL'])

    byText('.seg-btn', '1v1').click()
    await nextTick()
    expect(document.querySelector('.type-group')).toBeNull()
  })

  it('filters by the derived type and resets to All on every Teams-filter change', async () => {
    await mountList()
    byText('.seg-btn', '5v5').click()
    await nextTick()
    expect(cardNames()).toEqual(['Custom', 'S7 SL'])

    byText('.type-chip', 'SL').click()
    await nextTick()
    expect(byText('.type-chip', 'SL').classList.contains('active')).toBe(true)
    expect(cardNames()).toEqual(['S7 SL'])

    // 3v3 has its own types: the row stays, the selection does not.
    byText('.seg-btn', '3v3').click()
    await nextTick()
    expect(typeChips()).toEqual(['All', 'Default', 'GD'])
    expect(byText('.type-chip', 'All').classList.contains('active')).toBe(true)
    expect(cardNames()).toEqual(['S7 GD'])
  })

  it('labels cards with their derived type', async () => {
    await mountList()
    const chips = [...document.querySelectorAll('.team-card')].map((card) => {
      const name = card.querySelector('.team-name')?.textContent?.replace(/\s+/g, ' ').trim()
      const labels = [...card.querySelectorAll('.mode-chip')].map((chip) =>
        chip.textContent?.trim(),
      )
      return `${name}: ${labels.join(' ')}`
    })
    expect(chips.sort()).toEqual(['Custom: 5v5', 'S7 GD: 3v3 GD', 'S7 SL: 5v5 SL'])
  })
})

describe('SavedTeamsList hero search', () => {
  const searchInput = (): HTMLInputElement => document.querySelector('.search-input')!
  const options = (): string[] =>
    [...document.querySelectorAll('.hero-option')].map((el) => el.textContent?.trim() ?? '')
  const pills = (): string[] =>
    [...document.querySelectorAll('.hero-pill')].map((el) => el.textContent?.trim() ?? '')

  const typeText = async (text: string): Promise<void> => {
    const input = searchInput()
    input.value = text
    input.dispatchEvent(new Event('input'))
    await nextTick()
  }

  const press = async (key: string): Promise<void> => {
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }))
    await nextTick()
  }

  it('turns a listed hero into a pill on Enter and filters by every pill', async () => {
    await loadSkillLocale('en')
    await mountList(seedHeroes)
    searchInput().dispatchEvent(new FocusEvent('focus'))

    await typeText('rol')
    expect(options()).toEqual(['Rolan'])
    await press('Enter')
    expect(pills()).toEqual(['Rolan'])
    expect(searchInput().value).toBe('')
    expect(cardNames()).toEqual(['Duo', 'Solo'])

    // Aliceth is in the roster but on no team, so only Alsa is offered.
    await typeText('al')
    expect(options()).toEqual(['Alsa'])
    await press('Enter')
    expect(pills()).toEqual(['Rolan', 'Alsa'])
    expect(cardNames()).toEqual(['Duo'])

    await press('Backspace')
    expect(pills()).toEqual(['Rolan'])
    expect(cardNames()).toEqual(['Duo', 'Solo'])

    document.querySelector<HTMLButtonElement>('.search-clear')!.click()
    await nextTick()
    expect(pills()).toEqual([])
    expect(cardNames()).toEqual(['Alsa squad', 'Duo', 'Solo'])
  })
})
