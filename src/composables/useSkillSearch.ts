import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import { isAppLocale, SKILL_LOCALES, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
import { getSkillLocaleDict, loadCharacterLocales, loadSkillLocale } from '@/utils/dataLoader'
import { cleanSkillText, renderSnippet, type Snippet } from '@/utils/searchHighlight'
import { curatedHeroName, heroDisplayName } from '@/utils/skillLabels'

export interface SearchHit {
  loc: 'name' | 'skill-name' | 'description'
  slot?: SlotKey
  level?: number
  tier?: number // EX refinement tier (Refine 2/4); set instead of level for refine rows
  /** Language this hit's text matched in. Per-slot dedup spans the locale
   * loop, so later hits can come from a different language than the hero's
   * first; links, lang attributes, and text lookups must use this. */
  locale: SkillLocale
  snippet: Snippet
}

export interface SearchResult {
  slug: string
  /** Priority-ordered; each hit links to its own matched language. */
  hits: SearchHit[]
}

interface NameEntry {
  slug: string
  text: string
}
interface DeepEntry {
  slug: string
  loc: 'skill-name' | 'description'
  slot: SlotKey
  level?: number
  tier?: number
  text: string
}

// Per-language index, built lazily on first query over whatever corpora are
// warm. en/zh are always warm (eager bundle); the other languages join as
// their chunks arrive. ~2.5k entries per language, trivial to build.
const indexCache = new Map<SkillLocale, { names: NameEntry[]; deep: DeepEntry[] }>()

// Bumped when a chunk lands so an open query re-runs over the new corpus.
const indexVersion = ref(0)

// Kicked on the first non-empty query: stream in every missing locale in the
// background. Failures are soft (results just lack that language), but they
// release the latch so a later query retries the missing chunks.
let warmKicked = false
function warmAllLocales(): void {
  if (warmKicked) return
  warmKicked = true
  for (const { code } of SKILL_LOCALES) {
    if (getSkillLocaleDict(code)) continue
    loadSkillLocale(code)
      .then(() => {
        indexVersion.value++
      })
      .catch(() => {
        warmKicked = false
      })
  }
}

function buildIndex(lang: SkillLocale, dict: NonNullable<ReturnType<typeof getSkillLocaleDict>>) {
  const names: NameEntry[] = []
  const deep: DeepEntry[] = []

  for (const slug of Object.keys(dict)) {
    const locale = dict[slug]
    const display = heroDisplayName(slug, lang)
    names.push({ slug, text: display })
    // Curated app-locale names are indexed as aliases: zh carries community
    // nicknames ("阿尔萨 (滚滚)") that players actually type. Display entries
    // come first so an official-name match snippets the official name.
    if (isAppLocale(lang)) {
      const curated = loadCharacterLocales()[slug]?.[lang]
      if (curated && curated !== display) names.push({ slug, text: curated })
    }

    for (const slot of SLOT_ORDER) {
      const slotData = locale[slot]
      if (!slotData) continue
      if (slotData.n) {
        deep.push({ slug, loc: 'skill-name', slot, text: cleanSkillText(slotData.n) })
      }
      slotData.d.forEach((rawDesc, i) => {
        deep.push({
          slug,
          loc: 'description',
          slot,
          level: i + 1,
          text: cleanSkillText(rawDesc),
        })
      })
      // EX refinement tiers: indexed so queries like "Rivalry Mode" or
      // "DEF Penetration" surface relevant heroes. `tier` (not level) marks
      // these as Refine rows so the result label reads "Refine 2" not "LV 2".
      for (const r of slotData.r ?? []) {
        deep.push({
          slug,
          loc: 'description',
          slot,
          tier: r.t,
          text: cleanSkillText(r.d),
        })
      }
    }
  }

  return { names, deep }
}

/** Null until the language's corpus is warm; never triggers a load itself. */
function getIndex(lang: SkillLocale) {
  const cached = indexCache.get(lang)
  if (cached) return cached
  const dict = getSkillLocaleDict(lang)
  if (!dict) return null
  const built = buildIndex(lang, dict)
  indexCache.set(lang, built)
  return built
}

/** Warm languages, priority first: the active text locale wins snippet dedup,
 * then the app locale, then the rest in table order. */
function localesInPriority(textLang: SkillLocale, appLang: AppLocale): SkillLocale[] {
  const priority: SkillLocale[] = [textLang]
  if (!priority.includes(appLang)) priority.push(appLang)
  for (const { code } of SKILL_LOCALES) {
    if (!priority.includes(code)) priority.push(code)
  }
  return priority.filter((code) => getSkillLocaleDict(code) !== null)
}

/** Slugs whose display name matches the query in any warm locale: the same
 * name index the roster search uses, for name-only consumers (the on-grid
 * picker popup). Matches whatever is warm; never triggers corpus loads. */
export function matchCharacterNames(query: string): Set<string> {
  const lc = query.toLowerCase()
  const slugs = new Set<string>()
  for (const { code } of SKILL_LOCALES) {
    const index = getIndex(code)
    if (!index) continue
    for (const e of index.names) {
      if (e.text.toLowerCase().includes(lc)) slugs.add(e.slug)
    }
  }
  return slugs
}

/** CJK characters pack meaning densely, so two are already a specific query;
 * Latin needs three to avoid flooding on fragments. Covers Han, kana, and
 * Hangul so 召唤, かばう, and 소환 all clear the bar at two characters. The
 * overlay reads this too (its short-query hint must match reality). */
export function deepSearchMinLength(query: string): number {
  return /[぀-ヿ一-鿿가-힯]/.test(query) ? 2 : 3
}

/** Empty query → `null`. ≥1 char → name match. ≥`deepSearchMinLength` chars →
 * +skill names & descriptions. Matches every warm locale so a hero surfaces
 * regardless of language; the first query streams the missing corpora in and
 * results refine live as they land. Hits per hero capped at 3; results
 * ordered by hit count. */
export function useSkillSearch(
  query: Ref<string>,
  appLang: Ref<AppLocale>,
  textLang: Ref<SkillLocale>,
): ComputedRef<SearchResult[] | null> {
  watch(query, (q) => {
    if (q.trim()) warmAllLocales()
  })

  return computed(() => {
    const q = query.value.trim()
    if (!q) return null

    // Re-run as background chunks arrive.
    void indexVersion.value

    const lc = q.toLowerCase()
    const includesQuery = (s: string) => s.toLowerCase().includes(lc)

    const perSlug = new Map<string, SearchHit[]>()
    // At most one hit per (slug, slot). Entries are pushed in slot+level
    // order, so the first survivor per slot is the lowest level.
    const seenSlots = new Map<string, Set<SlotKey>>()
    // One name hit per hero, even when the name matches in several locales.
    const namedSlugs = new Set<string>()
    const pushHit = (slug: string, hit: Omit<SearchHit, 'locale'>, locale: SkillLocale) => {
      if (hit.slot) {
        const seen = seenSlots.get(slug) ?? new Set<SlotKey>()
        if (seen.has(hit.slot)) return
        seen.add(hit.slot)
        seenSlots.set(slug, seen)
      }
      const list = perSlug.get(slug) ?? []
      if (list.length < 3) list.push({ ...hit, locale })
      perSlug.set(slug, list)
    }

    const locales = localesInPriority(textLang.value, appLang.value)

    for (const locale of locales) {
      for (const e of getIndex(locale)!.names) {
        if (namedSlugs.has(e.slug)) continue
        if (!includesQuery(e.text)) continue
        const s = renderSnippet(e.text, q)
        if (!s) continue
        namedSlugs.add(e.slug)
        pushHit(e.slug, { loc: 'name', snippet: s }, locale)
      }
    }

    if (q.length >= deepSearchMinLength(q)) {
      for (const locale of locales) {
        for (const e of getIndex(locale)!.deep) {
          if (!includesQuery(e.text)) continue
          const s = renderSnippet(e.text, q)
          if (!s) continue
          pushHit(
            e.slug,
            {
              loc: e.loc,
              slot: e.slot,
              level: e.level,
              tier: e.tier,
              snippet: s,
            },
            locale,
          )
        }
      }
    }

    return [...perSlug.entries()]
      .map(([slug, hits]) => ({ slug, hits }))
      .sort((a, b) => {
        if (b.hits.length !== a.hits.length) return b.hits.length - a.hits.length
        return curatedHeroName(a.slug, appLang.value).localeCompare(
          curatedHeroName(b.slug, appLang.value),
        )
      })
  })
}
