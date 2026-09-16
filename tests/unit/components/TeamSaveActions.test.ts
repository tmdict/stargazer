// @vitest-environment jsdom
import { createApp, h, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamSaveActions from '@/components/teams/TeamSaveActions.vue'
import type { TeamModeKey, VariantMatch } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

/* New's two-step confirm must belong to the boards it was armed for: a mode
 * switch, a type switch, or a Load inside the window replaces them, and the
 * next click must only arm again. */

interface ActionsState {
  hasSource: boolean
  suggestedName: string
  activeMode: TeamModeKey
  variant: VariantMatch
  sourceId: string | null
}

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

const mountActions = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const state = reactive<ActionsState>({
    hasSource: false,
    suggestedName: 'Team 1',
    activeMode: '5v5',
    variant: 'sl',
    sourceId: null,
  })
  const newTeam = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () => h(TeamSaveActions, { ...state, onNewTeam: newTeam }),
  })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return { state, newTeam }
}

const newButton = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>('.control-btn.danger')!

describe('TeamSaveActions New confirm', () => {
  it('arms on the first click and fires on the second', async () => {
    const { newTeam } = await mountActions()
    newButton().click()
    await nextTick()
    expect(newTeam).not.toHaveBeenCalled()
    expect(newButton().classList.contains('armed')).toBe(true)
    newButton().click()
    expect(newTeam).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a mode switch', (state: ActionsState) => void (state.activeMode = '3v3')],
    ['a type switch', (state: ActionsState) => void (state.variant = 'default')],
    ['a Load', (state: ActionsState) => void (state.sourceId = 'team-1')],
  ])('disarms when %s replaces the boards', async (_label, replace) => {
    const { state, newTeam } = await mountActions()
    newButton().click()
    await nextTick()
    expect(newButton().classList.contains('armed')).toBe(true)

    replace(state)
    await nextTick()
    expect(newButton().classList.contains('armed')).toBe(false)

    newButton().click()
    await nextTick()
    expect(newTeam).not.toHaveBeenCalled()
    expect(newButton().classList.contains('armed')).toBe(true)
  })
})
