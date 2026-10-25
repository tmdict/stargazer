// @vitest-environment jsdom
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import RosterImportReview from '@/components/RosterImportReview.vue'
import type { RosterImportShot } from '@/composables/useRosterImport'
import type { HeroReading } from '@/lib/import/card/types'
import type { RosterCard, RosterImportPlan } from '@/lib/rosterImport'
import { useI18nStore } from '@/stores/i18n'

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

const card = (shotId: string, key: string): RosterCard => ({
  shotId,
  key,
  cell: { candidates: [] } as unknown as HeroReading,
  characterId: 5,
  paragon: 4,
  refinement: 4,
  state: 'sure',
  doubtful: [],
  edited: false,
})

const planOf = (cards: RosterCard[]): RosterImportPlan => ({
  entries: [{ characterId: 5, cards, paragon: 4, refinement: 4, issues: [], check: false }],
  confirmable: [],
  unnamed: [],
  heroes: {},
  blocked: false,
})

const shots = [
  { id: 'a', name: 'a.png', cards: {} },
  { id: 'b', name: 'b.png', cards: {} },
] as unknown as RosterImportShot[]

describe('the roster review', () => {
  // A hero's cell is drawn from its first card, and an earlier screenshot that
  // finishes reading later puts its card first.
  it('keeps the hero picker open when a screenshot read meanwhile puts a card ahead of it', async () => {
    setActivePinia(createPinia())
    useI18nStore().initialize()
    const plan = ref(planOf([card('b', 'r1c1')]))
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({ render: () => h(RosterImportReview, { plan: plan.value, shots }) })
    app.mount(host)
    teardown = () => {
      app.unmount()
      host.remove()
    }

    document.querySelector<HTMLButtonElement>('.cell-name')!.click()
    await nextTick()
    expect(document.querySelector('.selection-popup')).not.toBeNull()

    plan.value = planOf([card('a', 'r2c3'), card('b', 'r1c1')])
    await nextTick()
    expect(document.querySelector('.selection-popup')).not.toBeNull()
  })
})
