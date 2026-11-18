import { computed, inject, onUnmounted, type InjectionKey, type Ref } from 'vue'
import { useHead } from '@unhead/vue'

import {
  guidePath,
  HD_SHOP_PATH,
  HD_SHOP_PROBABILITY_PATH,
  SL_GENERATOR_PATH,
  SL_LISTS_PATH,
  SL_RULES_PATH,
  WWW_PATH,
  type GuidePage,
} from '@/lib/guide'
import { helpPath } from '@/lib/help'
import { SITE_ORIGIN } from '@/lib/site'
import { skillPath } from '@/lib/skillPath'
import { APP_LOCALES, SKILL_LOCALES, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadCharacterImages } from '@/utils/imageLoader'
import { loadAppLocales, loadCharacterLocales } from '@/utils/localeLoader'
import { heroDisplayName } from '@/utils/skillLabels'

/** Provide(true) when rendering skill content inside a modal to suppress page-level meta writes. */
export const ContentInModalKey: InjectionKey<boolean> = Symbol('ContentInModal')

const ORIGIN = SITE_ORIGIN
const BASE_KEYWORDS = ['AFK Journey', 'AFKJ', '剑与远征启程', '剑与远征', 'AFK: 새로운 여정']

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
  // Per-hero preview reusing the small picker thumbnail: Discord renders it, but
  // it is below the size FB/X require, so they fall back to a text-only card.
  // Absolute URL for crawlers; left unset (default og:image applies) for any hero
  // without a portrait.
  const ogImage = loadCharacterImages()[name]

  const keywords = [...BASE_KEYWORDS, ...APP_LOCALES.map((l) => nameLocale?.[l]), heroName]

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
      { property: 'og:url', content: `${ORIGIN}${skillPath(locale, name)}` },
    ],
    link: [
      { rel: 'canonical', href: `${ORIGIN}${skillPath(locale, name)}` },
      // The data step refuses a pack that lacks a hero in any language, so the
      // alternate set is reciprocal across all 16 pages.
      ...SKILL_LOCALES.map(({ code }) => ({
        rel: 'alternate',
        hreflang: code,
        href: `${ORIGIN}${skillPath(code, name)}`,
      })),
      { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}${skillPath('en', name)}` },
    ],
  })
}

const GUIDE_META: Record<GuidePage, Record<AppLocale, { title: string; description: string }>> = {
  index: {
    en: {
      title: 'Guide',
      description:
        'AFK Journey arena guide: season PvP reports, a PvP team generator, Who Would Win? match predictions, heroes grouped by skill mechanic, and Paragon and EX Refinement stat tables.',
    },
    zh: {
      title: '攻略',
      description:
        '剑与远征启程竞技场攻略：赛季 PvP 报告、PvP阵容生成器、“谁会赢？”对局预测、按技能机制分组的英雄，以及冠阶与精炼属性表。',
    },
    ko: {
      title: '가이드',
      description:
        "AFK: 새로운 여정 아레나 가이드. 시즌 PvP 리포트, PvP 조합 생성기, '누가 이길까?' 승부 예측, 스킬 메커니즘별 영웅, 파라곤 및 전용 장비 제련 속성표를 제공합니다.",
    },
  },
  upgrades: {
    en: {
      title: 'Upgrades',
      description: 'Paragon and EX Refinement stat gains per level for every AFK Journey faction.',
    },
    zh: { title: '强化', description: '剑与远征启程各阵营每级冠阶与精炼的属性加成。' },
    ko: {
      title: '강화',
      description:
        'AFK: 새로운 여정 모든 진영의 파라곤 및 전용 장비 제련 단계별 속성 증가량을 정리했습니다.',
    },
  },
  mechanics: {
    en: {
      title: 'Mechanics',
      description:
        'AFK Journey heroes grouped by skill mechanic, with the skill text behind each tag.',
    },
    zh: { title: '机制', description: '按技能机制分组的剑与远征启程英雄，附相关技能文本。' },
    ko: {
      title: '메커니즘',
      description:
        'AFK: 새로운 여정 영웅을 스킬 메커니즘별로 모았습니다. 태그별 관련 스킬 설명도 함께 확인할 수 있습니다.',
    },
  },
  factions: {
    en: {
      title: 'Faction Bonus',
      description:
        'AFK Journey Faction Bonus and Tactics: the ATK and HP a team gains from heroes of one faction, and the 15% damage change between factions that counter each other.',
    },
    zh: {
      title: '同阵营增益',
      description:
        '剑与远征启程同阵营增益与阵营克制规则：同阵营角色带来的攻击力与生命值加成，以及克制关系带来的15%伤害增减。',
    },
    ko: {
      title: '동일 진영 버프',
      description:
        'AFK: 새로운 여정 동일 진영 버프와 진영 상성 규칙. 같은 진영 영웅으로 얻는 공격력·HP 증가와 상성에 따른 15% 대미지 증감을 정리했습니다.',
    },
  },
  damage: {
    en: {
      title: 'Damage Types',
      description:
        'AFK Journey damage types: how physical, magic and true damage and HP loss differ, how to tell them apart in skill text, and which effects raise or stop each.',
    },
    zh: {
      title: '伤害类型',
      description:
        '剑与远征启程伤害类型：物理、魔法、真实伤害与生命流失的区别，如何从技能描述中分辨，以及各自受哪些效果影响。',
    },
    ko: {
      title: '대미지 유형',
      description:
        'AFK: 새로운 여정 대미지 유형. 물리·마법·고정 대미지와 HP 유실의 차이, 스킬 설명으로 구분하는 법, 유형별로 영향을 주는 효과를 정리했습니다.',
    },
  },
  glossary: {
    en: {
      title: 'Glossary',
      description:
        "AFK Journey glossary: what every stat, status, control effect, targeting word and damage term in skill text means, in the game's own words where it gives them.",
    },
    zh: {
      title: '术语表',
      description:
        '剑与远征启程术语表：技能描述中各项属性、状态、控制效果、索敌与伤害用语的含义，游戏有解释的均采用原文。',
    },
    ko: {
      title: '용어집',
      description:
        'AFK: 새로운 여정 용어집. 스킬 설명에 나오는 속성, 상태, 제어 효과, 타겟팅, 대미지 용어의 뜻을 정리했습니다. 게임에 설명이 있는 항목은 게임의 설명을 그대로 실었습니다.',
    },
  },
}

const HELP_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Help',
    description:
      'How to use Stargazer: placing heroes, reading skills, sharing boards, rosters, and saving teams.',
  },
  zh: {
    title: '帮助',
    description: 'Stargazer 使用说明：放置英雄、查看技能、分享棋盘、英雄池与保存阵容。',
  },
  ko: {
    title: '도움말',
    description: 'Stargazer 사용법: 영웅 배치, 스킬 확인, 보드 공유, 로스터, 진형 저장.',
  },
}

/**
 * Sets up meta tags for a guide or Help page (SSG and client). The head follows
 * the locale reactively instead of the value at setup: a guide page keeps its
 * view while the site language switches, and a Help page's locale routes share
 * one view instance. `address` is the page's one address, or its route in each
 * app locale, which search engines are then told about as alternates.
 */
function setupPageMeta(
  locale: Ref<AppLocale>,
  meta: (locale: AppLocale) => { title: string; description: string },
  address: string | ((locale: AppLocale) => string),
): void {
  const perLocale = typeof address !== 'string'
  const pathFor = (l: AppLocale): string => (typeof address === 'string' ? address : address(l))
  useHead(
    computed(() => {
      const { title, description } = meta(locale.value)
      const path = pathFor(locale.value)
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
          ...(perLocale
            ? [
                ...APP_LOCALES.map((code) => ({
                  rel: 'alternate',
                  hreflang: code,
                  href: `${ORIGIN}${pathFor(code)}`,
                })),
                { rel: 'alternate', hreflang: 'x-default', href: `${ORIGIN}${pathFor('en')}` },
              ]
            : []),
        ],
      }
    }),
  )
}

export const setupGuideContentMeta = (locale: Ref<AppLocale>, page: GuidePage): void =>
  setupPageMeta(locale, (l) => GUIDE_META[page][l], guidePath(page))

export const setupHelpContentMeta = (locale: Ref<AppLocale>): void =>
  setupPageMeta(locale, (l) => HELP_META[l], helpPath)

// A page titled by its own `<prefix>-title` and `<prefix>-description` text.
const setupTextMeta = (locale: Ref<AppLocale>, prefix: string, path: string): void => {
  const strings = loadAppLocales()
  setupPageMeta(
    locale,
    (l) => ({
      title: strings[`${prefix}-title`]![l],
      description: strings[`${prefix}-description`]![l],
    }),
    path,
  )
}

export const setupSlContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'sl', SL_GENERATOR_PATH)

export const setupSlRulesContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'rules', SL_RULES_PATH)

export const setupSlListsContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'lists', SL_LISTS_PATH)

export const setupWwwContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'www', WWW_PATH)

export const setupShopContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'shop', HD_SHOP_PATH)

export const setupShopProbabilityContentMeta = (locale: Ref<AppLocale>): void =>
  setupTextMeta(locale, 'shop-probability', HD_SHOP_PROBABILITY_PATH)
