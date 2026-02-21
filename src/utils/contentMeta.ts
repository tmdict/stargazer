import { useHead } from '@unhead/vue'

import { loadCharacterLocales } from '@/utils/dataLoader'

interface ContentMetaOptions {
  title: string
  description?: string
  url: string
  locale: 'en' | 'zh'
  keywords?: string[]
}

/**
 * Sets up meta tags for content pages during SSR
 * Centralizes the meta tag configuration for all content components
 */
export function setupContentMeta(options: ContentMetaOptions): void {
  const { title, description, url, keywords, locale } = options

  // Set document language during runtime
  if (!import.meta.env.SSR) {
    document.documentElement.lang = locale
    return
  }

  // // Truncates to 150 chars at word boundary, adds "..."
  const truncate = (str: string, max = 150) =>
    str.length <= max ? str : str.slice(0, str.lastIndexOf(' ', max) || max) + ' ...'

  // Base keywords that are always included
  const baseKeywords = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征']

  // Combine base keywords with any additional keywords
  const allKeywords = keywords ? [...baseKeywords, ...keywords] : baseKeywords

  useHead({
    title: title + ' | Stargazer',
    meta: [
      ...(description
        ? [
            { name: 'description', content: truncate(description) },
            { property: 'og:description', content: truncate(description) },
          ]
        : []),
      { name: 'keywords', content: allKeywords.join(', ') },
      { property: 'og:title', content: title },
      { property: 'og:url', content: `https://stargazer.tmdict.com/${locale}/${url}` },
    ],
    link: [{ rel: 'canonical', href: `https://stargazer.tmdict.com/${locale}/${url}` }],
  })
}

/** Sets up meta tags for skill content pages, deriving title/url/keywords from hero locale data */
export function setupSkillContentMeta(
  name: string,
  locale: 'en' | 'zh',
  description?: string,
): void {
  const nameLocale = loadCharacterLocales()[name]!
  const title = locale === 'en' ? `${nameLocale.en} Skills` : `${nameLocale.zh} 技能`

  setupContentMeta({
    title,
    description,
    url: `skill/${name}`,
    locale,
    keywords: [nameLocale.en, nameLocale.zh],
  })
}
