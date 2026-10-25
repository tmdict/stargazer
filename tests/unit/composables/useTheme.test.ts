// @vitest-environment jsdom
import { createApp, defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubLocalStorage } from '../fixtures/storage'

/* The stored choice beside Grid Info's field of stargazer.prefs, and another
 * tab's choice reaching this one. */

const PREFS_KEY = 'stargazer.prefs'

let storage: Map<string, string>

const mountTheme = async () => {
  const { useTheme } = await import('@/composables/useTheme')
  let result!: ReturnType<typeof useTheme>
  createApp(
    defineComponent({
      setup() {
        result = useTheme()
        return () => h('div')
      },
    }),
  ).mount(document.createElement('div'))
  return result
}

const look = () => document.documentElement.getAttribute('data-theme')

const writeFromOtherTab = (value: string): void => {
  storage.set(PREFS_KEY, value)
  window.dispatchEvent(new StorageEvent('storage', { key: PREFS_KEY }))
}

describe('useTheme', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('SSR', false)
    ;({ storage } = stubLocalStorage())
    document.documentElement.setAttribute('data-theme', 'light')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('stores the choice and keeps the Grid Info field', async () => {
    storage.set(PREFS_KEY, JSON.stringify({ gridInfo: { master: true } }))
    const { toggle } = await mountTheme()

    toggle()

    expect(look()).toBe('dark')
    expect(JSON.parse(storage.get(PREFS_KEY)!)).toEqual({
      gridInfo: { master: true },
      theme: 'dark',
    })
  })

  it("follows another tab's choice, reading anything but dark as light", async () => {
    const { theme } = await mountTheme()

    writeFromOtherTab(JSON.stringify({ theme: 'dark' }))
    expect(look()).toBe('dark')
    expect(theme.value).toBe('dark')

    writeFromOtherTab(JSON.stringify({ theme: 'blue' }))
    expect(look()).toBe('light')
  })
})
