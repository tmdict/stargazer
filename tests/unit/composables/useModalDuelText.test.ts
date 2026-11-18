import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useModalDuelText } from '@/composables/useDuelText'
import { loadHonorDuelText } from '@/lib/hd/catalog'
import type { HonorDuelText } from '@/lib/types/honorDuel'
import type { SkillLocale } from '@/lib/types/i18n'

// The real loader fails only when a download does, which a test cannot bring
// about, so its answers are given here.
vi.mock('@/lib/hd/catalog', () => ({ loadHonorDuelText: vi.fn() }))
const load = vi.mocked(loadHonorDuelText)

const text: HonorDuelText = { equipment: {}, artifacts: {}, creatures: {} }

// The watcher runs first, then the loader's answer arrives.
const settle = async (): Promise<void> => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

const popup = (lang: SkillLocale) => {
  const show = ref(true)
  const applied = ref<SkillLocale | null>(lang)
  const state = effectScope().run(() => useModalDuelText(() => show.value, applied))!
  return { show, applied, ...state }
}

describe('useModalDuelText', () => {
  beforeEach(() => load.mockReset())

  it('reports a failed download, and asks again when the popup next opens', async () => {
    load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(text)
    const { show, loaded, failed } = popup('en')
    await settle()
    expect(failed.value).toBe(true)
    expect(loaded.value).toBeNull()

    show.value = false
    await settle()
    show.value = true
    await settle()
    expect(failed.value).toBe(false)
    expect(loaded.value).toEqual({ lang: 'en', text })
  })

  it('takes a language the pack holds no text for as loaded, not failed', async () => {
    load.mockResolvedValueOnce(null)
    const { loaded, failed } = popup('ja')
    await settle()
    expect(failed.value).toBe(false)
    expect(loaded.value).toEqual({ lang: 'ja', text: null })
  })

  it('ignores a failure that arrives after the popup moved to another language', async () => {
    let failEnglish = (): void => {}
    load
      .mockReturnValueOnce(new Promise((_, reject) => (failEnglish = () => reject(new Error()))))
      .mockResolvedValueOnce(text)
    const { applied, loaded, failed } = popup('en')
    await settle()
    applied.value = 'ja'
    await settle()
    failEnglish()
    await settle()
    expect(failed.value).toBe(false)
    expect(loaded.value).toEqual({ lang: 'ja', text })
  })
})
