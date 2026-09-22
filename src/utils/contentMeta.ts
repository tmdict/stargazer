import { computed, inject, onUnmounted, type InjectionKey, type Ref } from 'vue'
import { useHead } from '@unhead/vue'

import { guidePath, type GuidePage } from '@/lib/guide'
import { SITE_ORIGIN } from '@/lib/site'
import { APP_LOCALES, SKILL_LOCALES, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
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

const GUIDE_META: Record<GuidePage, Record<AppLocale, { title: string; description: string }>> = {
  index: {
    en: {
      title: 'Guide',
      description:
        'AFK Journey arena guide: season PvP reports with a counter ladder, heroes grouped by skill mechanic, and Paragon and EX Refinement stat tables.',
    },
    zh: {
      title: '指南',
      description:
        '剑与远征启程竞技场指南：赛季 PvP 报告与克制关系图、按技能机制分组的英雄，以及冠阶与精炼属性表。',
    },
  },
  upgrades: {
    en: {
      title: 'Upgrades',
      description: 'Paragon and EX Refinement stat gains per level for every AFK Journey faction.',
    },
    zh: { title: '强化', description: '剑与远征启程各阵营每级冠阶与精炼的属性加成。' },
  },
  mechanics: {
    en: {
      title: 'Mechanics',
      description:
        'AFK Journey heroes grouped by skill mechanic, with the skill text behind each tag.',
    },
    zh: { title: '机制', description: '按技能机制分组的剑与远征启程英雄，附相关技能文本。' },
  },
}

/**
 * Sets up meta tags for a guide page (SSG and client). The en and zh routes
 * of a page share one view instance, so the head follows the locale
 * reactively instead of the value at setup.
 */
export function setupGuideContentMeta(locale: Ref<AppLocale>, page: GuidePage): void {
  useHead(
    computed(() => {
      const { title, description } = GUIDE_META[page][locale.value]
      const path = guidePath(locale.value, page)
      return {
        title: `${title} | Stargazer`,
        meta: [
          { name: 'description', content: description },
          { name: 'keywords', content: [...BASE_KEYWORDS, title].join(', ') },
          { property: 'og:title', content: title },
          { property: 'og:description', content: description },
          { property: 'og:url', content: `${ORIGIN}${path}` },
        ],
        link: [
          { rel: 'canonical', href: `${ORIGIN}${path}` },
          ...APP_LOCALES.map((code) => ({
            rel: 'alternate',
            hreflang: code,
            href: `${ORIGIN}${guidePath(code, page)}`,
          })),
          { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}${guidePath('en', page)}` },
        ],
      }
    }),
  )
}
