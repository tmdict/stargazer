// @vitest-environment jsdom
import { createApp, defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMechanicsExpanded } from '@/composables/useMechanicsExpanded'
import { stubLocalStorage } from '../fixtures/storage'

const EXPANDED_KEY = 'stargazer.tags.expanded'

describe('useMechanicsExpanded', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('adopts a stored "0" once mounted, then writes "1" or "0"', () => {
    vi.stubEnv('SSR', false)
    const { storage } = stubLocalStorage()
    storage.set(EXPANDED_KEY, '0')

    // onMounted flushes before mount() returns.
    let atSetup!: boolean
    let state!: ReturnType<typeof useMechanicsExpanded>
    createApp(
      defineComponent({
        setup() {
          state = useMechanicsExpanded()
          atSetup = state.expanded.value
          return () => h('div')
        },
      }),
    ).mount(document.createElement('div'))

    expect(atSetup).toBe(true)
    expect(state.expanded.value).toBe(false)

    state.setExpanded(true)
    expect(storage.get(EXPANDED_KEY)).toBe('1')
    state.setExpanded(false)
    expect(storage.get(EXPANDED_KEY)).toBe('0')
  })
})
