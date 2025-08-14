import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

import type { Locale, LocaleDictionary } from '../lib/types/i18n'
import { loadAllLocales } from '../utils/dataLoader'

// Re-export types for convenience
export type { Locale, LocaleData, LocaleDictionary } from '../lib/types/i18n'

// Constants
const LOCALE_STORAGE_KEY = 'stargazer.locale' as const

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref<Locale>('en')
  const translations = ref<LocaleDictionary>({})
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // Load saved locale from localStorage with error handling
  try {
    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (savedLocale === 'zh' || savedLocale === 'en') {
      currentLocale.value = savedLocale
    }
  } catch (e) {
    // If localStorage is not available (private browsing, disabled, etc.),
    // fallback to default 'en'
    console.warn('Could not access localStorage for locale preference:', e)
    currentLocale.value = 'en'
  }

  // Getters
  const t = computed(() => {
    return (key: string): string => {
      // Split key into category and name (e.g., "app.characters" -> ["app", "characters"])
      const parts = key.split('.')

      if (parts.length !== 2) {
        console.warn(`Invalid translation key format: ${key}`)
        return key
      }

      const [category, name] = parts
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

      return translation[currentLocale.value] || key
    }
  })

  const hasTranslation = computed(() => {
    return (key: string): boolean => {
      const parts = key.split('.')

      if (parts.length !== 2) {
        return false
      }

      const [category, name] = parts
      const categoryTranslations = translations.value[category]

      return !!(
        categoryTranslations &&
        categoryTranslations[name] &&
        categoryTranslations[name][currentLocale.value]
      )
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

      // Set HTML lang attribute
      document.documentElement.lang = currentLocale.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load translations'
      console.error('Failed to initialize i18n:', e)
    }
  }

  const setLocale = (locale: Locale) => {
    currentLocale.value = locale

    // Try to persist to localStorage, but don't fail if it's not available
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch (e) {
      console.warn('Could not save locale preference to localStorage:', e)
    }

    document.documentElement.lang = locale
  }

  const toggleLocale = () => {
    const newLocale = currentLocale.value === 'en' ? 'zh' : 'en'
    setLocale(newLocale)
  }

  // Watch for locale changes to update HTML lang attribute
  watch(currentLocale, (newLocale) => {
    document.documentElement.lang = newLocale
  })

  return {
    // State (readonly through refs)
    currentLocale,
    loaded,
    error,

    // Getters
    t,
    hasTranslation,

    // Actions
    initialize,
    setLocale,
    toggleLocale,
  }
})
