import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

import type { Locale, LocaleDictionary } from '../lib/types/i18n'
import { loadAllLocales } from '../utils/dataLoader'

// Re-export types for convenience
export type { Locale, LocaleData, LocaleDictionary } from '../lib/types/i18n'

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref<Locale>('en')
  const translations = ref<LocaleDictionary>({})
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // Load saved locale from localStorage
  const savedLocale = localStorage.getItem('stargazer-locale')
  if (savedLocale === 'zh' || savedLocale === 'en') {
    currentLocale.value = savedLocale
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
    localStorage.setItem('stargazer-locale', locale)
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
    toggleLocale
  }
})