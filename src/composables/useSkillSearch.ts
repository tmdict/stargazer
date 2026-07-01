import { computed, type ComputedRef, type Ref } from 'vue'

import type { Locale } from '@/lib/types/i18n'
import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
import { loadCharacterLocales, loadSkillLocales } from '@/utils/dataLoader'
import { cleanSkillText, renderSnippet, type Snippet } from '@/utils/searchHighlight'

export interface SearchHit {
  loc: 'name' | 'skill-name' | 'description'
  slot?: SlotKey
  level?: number
  tier?: number // EX refinement tier (Refine 2/4); set instead of level for refine rows
  snippet: Snippet
}

export interface SearchResult {
  slug: string
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

// Per-language index, built lazily on first query. ~2.5k entries, trivial.
const indexCache: Record<Locale, { names: NameEntry[]; deep: DeepEntry[] } | undefined> = {
  en: undefined,
  zh: undefined,
}

const LOCALES = Object.keys(indexCache) as Locale[]

function buildIndex(lang: Locale) {
  const charLocales = loadCharacterLocales()
  const skills = loadSkillLocales()[lang]

  const names: NameEntry[] = []
  const deep: DeepEntry[] = []

  for (const slug of Object.keys(skills)) {
    const displayName = charLocales[slug]?.[lang] ?? slug
    names.push({ slug, text: displayName })

    const locale = skills[slug]
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

function getIndex(lang: Locale) {
  if (!indexCache[lang]) indexCache[lang] = buildIndex(lang)
  return indexCache[lang]!
}

/** Slugs whose display name matches the query in any locale: the same name index
 * the roster search uses, for name-only consumers (the on-grid picker popup). */
export function matchCharacterNames(query: string): Set<string> {
  const lc = query.toLowerCase()
  const slugs = new Set<string>()
  for (const locale of LOCALES) {
    for (const e of getIndex(locale).names) {
      if (e.text.toLowerCase().includes(lc)) slugs.add(e.slug)
    }
  }
  return slugs
}

/** Empty query → `null`. ≥1 char → name match. ≥3 chars (≥2 for CJK) → +skill
 * names & descriptions. Matches every locale so a hero surfaces regardless of
 * the UI language. Hits per hero capped at 3; results ordered by hit count. */
export function useSkillSearch(
  query: Ref<string>,
  lang: Ref<Locale>,
): ComputedRef<SearchResult[] | null> {
  return computed(() => {
    const q = query.value.trim()
    if (!q) return null

    const lc = q.toLowerCase()
    const includesQuery = (s: string) => s.toLowerCase().includes(lc)

    const perSlug = new Map<string, SearchHit[]>()
    // At most one hit per (slug, slot). Entries are pushed in slot+level
    // order, so the first survivor per slot is the lowest level.
    const seenSlots = new Map<string, Set<SlotKey>>()
    // One name hit per hero, even when the name matches in several locales.
    const namedSlugs = new Set<string>()
    const pushHit = (slug: string, hit: SearchHit) => {
      if (hit.slot) {
        const seen = seenSlots.get(slug) ?? new Set<SlotKey>()
        if (seen.has(hit.slot)) return
        seen.add(hit.slot)
        seenSlots.set(slug, seen)
      }
      const list = perSlug.get(slug) ?? []
      if (list.length < 3) list.push(hit)
      perSlug.set(slug, list)
    }

    // Selected locale first: its hit wins the per-slot/name dedup, so the shown
    // snippet is in the UI language whenever the hero also matches there.
    const locales = [lang.value, ...LOCALES.filter((l) => l !== lang.value)]

    for (const locale of locales) {
      for (const e of getIndex(locale).names) {
        if (namedSlugs.has(e.slug)) continue
        if (!includesQuery(e.text)) continue
        const s = renderSnippet(e.text, q)
        if (!s) continue
        namedSlugs.add(e.slug)
        pushHit(e.slug, { loc: 'name', snippet: s })
      }
    }

    // Han characters (the zh locale) pack meaning densely, so two are already a
    // specific query; Latin needs three to avoid flooding on fragments.
    const deepMinLength = /[一-鿿]/.test(q) ? 2 : 3
    if (q.length >= deepMinLength) {
      for (const locale of locales) {
        for (const e of getIndex(locale).deep) {
          if (!includesQuery(e.text)) continue
          const s = renderSnippet(e.text, q)
          if (!s) continue
          pushHit(e.slug, {
            loc: e.loc,
            slot: e.slot,
            level: e.level,
            tier: e.tier,
            snippet: s,
          })
        }
      }
    }

    const charLocales = loadCharacterLocales()
    return [...perSlug.entries()]
      .map(([slug, hits]) => ({ slug, hits }))
      .sort((a, b) => {
        if (b.hits.length !== a.hits.length) return b.hits.length - a.hits.length
        const na = charLocales[a.slug]?.[lang.value] ?? a.slug
        const nb = charLocales[b.slug]?.[lang.value] ?? b.slug
        return na.localeCompare(nb)
      })
  })
}
