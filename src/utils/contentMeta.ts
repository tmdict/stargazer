import { inject, type InjectionKey } from 'vue'
import { useHead } from '@unhead/vue'

import { loadCharacterLocales } from '@/utils/dataLoader'

/** Provide(true) when rendering skill content inside a modal to suppress page-level meta writes. */
export const ContentInModalKey: InjectionKey<boolean> = Symbol('ContentInModal')

const ORIGIN = 'https://stargazer.tmdict.com'
const BASE_KEYWORDS = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征']

/**
 * Sets up meta tags for skill pages (the only pre-rendered content), deriving
 * title/keywords from hero locale data. During SSG it writes the full head;
 * on the client it only syncs <html lang>, and skips even that when embedded in
 * a modal so the popup doesn't mutate the host page.
 */
export function setupSkillContentMeta(name: string, locale: 'en' | 'zh'): void {
  const isEmbedded = inject(ContentInModalKey, false)

  if (!import.meta.env.SSR) {
    if (!isEmbedded) document.documentElement.lang = locale
    return
  }

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
