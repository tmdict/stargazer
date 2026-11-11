// @vitest-environment jsdom
import { createApp, defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubLocalStorage } from '../fixtures/storage'

/* Storage seeding, hydration-safe adoption, and the
 * sibling-slice contract of stargazer.prefs. The composable is a module
 * singleton, so every test re-imports it through vi.resetModules. */

const PREFS_KEY = 'stargazer.prefs'

let storage: Map<string, string>

const importComposable = async () => await import('@/composables/useGridInfoPrefs')

type Composable = Awaited<ReturnType<typeof importComposable>>

// Mounts a throwaway component so onMounted adoption runs (synchronous tree:
// hooks flush before mount() returns).
const mountPrefs = (mod: Composable) => {
  let result!: ReturnType<Composable['useGridInfoPrefs']>
  const app = createApp(
    defineComponent({
      setup() {
        result = mod.useGridInfoPrefs()
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
  return result
}

describe('useGridInfoPrefs', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('SSR', false)
    ;({ storage } = stubLocalStorage())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('reseeds a corrupt stored object with the defaults', async () => {
    storage.set(PREFS_KEY, 'not-json')
    const { useGridInfoPrefs } = await importComposable()

    useGridInfoPrefs()

    expect(JSON.parse(storage.get(PREFS_KEY)!).gridInfo.tileIds).toBe(true)
  })

  it('seeds the defaults beside a stored theme', async () => {
    storage.set(PREFS_KEY, JSON.stringify({ theme: 'dark' }))
    const { useGridInfoPrefs } = await importComposable()

    useGridInfoPrefs()

    const stored = JSON.parse(storage.get(PREFS_KEY)!)
    expect(stored.theme).toBe('dark')
    expect(stored.gridInfo.tileIds).toBe(true)
  })

  it('keeps the defaults until a component mounts, then adopts stored booleans only', async () => {
    storage.set(
      PREFS_KEY,
      JSON.stringify({ gridInfo: { master: true, tileIds: false, upgrades: 'yes' } }),
    )
    const mod = await importComposable()

    // Pre-mount (the SSG-prerendered markup's state): defaults.
    const direct = mod.useGridInfoPrefs()
    expect(direct.prefs.master).toBe(false)

    const { prefs } = mountPrefs(mod)
    expect(prefs.master).toBe(true)
    expect(prefs.tileIds).toBe(false)
    expect(prefs.upgrades).toBe(false) // non-boolean ignored
    expect(prefs.rules).toBe(true) // absent key keeps its default
  })

  it('reads a stored pair of Details on hover and Placement tips as Details alone', async () => {
    storage.set(PREFS_KEY, JSON.stringify({ gridInfo: { hover: true, rules: true } }))
    const mod = await importComposable()
    const { prefs } = mountPrefs(mod)
    expect(prefs.hover).toBe(true)
    expect(prefs.rules).toBe(false)
  })

  it('persists the slice while preserving sibling slices of stargazer.prefs', async () => {
    const { useGridInfoPrefs } = await importComposable()
    const { setPref } = useGridInfoPrefs()
    storage.set(PREFS_KEY, JSON.stringify({ other: { keep: 1 }, gridInfo: {} }))

    setPref('targeting', true)

    const stored = JSON.parse(storage.get(PREFS_KEY)!)
    expect(stored.other).toEqual({ keep: 1 })
    expect(stored.gridInfo.targeting).toBe(true)
    expect(stored.gridInfo.master).toBe(true)
  })
})
