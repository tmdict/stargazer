// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import SavedTeamsList from '@/components/teams/SavedTeamsList.vue'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { canonicalTeamData } from '@/lib/teams/savedTeam'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

/* The type filter row: offered only for a board count with named types,
 * reset to All on every change of the Teams filter, and classifying records
 * by their maps. */

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  localStorage.clear()
})

const record = (maps: readonly string[], mode: string): string =>
  canonicalTeamData(encodeMultiGridStateToUrl({ boards: maps.map((m) => ({ m })), mode }))!

const mountList = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const library = useTeamLibrary()
  library.saveAsNew('5v5', record(TEAM_VARIANTS.sl.maps, '5v5'), 'S7 SL')
  library.saveAsNew(
    '5v5',
    record(['arena1', 'arena3', 'arena1', 'arena1', 'arena1'], '5v5'),
    'Custom',
  )
  library.saveAsNew('3v3', record(TEAM_VARIANTS.gd.maps, '3v3'), 'S7 GD')
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
