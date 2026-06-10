import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocaleDictionary } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

const FIXTURE: LocaleDictionary = {
  app: {
    title: { en: 'Stargazer', zh: '观星者' },
  },
  greeting: {
    hello: { en: 'Hello, {name}!', zh: '你好，{name}！' },
    welcome: { en: 'Welcome', zh: '欢迎' },
  },
  partial: {
    // Translation exists in en but not in zh
    enOnly: { en: 'English only', zh: '' },
  },
}

vi.mock('@/utils/dataLoader', () => ({
  loadAllLocales: () => FIXTURE,
}))

// The store reads/writes localStorage, document.documentElement.lang, and
// window.location.search on creation. Stub minimal in-memory shims since the
// project runs unit tests in the node environment without jsdom.
function stubDomGlobals() {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  vi.stubGlobal('window', { location: { search: '' } })
  vi.stubGlobal('document', { documentElement: { lang: '' } })
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

  describe('t() — happy path', () => {
    it('returns translation in current locale (en)', () => {
      expect(store.t('app.title')).toBe('Stargazer')
    })

    it('returns translation in zh after toggleLocale', () => {
      store.toggleLocale()
      expect(store.currentLocale).toBe('zh')
      expect(store.t('app.title')).toBe('观星者')
    })

    it('returns translation in zh after explicit setLocale', () => {
      store.setLocale('zh')
      expect(store.t('greeting.welcome')).toBe('欢迎')
    })
  })

  describe('t() — fallbacks', () => {
    it('returns the key when category is missing', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(store.t('nonexistent.key')).toBe('nonexistent.key')
    })

    it('returns the key when name is missing in category', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(store.t('app.missing')).toBe('app.missing')
    })

    it('falls back to the key when the current locale has no translation', () => {
      store.setLocale('zh')
      expect(store.t('partial.enOnly')).toBe('partial.enOnly')
    })

    it('returns the key for invalid format (no dot)', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(store.t('invalid')).toBe('invalid')
    })

    it('returns the key for invalid format (multiple dots)', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(store.t('a.b.c')).toBe('a.b.c')
    })
  })

  describe('t() — interpolation', () => {
    it('substitutes vars when provided', () => {
      expect(store.t('greeting.hello', { name: 'World' })).toBe('Hello, World!')
    })

    it('leaves the raw text unchanged when no vars are passed', () => {
      expect(store.t('greeting.hello')).toBe('Hello, {name}!')
    })

    it('leaves unmatched tokens in place', () => {
      expect(store.t('greeting.hello', { other: 'X' })).toBe('Hello, {name}!')
    })
  })

  describe('toggleLocale', () => {
    it('swaps en ↔ zh', () => {
      expect(store.currentLocale).toBe('en')
      store.toggleLocale()
      expect(store.currentLocale).toBe('zh')
      store.toggleLocale()
      expect(store.currentLocale).toBe('en')
    })
  })
})
