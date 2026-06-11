import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { Locale, LocaleDictionary } from '@/lib/types/i18n'
import { loadAllLocales } from '@/utils/dataLoader'
import { interpolate } from '@/utils/interpolate'

// Constants
const LOCALE_STORAGE_KEY = 'stargazer.locale'
const VALID_LOCALES = ['en', 'zh']

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref<Locale>('en')
  const translations = ref<LocaleDictionary>({})
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // Actions (defined early for use in initialization)
  /**
   * Sets the application locale.
   *
   * This method is SSR-safe and automatically detects the environment:
   * - During SSG/SSR: Only updates the reactive locale value
   * - On client: Also updates document.lang and persists to localStorage.
   *   Pass persist: false for URL-derived locales (locale-prefixed routes):
   *   they are display-only and must not overwrite the user's saved choice.
   *
   * @param locale - The locale to set ('en' or 'zh')
   */
  const setLocale = (locale: Locale, { persist = true }: { persist?: boolean } = {}) => {
    currentLocale.value = locale

    // Only access DOM/localStorage on client
    if (!import.meta.env.SSR) {
      document.documentElement.lang = locale

      if (persist) {
        // Try to persist to localStorage, but don't fail if it's not available
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, locale)
        } catch (e) {
          console.warn('Could not save locale preference to localStorage:', e)
        }
      }
    }
  }

  // Apply the saved locale, then the `?l=` query param. Called from App.vue
  // after mount, and only on unprefixed routes: the unprefixed shells are
  // pre-rendered in English, so applying the saved locale before hydration
  // would mismatch the baked HTML, and locale-prefixed routes are already
  // language-pinned by the path.
  const initializeLocale = () => {
    // Guard against non-client callers
    if (import.meta.env.SSR) {
      return
    }

    // Load saved locale from localStorage with error handling
    try {
      const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (savedLocale && VALID_LOCALES.includes(savedLocale)) {
        currentLocale.value = savedLocale as Locale
      }
    } catch (e) {
      // If localStorage is not available (private browsing, disabled, etc.),
      // fallback to default 'en'
      console.warn('Could not access localStorage for locale preference:', e)
      currentLocale.value = 'en'
    }

    // `?l=` is an intentional external contract: a shared link like `/?l=zh`
    // pins the app language for the recipient and persists it as their saved
    // preference.
    const urlParams = new URLSearchParams(window.location.search)
    const localeParam = urlParams.get('l')
    if (localeParam && VALID_LOCALES.includes(localeParam)) {
      setLocale(localeParam as Locale)
    } else {
      // Set the HTML lang attribute for the initial locale
      document.documentElement.lang = currentLocale.value
    }
  }

  // Getters
  const t = computed(() => {
    return (key: string, vars?: Record<string, string | number>): string => {
      // Split key into category and name (e.g., "app.characters" -> ["app", "characters"])
      const parts = key.split('.')

      if (parts.length !== 2) {
        console.warn(`Invalid translation key format: ${key}`)
        return key
      }

      const [category, name] = parts
      if (!category || !name) {
        console.warn('i18n: Invalid translation key parts', { key, category, name })
        return key
      }

      const categoryTranslations = translations.value[category]

      if (!categoryTranslations) {
        if (loaded.value) {
          console.warn(`Translation category not found: ${category}`)
        }
        return key
      }

      const translation = categoryTranslations[name]

      if (!translation) {
        if (loaded.value) {
          console.warn(`Translation not found: ${key}`)
        }
        return key
      }

      const text = translation[currentLocale.value] || key
      return vars ? interpolate(text, vars) : text
    }
  })

  // Actions
  const initialize = () => {
    if (loaded.value) {
      return
    }

    try {
      translations.value = loadAllLocales()
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load translations'
      console.error('Failed to initialize i18n:', e)
    }
  }

  const toggleLocale = () => {
    const newLocale = currentLocale.value === 'en' ? 'zh' : 'en'
    setLocale(newLocale)
  }

  return {
    // State (readonly through refs)
    currentLocale,
    loaded,
    error,

    // Getters
    t,

    // Actions
    initialize,
    initializeLocale,
    setLocale,
    toggleLocale,
  }
})
