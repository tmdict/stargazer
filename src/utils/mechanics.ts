import type { Component } from 'vue'

import { loadCharacterImages, loadCharacterLocales } from '@/utils/dataLoader'

export type MechanicCategory = 'targeting' | 'tile' | 'companion'

/** Display order + the app-locale key for each category heading. */
export const CATEGORY_ORDER: MechanicCategory[] = ['targeting', 'tile', 'companion']
export const CATEGORY_LABEL_KEY: Record<MechanicCategory, string> = {
  targeting: 'mechanic-targeting',
  tile: 'mechanic-tile',
  companion: 'mechanic-companion',
}

/**
 * Category per snippet hero. Derived from each hero's registered skill builder:
 * `createTargetingSkill` → targeting, `createTileHighlightSkill` → tile,
 * companion summons → companion. Listed here are the non-targeting heroes;
 * everything else — including any newly added snippet — defaults to `targeting`.
 */
const CATEGORY_OVERRIDES: Record<string, MechanicCategory> = {
  cassadee: 'tile',
  daimon: 'tile',
  faramor: 'tile',
  galahad: 'tile',
  'lily-may': 'tile',
  phraesto: 'companion',
  zanie: 'companion',
}

export interface MechanicEntry {
  slug: string
  category: MechanicCategory
  components: Partial<Record<'en' | 'zh', Component>>
}

// Eager so the compendium renders into static HTML at SSG time (synchronous —
// no async component, no <Suspense>). These chunks land only in the mechanics
// page bundle; skill pages keep their own lazy snippet glob in SkillSections.
const snippetModules = import.meta.glob<{ default: Component }>('@/content/skill/*/*.vue', {
  eager: true,
})

// Raw source, used only to skip "boilerplate-only" snippets: those whose whole
// body is a shared `body-key` note (e.g. "tile-positional-buff") with no
// hero-specific prose or diagram. They add nothing unique to the compendium.
const snippetSources = import.meta.glob('@/content/skill/*/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function hasUniqueContent(path: string): boolean {
  const src = snippetSources[path] ?? ''
  if (!/body-key=/.test(src)) return true
  return /<p[>\s]|<ul|<ol|GridSnippet/.test(src)
}

let cache: MechanicEntry[] | null = null

/** All snippet heroes, sorted by slug, with their per-language components. */
export function mechanicEntries(): MechanicEntry[] {
  if (cache) return cache
  const bySlug: Record<string, MechanicEntry> = {}
  for (const [path, mod] of Object.entries(snippetModules)) {
    const match = path.match(/\/content\/skill\/([^/]+)\/[^/]+\.(en|zh)\.vue$/)
    if (!match || !hasUniqueContent(path)) continue
    const [, slug, lang] = match
    if (!bySlug[slug]) {
      bySlug[slug] = { slug, category: CATEGORY_OVERRIDES[slug] ?? 'targeting', components: {} }
    }
    bySlug[slug].components[lang as 'en' | 'zh'] = mod.default
  }
  cache = Object.values(bySlug).sort((a, b) => a.slug.localeCompare(b.slug))
  return cache
}

export function heroName(slug: string, lang: 'en' | 'zh'): string {
  return loadCharacterLocales()[slug]?.[lang] ?? slug
}

export function heroPortrait(slug: string): string {
  return loadCharacterImages()[slug] ?? ''
}
