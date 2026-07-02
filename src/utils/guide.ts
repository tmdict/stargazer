import type { Component } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'
import { loadCharacterLocales } from '@/utils/dataLoader'

export interface GuideEntry {
  slug: string
  components: Partial<Record<AppLocale, Component>>
}

// Eager so the compendium renders into static HTML at SSG time (synchronous:
// no async component, no <Suspense>). These chunks land only in the guide
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

let cache: GuideEntry[] | null = null

export function guideEntries(): GuideEntry[] {
  if (cache) return cache
  const bySlug: Record<string, GuideEntry> = {}
  for (const [path, mod] of Object.entries(snippetModules)) {
    const match = path.match(/\/content\/skill\/([^/]+)\/[^/]+\.(en|zh)\.vue$/)
    if (!match || !hasUniqueContent(path)) continue
    const [, slug, lang] = match
    if (!bySlug[slug]) {
      bySlug[slug] = { slug, components: {} }
    }
    bySlug[slug].components[lang as AppLocale] = mod.default
  }
  cache = Object.values(bySlug).sort((a, b) => a.slug.localeCompare(b.slug))
  return cache
}

export function heroName(slug: string, lang: AppLocale): string {
  return loadCharacterLocales()[slug]?.[lang] ?? slug
}
