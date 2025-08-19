import { useHead } from '@unhead/vue'

interface ContentMetaOptions {
  title: string
  description: string
  url: string
  keywords?: string[]
  locale?: 'en' | 'zh'
}

/**
 * Sets up meta tags for content pages during SSR
 * Centralizes the meta tag configuration for all content components
 */
export function setupContentMeta(options: ContentMetaOptions): void {
  const { title, description, url, keywords, locale } = options

  // Set document language during runtime
  if (!import.meta.env.SSR && locale) {
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
      { name: 'description', content: truncate(description) },
      { name: 'keywords', content: allKeywords.join(', ') },
      { property: 'og:title', content: title },
      { property: 'og:description', content: truncate(description) },
      { property: 'og:url', content: `https://stargazer.tmdict.com/${locale}/${url}` },
    ],
    link: [{ rel: 'canonical', href: `https://stargazer.tmdict.com/${locale}/${url}` }],
  })
}
