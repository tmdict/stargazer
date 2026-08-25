// @vitest-environment jsdom
import { createApp, defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubLocalStorage } from '../fixtures/storage'

/* Storage seeding, hydration-safe adoption, the enable cascades, and the
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

  it('seeds the pref key with the defaults on first run', async () => {
    const { useGridInfoPrefs } = await importComposable()

    const { prefs } = useGridInfoPrefs()

    expect(JSON.parse(storage.get(PREFS_KEY)!)).toEqual({
      gridInfo: {
        master: false,
        tileIds: true,
        hover: true,
        heroCard: false,
        paragon: false,
        targeting: false,
        coordinates: false,
      },
    })
    expect(prefs.master).toBe(false)
    expect(prefs.tileIds).toBe(true)
  })

  it('reseeds a corrupt stored object with the defaults', async () => {
    storage.set(PREFS_KEY, 'not-json')
    const { useGridInfoPrefs } = await importComposable()

    useGridInfoPrefs()

    expect(JSON.parse(storage.get(PREFS_KEY)!).gridInfo.tileIds).toBe(true)
  })

  it('keeps the defaults until a component mounts, then adopts stored booleans only', async () => {
    storage.set(
      PREFS_KEY,
      JSON.stringify({ gridInfo: { master: true, tileIds: false, paragon: 'yes' } }),
    )
    const mod = await importComposable()

    // Pre-mount (the SSG-prerendered markup's state): defaults.
    const direct = mod.useGridInfoPrefs()
    expect(direct.prefs.master).toBe(false)

    const { prefs } = mountPrefs(mod)
    expect(prefs.master).toBe(true)
    expect(prefs.tileIds).toBe(false)
    expect(prefs.paragon).toBe(false) // non-boolean ignored
    expect(prefs.hover).toBe(true) // absent key keeps its default
  })

  it('enable cascades run upward; disabling never cascades', async () => {
    const { useGridInfoPrefs } = await importComposable()
    const { prefs, setPref } = useGridInfoPrefs()

    setPref('paragon', true)
    expect(prefs.heroCard).toBe(true)
    expect(prefs.master).toBe(true)

    setPref('coordinates', true)
    expect(prefs.tileIds).toBe(true)

    setPref('master', false)
    expect(prefs.paragon).toBe(true)
    expect(prefs.heroCard).toBe(true)

    setPref('heroCard', false)
    expect(prefs.master).toBe(false)
    expect(prefs.paragon).toBe(true)
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

describe('deriveGridInfoView', () => {
  it('ANDs the master and structural parents into every surface', async () => {
    const { deriveGridInfoView } = await importComposable()
    const allOn = {
      master: true,
      tileIds: true,
      hover: true,
      heroCard: true,
      paragon: true,
      targeting: true,
      coordinates: true,
    }

    expect(deriveGridInfoView(allOn)).toEqual({
      tileIds: true,
      coordinates: true,
      hover: true,
      heroCard: true,
      paragon: true,
      targeting: true,
    })
    const masterOff = deriveGridInfoView({ ...allOn, master: false })
    expect(Object.values(masterOff).every((v) => v === false)).toBe(true)
    expect(deriveGridInfoView({ ...allOn, heroCard: false }).paragon).toBe(false)
    expect(deriveGridInfoView({ ...allOn, tileIds: false }).coordinates).toBe(false)
    expect(deriveGridInfoView({ ...allOn, tileIds: false }).targeting).toBe(true)
  })
})
