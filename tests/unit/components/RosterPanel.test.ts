// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import RosterPanel from '@/components/RosterPanel.vue'
import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

/* Select mode on the Rosters tab: which heroes a level chip reaches, and when
 * the ticks reset. Dragging across heroes: which heroes a stroke changes. */

// jsdom has neither; the level chips call both for the pill pulse.
beforeAll(() => {
  window.matchMedia ??= ((media: string) => ({
    matches: false,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never
  Element.prototype.animate ??= (() => ({})) as never
})

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  localStorage.clear()
})

const mountPanel = async (): Promise<ReturnType<typeof useRosters>> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const gameData = useGameDataStore()
  gameData.initializeContentData()
  const rosters = useRosters()
  // Every third hero is left out, so the grid mixes owned and unowned heroes.
  const ids = gameData.characters.filter((c) => !c.placeholder).map((c) => c.id)
  rosters.create()
  rosters.setHeroes(
    rosters.active!.id,
    Object.fromEntries(
      ids.flatMap((id, i) => (i % 3 === 2 ? [] : [[id, { [ATTR_PARAGON]: i % 5 }]])),
    ),
  )
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(RosterPanel, { scrollable: false }) })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return rosters
}

const button = (selector: string, label: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>(selector)].find(
    (el) => el.textContent?.trim() === label,
  )!

const heroIds = (): number[] => {
  const gameData = useGameDataStore()
  return [...document.querySelectorAll('.character-grid .portrait')].map(
    (img) => gameData.characters.find((c) => c.name === img.getAttribute('alt'))!.id,
  )
}

const tap = async (index: number, shiftKey = false): Promise<void> => {
  const portrait = document.querySelectorAll('.character-grid .character-display')[index]!
  portrait.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }))
  portrait.dispatchEvent(new MouseEvent('mouseup', { button: 0, shiftKey, bubbles: true }))
  await nextTick()
}

// Presses the first hero, crosses the others with the button held and
// releases on the last.
const drag = async (indices: number[]): Promise<void> => {
  const tiles = document.querySelectorAll('.character-grid .character-wrapper')
  const portrait = (index: number): Element => tiles[index]!.querySelector('.character-display')!
  portrait(indices[0]!).dispatchEvent(
    new MouseEvent('mousedown', { button: 0, buttons: 1, bubbles: true }),
  )
  for (const index of indices.slice(1))
    tiles[index]!.dispatchEvent(new MouseEvent('mouseenter', { buttons: 1 }))
  portrait(indices.at(-1)!).dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
  await nextTick()
}

const tickedCount = (): string =>
  document.querySelector('.tick-count')?.textContent?.trim() ?? 'not selecting'

describe('RosterPanel select mode', () => {
  it('sets a level on the ticked heroes only, with Shift ticking a range', async () => {
    const rosters = await mountPanel()
    const ids = heroIds()
    const before: Record<number, AttrRecord> = JSON.parse(JSON.stringify(rosters.active!.heroes))
    const owned = ids.flatMap((id, i) => (before[id] ? [i] : []))
    const unowned = ids.findIndex((id) => !before[id])

    button('.dock-chip', 'Select').click()
    await nextTick()
    await tap(owned[0]!)
    await tap(owned[2]!)
    await tap(owned[5]!, true)
    await tap(unowned)
    expect(tickedCount()).toBe('5 selected')

    button('.level-chip', 'P3').click()
    await nextTick()
    const ticked = [owned[0]!, ...owned.slice(2, 6)].map((i) => ids[i]!)
    const withTicked = (levels: AttrRecord): Record<number, AttrRecord> => ({
      ...before,
      ...Object.fromEntries(ticked.map((id) => [id, { ...before[id], ...levels }])),
    })
    expect(rosters.active!.heroes).toEqual(withTicked({ [ATTR_PARAGON]: 3 }))
    expect(button('.level-chip', 'P3').classList.contains('lit')).toBe(true)

    button('.level-chip', 'R2').click()
    await nextTick()
    expect(rosters.active!.heroes).toEqual(withTicked({ [ATTR_PARAGON]: 3, [ATTR_REFINEMENT]: 2 }))
  })

  it('clears the ticks on a filter change and stops selecting on a roster change', async () => {
    const rosters = await mountPanel()
    const firstRoster = rosters.active!.id
    button('.dock-chip', 'Select').click()
    await nextTick()
    await tap(0)
    await tap(1)
    expect(tickedCount()).toBe('2 selected')

    document.querySelector<HTMLButtonElement>('.icon-option:not(.clear-option)')!.click()
    await nextTick()
    expect(tickedCount()).toBe('0 selected')

    await tap(0)
    rosters.create()
    await nextTick()
    rosters.setActive(firstRoster)
    await nextTick()
    expect(tickedCount()).toBe('not selecting')
  })
})

describe('RosterPanel drag across heroes', () => {
  const split = (rosters: ReturnType<typeof useRosters>) => {
    const ids = heroIds()
    const before: Record<number, AttrRecord> = JSON.parse(JSON.stringify(rosters.active!.heroes))
    const owned = ids.flatMap((id, i) => (before[id] ? [i] : []))
    const unowned = ids.flatMap((id, i) => (before[id] ? [] : [i]))
    return { ids, before, owned, unowned }
  }

  it("gives every hero a stroke crosses the first hero's change", async () => {
    const rosters = await mountPanel()
    const { ids, before, owned, unowned } = split(rosters)

    await drag([unowned[0]!, owned[0]!, unowned[1]!])
    expect(rosters.active!.heroes).toEqual({
      ...before,
      [ids[unowned[0]!]!]: {},
      [ids[unowned[1]!]!]: {},
    })

    // Released back on the first hero, the stroke is not undone by a click.
    await drag([owned[1]!, owned[2]!, unowned[0]!, owned[1]!])
    const expected: Record<number, AttrRecord> = { ...before, [ids[unowned[1]!]!]: {} }
    delete expected[ids[owned[1]!]!]
    delete expected[ids[owned[2]!]!]
    expect(rosters.active!.heroes).toEqual(expected)
  })

  it('ticks only roster heroes while selecting, and a press on one hero stays a click', async () => {
    const rosters = await mountPanel()
    const { owned, unowned } = split(rosters)
    button('.dock-chip', 'Select').click()
    await nextTick()

    await drag([owned[0]!, unowned[0]!, owned[1]!, owned[2]!])
    expect(tickedCount()).toBe('3 selected')
    await drag([owned[1]!, owned[2]!])
    expect(tickedCount()).toBe('1 selected')
    await drag([unowned[0]!, owned[3]!])
    expect(tickedCount()).toBe('1 selected')
    await tap(owned[3]!)
    expect(tickedCount()).toBe('2 selected')
  })
})
