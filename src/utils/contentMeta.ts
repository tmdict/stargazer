import { inject, type InjectionKey } from 'vue'
import { useHead } from '@unhead/vue'

import type { Locale } from '@/lib/types/i18n'
import { loadCharacterLocales } from '@/utils/dataLoader'

/** Provide(true) when rendering skill content inside a modal to suppress page-level meta writes. */
export const ContentInModalKey: InjectionKey<boolean> = Symbol('ContentInModal')

const ORIGIN = 'https://stargazer.tmdict.com'
const BASE_KEYWORDS = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征']

/**
 * Sets up meta tags for skill pages, deriving title/keywords from hero locale
 * data. Runs on both SSG and the client so switching heroes in the SPA rewrites
 * the head (SkillSections remounts per hero); skipped when embedded in a modal so
 * the popup doesn't mutate the host page.
 *
 * The meta description is set separately at build time from page content
 * (extractContentDescription in vite.config.ts), so it is not written here.
 */
export function setupSkillContentMeta(name: string, locale: Locale): void {
  // Embedded in a modal over another page: leave that page's head untouched.
  if (inject(ContentInModalKey, false)) return

  if (!import.meta.env.SSR) document.documentElement.lang = locale

  const nameLocale = loadCharacterLocales()[name]!
  const title = locale === 'en' ? `${nameLocale.en} Skills` : `${nameLocale.zh} 技能`
  const url = `skill/${name}`

  useHead({
    title: `${title} | Stargazer`,
    meta: [
      { name: 'keywords', content: [...BASE_KEYWORDS, nameLocale.en, nameLocale.zh].join(', ') },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `${ORIGIN}/${locale}/${url}` },
    ],
    link: [
      { rel: 'canonical', href: `${ORIGIN}/${locale}/${url}` },
      { rel: 'alternate', hreflang: 'en', href: `${ORIGIN}/en/${url}` },
      { rel: 'alternate', hreflang: 'zh', href: `${ORIGIN}/zh/${url}` },
      { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}/en/${url}` },
    ],
  })
}

/** Sets up meta tags for the /{locale}/guide compendium (SSG and client). */
export function setupGuideContentMeta(locale: Locale): void {
  if (!import.meta.env.SSR) document.documentElement.lang = locale

  const title = locale === 'en' ? 'Guide' : '机制'
  const description =
    locale === 'en'
      ? 'In-depth guide to AFK Journey hero skill mechanics - targeting, buffs, and positioning, illustrated with grid diagrams.'
      : '剑与远征启程英雄技能机制详解：目标选择、增益与站位，附带格子示意图。'
  const url = 'guide'

  useHead({
    title: `${title} | Stargazer`,
    meta: [
      { name: 'description', content: description },
      { name: 'keywords', content: [...BASE_KEYWORDS, title].join(', ') },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: `${ORIGIN}/${locale}/${url}` },
    ],
    link: [
      { rel: 'canonical', href: `${ORIGIN}/${locale}/${url}` },
      { rel: 'alternate', hreflang: 'en', href: `${ORIGIN}/en/${url}` },
      { rel: 'alternate', hreflang: 'zh', href: `${ORIGIN}/zh/${url}` },
      { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}/en/${url}` },
    ],
  })
}
