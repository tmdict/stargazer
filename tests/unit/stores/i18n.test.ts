import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocaleDictionary } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { stubLocalStorage } from '../fixtures/storage'

const FIXTURE: LocaleDictionary = {
  greeting: {
    hello: { en: 'Hello, {name}!', zh: '你好，{name}！', ko: '안녕하세요, {name}!' },
    welcome: { en: 'Welcome', zh: '欢迎', ko: '환영합니다' },
  },
  partial: {
    // Translation exists in en but not in zh
    enOnly: { en: 'English only', zh: '', ko: '' },
  },
}

vi.mock('@/utils/dataLoader', () => ({
  loadAllLocales: () => FIXTURE,
}))

// The store reads/writes localStorage, the document's lang attributes, and
// window.location.search on creation. Stub minimal in-memory shims since the
// project runs unit tests in the node environment without jsdom.
function stubDomGlobals() {
  stubLocalStorage()
  vi.stubGlobal('window', { location: { search: '' } })
  vi.stubGlobal('document', { documentElement: { lang: '' }, body: { lang: '' } })
}

describe('i18nStore', () => {
  let store: ReturnType<typeof useI18nStore>

  beforeEach(() => {
    stubDomGlobals()
    setActivePinia(createPinia())
    store = useI18nStore()
    store.initialize()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('t() — fallbacks', () => {
    it('returns the key when category is missing', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(store.t('nonexistent.key')).toBe('nonexistent.key')
    })

    it('falls back to the key when the current locale has no translation', () => {
      store.setLocale('zh')
      expect(store.t('partial.enOnly')).toBe('partial.enOnly')
    })
  })

  describe('t() — interpolation', () => {
    it('substitutes vars when provided', () => {
      expect(store.t('greeting.hello', { name: 'World' })).toBe('Hello, World!')
    })

    it('leaves unmatched tokens in place', () => {
      expect(store.t('greeting.hello', { other: 'X' })).toBe('Hello, {name}!')
    })
  })

  describe('locale persistence', () => {
    beforeEach(() => {
      // The store's client-only branches (localStorage, document.lang) are
      // gated on import.meta.env.SSR, which is true under vitest's node env
      vi.stubEnv('SSR', false)
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('setLocale persists by default', () => {
      store.setLocale('zh')
      expect(localStorage.getItem('stargazer.locale')).toBe('zh')
    })

    it('a skill page keeps its text language while the app around it follows the site language', () => {
      store.setLocale('ko')
      const token = store.setHtmlLangOverride('ja')
      expect([document.documentElement.lang, document.body.lang]).toEqual(['ja', 'ko'])

      store.clearHtmlLangOverride(token)
      expect([document.documentElement.lang, document.body.lang]).toEqual(['ko', 'ko'])
    })

    it('setLocale with persist: false updates the render locale only', () => {
      store.setLocale('zh', { persist: false })
      expect(store.currentLocale).toBe('zh')
      expect(localStorage.getItem('stargazer.locale')).toBeNull()
    })

    it('initializeLocale applies the saved preference without re-persisting', () => {
      localStorage.setItem('stargazer.locale', 'zh')
      // The fixture's setItem is already a mock, so spyOn returns it with the
      // seeding call recorded; only calls after this point matter
      const spy = vi.spyOn(localStorage, 'setItem')
      spy.mockClear()

      store.initializeLocale()

      expect(store.currentLocale).toBe('zh')
      expect(spy).not.toHaveBeenCalled()
    })

    it('initializeLocale persists a valid ?l= param (external language-pinning contract)', () => {
      vi.stubGlobal('window', { location: { search: '?l=zh' } })

      store.initializeLocale()

      expect(store.currentLocale).toBe('zh')
      expect(localStorage.getItem('stargazer.locale')).toBe('zh')
    })

    it('initializeLocale lets ?l= override the saved preference', () => {
      localStorage.setItem('stargazer.locale', 'zh')
      vi.stubGlobal('window', { location: { search: '?l=en' } })

      store.initializeLocale()

      expect(store.currentLocale).toBe('en')
      expect(localStorage.getItem('stargazer.locale')).toBe('en')
    })

    it('initializeLocale ignores an invalid ?l= param', () => {
      vi.stubGlobal('window', { location: { search: '?l=fr' } })

      store.initializeLocale()

      expect(store.currentLocale).toBe('en')
      expect(localStorage.getItem('stargazer.locale')).toBeNull()
    })
  })
})
