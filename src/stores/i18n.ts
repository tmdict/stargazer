import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  isAppLocale,
  isSkillLocale,
  type AppLocale,
  type LocaleDictionary,
  type SkillLocale,
} from '@/lib/types/i18n'
import { loadAllLocales } from '@/utils/dataLoader'
import { interpolate } from '@/utils/interpolate'
import { removeStorage } from '@/utils/storage'

// Constants
const LOCALE_STORAGE_KEY = 'stargazer.locale'
const SKILL_LOCALE_STORAGE_KEY = 'stargazer.skillLocale'

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref<AppLocale>('en')
  // The user's saved pick, known once initializeLocale has read it.
  const savedLocale = ref<AppLocale | null>(null)
  const translations = ref<LocaleDictionary>({})
  const loaded = ref(false)
  const error = ref<string | null>(null)

  // Saved skill-text preference; null = follow the app locale. Written only by
  // explicit globe picks (URL visits never persist, mirroring the chrome
  // prefix contract) and dropped by the next site-language pick.
  const skillLocale = ref<SkillLocale | null>(null)

  // On skill routes the content locale owns <html lang> (the page is mostly
  // skill text), overriding the chrome locale that setLocale would write.
  // Owner-token clearing survives keyed remounts in either mount/unmount
  // order: only the latest setter's token can clear.
  const htmlLangOverride = ref<SkillLocale | null>(null)
  let htmlLangOwner: symbol | null = null

  // <html lang> is the page's language, for the head and for crawlers; <body
  // lang> is the app's, so whatever the app draws, wherever it is mounted,
  // reads as the chrome locale unless it declares another language itself.
  const applyDocumentLang = () => {
    if (import.meta.env.SSR) return
    document.documentElement.lang = htmlLangOverride.value ?? currentLocale.value
    document.body.lang = currentLocale.value
  }

  const setHtmlLangOverride = (locale: SkillLocale): symbol => {
    const token = Symbol('htmlLang')
    htmlLangOwner = token
    htmlLangOverride.value = locale
    applyDocumentLang()
    return token
  }

  const clearHtmlLangOverride = (token: symbol) => {
    if (htmlLangOwner !== token) return
    htmlLangOwner = null
    htmlLangOverride.value = null
    applyDocumentLang()
  }

  // Actions (defined early for use in initialization)
  /**
   * Sets the application locale.
   *
   * This method is SSR-safe and automatically detects the environment:
   * - During SSG/SSR: Only updates the reactive locale value
   * - On client: Also updates document.lang and persists to localStorage.
   *   Pass persist: false for URL-derived locales (locale-prefixed routes):
   *   they are display-only and must not overwrite the user's saved choice.
   */
  const setLocale = (locale: AppLocale, { persist = true }: { persist?: boolean } = {}) => {
    currentLocale.value = locale
    if (persist) savedLocale.value = locale

    // Only access DOM/localStorage on client
    if (!import.meta.env.SSR) {
      applyDocumentLang()

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

  // Reads the saved locale, then the `?l=` query param where `readQuery`
  // allows it. Called after mount: the pages are pre-rendered without a saved
  // locale, so an earlier read would mismatch the baked HTML.
  const initializeLocale = ({ readQuery }: { readQuery: boolean }) => {
    if (import.meta.env.SSR) return

    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (saved && isAppLocale(saved)) savedLocale.value = saved
    } catch (e) {
      console.warn('Could not access localStorage for locale preference:', e)
    }

    if (!readQuery) return
    // `?l=` is an intentional external contract: a shared link like `/?l=zh`
    // pins the app language for the recipient and persists it as their saved
    // preference.
    const localeParam = new URLSearchParams(window.location.search).get('l')
    if (localeParam && isAppLocale(localeParam)) setLocale(localeParam)
  }

  // Sets the site language for an address whose prefix is `locale`. A page
  // written in that language (`pins`) shows in it; elsewhere the saved pick
  // comes first.
  const applyAddressLocale = (locale: AppLocale | null, { pins }: { pins: boolean }) => {
    const next = pins ? (locale ?? savedLocale.value) : (savedLocale.value ?? locale)
    setLocale(next ?? currentLocale.value, { persist: false })
  }

  // Read post-mount (like initializeLocale) so link hrefs baked into static
  // HTML hydrate unchanged before the saved preference swaps them.
  const initializeSkillLocale = () => {
    if (import.meta.env.SSR) return
    try {
      const saved = localStorage.getItem(SKILL_LOCALE_STORAGE_KEY)
      // Validated on read: a removed locale or garbage falls through to the
      // app locale via effectiveSkillLocale.
      if (saved && isSkillLocale(saved)) skillLocale.value = saved
    } catch (e) {
      console.warn('Could not access localStorage for skill locale preference:', e)
    }
  }

  const setSkillLocale = (locale: SkillLocale) => {
    skillLocale.value = locale
    if (!import.meta.env.SSR) {
      try {
        localStorage.setItem(SKILL_LOCALE_STORAGE_KEY, locale)
      } catch (e) {
        console.warn('Could not save skill locale preference to localStorage:', e)
      }
    }
  }

  // The user's own pick of a site language, which the skill text follows again.
  const pickLocale = (locale: AppLocale) => {
    setLocale(locale)
    skillLocale.value = null
    removeStorage(SKILL_LOCALE_STORAGE_KEY)
  }

  // Skill-text language for surfaces with no content context: /skills hero list
  // tiles, search results, and modal seeding. Skill pages themselves read
  // the URL prefix instead.
  const effectiveSkillLocale = computed<SkillLocale>(() => skillLocale.value ?? currentLocale.value)

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

  return {
    // State (readonly through refs)
    currentLocale,
    skillLocale,
    loaded,
    error,

    // Getters
    t,
    effectiveSkillLocale,

    // Actions
    initialize,
    initializeLocale,
    initializeSkillLocale,
    applyAddressLocale,
    setLocale,
    pickLocale,
    setSkillLocale,
    setHtmlLangOverride,
    clearHtmlLangOverride,
  }
})
