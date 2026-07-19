import { inject, onUnmounted, type InjectionKey } from 'vue'
import { useHead } from '@unhead/vue'

import { SITE_ORIGIN } from '@/lib/site'
import { SKILL_LOCALES, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadCharacterImages, loadCharacterLocales } from '@/utils/dataLoader'
import { heroDisplayName } from '@/utils/skillLabels'

/** Provide(true) when rendering skill content inside a modal to suppress page-level meta writes. */
export const ContentInModalKey: InjectionKey<boolean> = Symbol('ContentInModal')

const ORIGIN = SITE_ORIGIN
const BASE_KEYWORDS = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征']

/**
 * Sets up meta tags for skill pages, deriving title/keywords and a per-hero
 * og:image from hero data. Runs on both SSG and the client so switching heroes
 * or text locales in the SPA rewrites the head (SkillSections remounts per
 * hero+locale); skipped when embedded in a modal so the popup doesn't mutate
 * the host page.
 *
 * The meta description is set separately at build time from page content
 * (extractContentDescription in vite.config.ts), so it is not written here.
 */
export function setupSkillContentMeta(name: string, locale: SkillLocale): void {
  // Embedded in a modal over another page: leave that page's head untouched.
  if (inject(ContentInModalKey, false)) return

  // The content locale owns <html lang> here; the store override keeps chrome
  // flips (setLocale/initializeLocale) from stomping it.
  const i18n = useI18nStore()
  const token = i18n.setHtmlLangOverride(locale)
  onUnmounted(() => i18n.clearHtmlLangOverride(token))

  const nameLocale = loadCharacterLocales()[name]
  // Warm by the route guard before this runs.
  const heroName = heroDisplayName(name, locale)
  const url = `skill/${name}`
  // Per-hero preview reusing the small roster thumbnail: Discord renders it, but
  // it is below the size FB/X require, so they fall back to a text-only card.
  // Absolute URL for crawlers; left unset (default og:image applies) for any hero
  // without a portrait.
  const ogImage = loadCharacterImages()[name]

  const keywords = [...BASE_KEYWORDS, nameLocale?.en, nameLocale?.zh, heroName]

  useHead({
    title: `${heroName} | Stargazer`,
    meta: [
      { name: 'keywords', content: [...new Set(keywords.filter(Boolean))].join(', ') },
      { property: 'og:title', content: heroName },
      ...(ogImage
        ? [
            { property: 'og:image', content: `${ORIGIN}${ogImage}` },
            { property: 'og:image:alt', content: heroName },
          ]
        : []),
      { property: 'og:url', content: `${ORIGIN}/${locale}/${url}` },
    ],
    link: [
      { rel: 'canonical', href: `${ORIGIN}/${locale}/${url}` },
      // Coverage is asserted at import time, so every language exists for
      // every hero and the alternate set is reciprocal across all 16 pages.
      ...SKILL_LOCALES.map(({ code }) => ({
        rel: 'alternate',
        hreflang: code,
        href: `${ORIGIN}/${code}/${url}`,
      })),
      { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}/en/${url}` },
    ],
  })
}

/** Sets up meta tags for the /{locale}/guide compendium (SSG and client). */
export function setupGuideContentMeta(locale: AppLocale): void {
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
