import { useHead } from '@unhead/vue'

import { loadCharacterLocales } from '@/utils/dataLoader'

interface ContentMetaOptions {
  title: string
  url: string
  locale: 'en' | 'zh'
  keywords?: string[]
}

/**
 * Sets up meta tags for content pages during SSR
 * Centralizes the meta tag configuration for all content components
 */
export function setupContentMeta(options: ContentMetaOptions): void {
  const { title, url, keywords, locale } = options

  // Set document language during runtime
  if (!import.meta.env.SSR) {
    document.documentElement.lang = locale
    return
  }

  // Base keywords that are always included
  const baseKeywords = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征']

  // Combine base keywords with any additional keywords
  const allKeywords = keywords ? [...baseKeywords, ...keywords] : baseKeywords

  useHead({
    title: title + ' | Stargazer',
    meta: [
      { name: 'keywords', content: allKeywords.join(', ') },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `https://stargazer.tmdict.com/${locale}/${url}` },
    ],
    link: [{ rel: 'canonical', href: `https://stargazer.tmdict.com/${locale}/${url}` }],
  })
}

/** Sets up meta tags for skill content pages, deriving title/url/keywords from hero locale data */
export function setupSkillContentMeta(name: string, locale: 'en' | 'zh'): void {
  const nameLocale = loadCharacterLocales()[name]!
  const title = locale === 'en' ? `${nameLocale.en} Skills` : `${nameLocale.zh} 技能`

  setupContentMeta({
    title,
    url: `skill/${name}`,
    locale,
    keywords: [nameLocale.en, nameLocale.zh],
  })
}
