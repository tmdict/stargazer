// @vitest-environment jsdom
import { createApp, h, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import type { TeamModeKey, TeamVariantChoice, VariantMatch } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

/* The type picker's two-step confirm must belong to the boards it was armed
 * for: a mode switch or a Load inside the confirm window replaces them, and
 * the second click must then only arm again. */

interface PickerState {
  activeMode: TeamModeKey
  match: VariantMatch
  sourceId: string | null
  wouldReplace: boolean
}

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  vi.useRealTimers()
})

const mountPicker = async (overrides: Partial<PickerState> = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const state = reactive<PickerState>({
    activeMode: '5v5',
    match: 'sl',
    sourceId: null,
    wouldReplace: true,
    ...overrides,
  })
  const selected = vi.fn<(choice: TeamVariantChoice) => void>()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () => h(TeamVariantPicker, { ...state, onSelectVariant: selected }),
  })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return { state, selected }
}

const segment = (label: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('.variant-seg')].find(
    (button) => button.textContent?.trim() === label,
  )!

describe('TeamVariantPicker', () => {
  it('arms on populated boards and switches on the second click', async () => {
    const { selected } = await mountPicker()
    expect(segment('SL').classList.contains('active')).toBe(true)

    segment('Default').click()
    await nextTick()
    expect(selected).not.toHaveBeenCalled()
    expect(segment('Confirm?').classList.contains('armed')).toBe(true)

    segment('Confirm?').click()
    expect(selected).toHaveBeenCalledWith('default')
  })

  it('switches in one click when the boards hold nothing', async () => {
    const { selected } = await mountPicker({ wouldReplace: false })
    segment('Default').click()
    expect(selected).toHaveBeenCalledWith('default')
  })

  it('ignores a click on the lit type', async () => {
    const { selected } = await mountPicker()
    segment('SL').click()
    await nextTick()
    expect(selected).not.toHaveBeenCalled()
    expect(document.querySelector('.armed')).toBeNull()
  })

  it('an armed click does not carry into another mode', async () => {
    vi.useFakeTimers()
    const { state, selected } = await mountPicker()
    segment('Default').click()
    await nextTick()
    expect(segment('Confirm?')).toBeDefined()

    // A mode switch replaces the boards inside the confirm window.
    state.activeMode = '3v3'
    state.match = 'gd'
    await nextTick()
    expect(document.querySelector('.armed')).toBeNull()

    segment('Default').click()
    await nextTick()
    expect(selected).not.toHaveBeenCalled()
    expect(segment('Confirm?').classList.contains('armed')).toBe(true)
    segment('Confirm?').click()
    expect(selected).toHaveBeenCalledTimes(1)
    expect(selected).toHaveBeenCalledWith('default')
  })

  it('a Load between arm and confirm disarms', async () => {
    const { state, selected } = await mountPicker()
    segment('Default').click()
    await nextTick()
    expect(segment('Confirm?')).toBeDefined()

    state.sourceId = 'team-1'
    await nextTick()
    expect(document.querySelector('.armed')).toBeNull()
    segment('Default').click()
    await nextTick()
    expect(selected).not.toHaveBeenCalled()
  })

  it('expires an unconfirmed click', async () => {
    vi.useFakeTimers()
    const { selected } = await mountPicker()
    segment('Default').click()
    await nextTick()
    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(document.querySelector('.armed')).toBeNull()
    segment('Default').click()
    expect(selected).not.toHaveBeenCalled()
  })

  it('is hidden for a mode without named types', async () => {
    await mountPicker({ activeMode: '1v1', match: 'default' })
    expect(document.querySelector('.variant-picker')).toBeNull()
  })
})
