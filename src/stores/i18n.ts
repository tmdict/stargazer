import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { isAppLocale, isSkillLocale, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { interpolate } from '@/utils/interpolate'
import { loadAllLocales } from '@/utils/localeLoader'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

// Constants
const LOCALE_STORAGE_KEY = 'stargazer.locale'
const SKILL_LOCALE_STORAGE_KEY = 'stargazer.skillLocale'

export const useI18nStore = defineStore('i18n', () => {
  // State
  const currentLocale = ref<AppLocale>('en')
  // The user's saved pick, known once initializeLocale has read it.
  const savedLocale = ref<AppLocale | null>(null)
  const translations = loadAllLocales()

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

  // `persist: false` is for a locale taken from the address: it is shown, and
  // must not overwrite the user's saved choice.
  const setLocale = (locale: AppLocale, { persist = true }: { persist?: boolean } = {}) => {
    currentLocale.value = locale
    applyDocumentLang()
    if (!persist) return
    savedLocale.value = locale
    writeStorage(LOCALE_STORAGE_KEY, locale)
  }

  // Reads the saved locale, then the `?l=` query param where `readQuery`
  // allows it. Called after mount: the pages are pre-rendered without a saved
  // locale, so an earlier read would mismatch the baked HTML.
  const initializeLocale = ({ readQuery }: { readQuery: boolean }) => {
    if (import.meta.env.SSR) return

    const saved = readStorage(LOCALE_STORAGE_KEY)
    if (saved && isAppLocale(saved)) savedLocale.value = saved

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

  // Read after mount (like initializeLocale), so the first client render draws
  // the link hrefs the baked HTML has before the saved preference swaps them.
  const initializeSkillLocale = () => {
    const saved = readStorage(SKILL_LOCALE_STORAGE_KEY)
    // Validated on read: a removed locale or garbage falls through to the
    // app locale via effectiveSkillLocale.
    if (saved && isSkillLocale(saved)) skillLocale.value = saved
  }

  const setSkillLocale = (locale: SkillLocale) => {
    skillLocale.value = locale
    writeStorage(SKILL_LOCALE_STORAGE_KEY, locale)
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

      const categoryTranslations = translations[category]

      if (!categoryTranslations) {
        console.warn(`Translation category not found: ${category}`)
        return key
      }

      const translation = categoryTranslations[name]

      if (!translation) {
        console.warn(`Translation not found: ${key}`)
        return key
      }

      const text = translation[currentLocale.value] || key
      return vars ? interpolate(text, vars) : text
    }
  })

  return {
    currentLocale,
    t,
    effectiveSkillLocale,
    initializeLocale,
    initializeSkillLocale,
    applyAddressLocale,
    pickLocale,
    setSkillLocale,
    setHtmlLangOverride,
    clearHtmlLangOverride,
  }
})
