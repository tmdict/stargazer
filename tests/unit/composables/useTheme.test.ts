// @vitest-environment jsdom
import { createApp, defineComponent, h, type App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubLocalStorage } from '../fixtures/storage'

/* The stored choice beside Grid Info's field of stargazer.prefs, another
 * tab's choice reaching this one, and the device deciding while nothing is
 * stored. */

const PREFS_KEY = 'stargazer.prefs'

let storage: Map<string, string>
let app: App | undefined

// The device's light or dark setting; jsdom has no matchMedia.
const device = {
  matches: false,
  listeners: new Set<() => void>(),
  set(dark: boolean) {
    this.matches = dark
    this.listeners.forEach((listener) => listener())
  },
}

const mountTheme = async () => {
  const { useTheme } = await import('@/composables/useTheme')
  let result!: ReturnType<typeof useTheme>
  app = createApp(
    defineComponent({
      setup() {
        result = useTheme()
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
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
    device.matches = false
    device.listeners.clear()
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return device.matches
      },
      addEventListener: (_: string, listener: () => void) => device.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => device.listeners.delete(listener),
    }))
    document.documentElement.setAttribute('data-theme', 'light')
  })

  // Unmounting removes the window listener, so an earlier test's module
  // never answers a later test's storage event.
  afterEach(() => {
    app?.unmount()
    app = undefined
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

  it("follows another tab's choice, and the device when the value is not a look", async () => {
    device.matches = true
    const { theme } = await mountTheme()

    writeFromOtherTab(JSON.stringify({ theme: 'light' }))
    expect(look()).toBe('light')
    expect(theme.value).toBe('light')

    writeFromOtherTab(JSON.stringify({ theme: 'blue' }))
    expect(look()).toBe('dark')
  })

  it('keeps the pressed look when storage is unavailable', async () => {
    const { toggle } = await mountTheme()
    vi.stubGlobal('localStorage', undefined)

    toggle()
    device.set(false)

    expect(look()).toBe('dark')
  })

  it('follows the device until the button is pressed', async () => {
    const { toggle } = await mountTheme()

    device.set(true)
    expect(look()).toBe('dark')

    toggle()
    device.set(false)
    device.set(true)
    expect(look()).toBe('light')
  })
})
