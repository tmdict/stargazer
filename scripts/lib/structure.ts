// The season's structural files, derived from the feed: seasonal artifact and
// phantimal data files and the artifact display names. Pure functions; the
// importer (import-structure.ts) reads the feed and the existing files and
// writes what these return.

import { APP_LOCALES, type AppLocale, type LocaleData } from '../../src/lib/types/i18n.ts'
import { perAppLocale } from './shared.ts'

export type Json = Record<string, unknown>

export interface FeedArtifact {
  slug: string
  set: string
  name: string | null
  // Permanent artifacts hold ids 1-6 and season 0; a season's set follows.
  id: number
  season: number
  // `stat` is the artifact files' stats key.
  statBonuses: { stat: string; value: number }[]
}

export interface FeedPhantimal {
  slug: string
  faction: string | null
  id: number
  // Every faction the phantimal counts for: two for the Celestial and Hypogean one.
  factions: string[]
  damage: string
  range: number
  season: number
}

export interface Structure {
  data: Record<string, Json>
  names: Record<string, LocaleData>
  problems: string[]
}

// A file from another season is another unit under a reused slug: nothing
// curated for it carries over, and its id binds nothing.
const sameSeason = (generated: Json, existing: Json | undefined): Json | undefined =>
  existing?.season === generated.season ? existing : undefined

// Generated keys first, in the files' order; any other key an existing file
// has (curated by hand, e.g. `targeting`) is kept after them.
function withCurated(generated: Json, existing: Json | undefined): Json {
  const out: Json = { ...generated }
  for (const [key, value] of Object.entries(existing ?? {})) {
    if (!(key in out)) out[key] = value
  }
  return out
}

// Ids are baked into share links: within one season an existing file's id
// never changes, and a clash is left for a hand decision.
function idProblem(slug: string, generated: Json, existing: Json | undefined): string | null {
  if (!existing || existing.id === generated.id) return null
  return (
    `${slug}: the feed gives id ${String(generated.id)}, the file has ${String(existing.id)} ` +
    `in the same season; ids are in share links, so decide by hand`
  )
}

export function artifactStructure(
  feeds: Record<AppLocale, Record<string, FeedArtifact>>,
  existing: Record<string, Json>,
): Structure {
  const out: Structure = { data: {}, names: {}, problems: [] }
  const season = Object.values(feeds.en).filter((a) => a.set === 'season')
  season.sort((a, b) => a.id - b.id)
  for (const a of season) {
    const stats = Object.fromEntries(a.statBonuses.map(({ stat, value }) => [stat, value]))
    const generated = { id: a.id, name: a.slug, season: a.season, stats }
    const prior = sameSeason(generated, existing[a.slug])
    const problem = idProblem(a.slug, generated, prior)
    if (problem) out.problems.push(problem)
    out.data[a.slug] = withCurated(generated, prior)
    const unnamed = APP_LOCALES.filter((code) => !feeds[code][a.slug]?.name)
    if (unnamed.length > 0) {
      out.problems.push(`${a.slug}: the feed has no ${unnamed.join(' or ')} name`)
      continue
    }
    // The feed's English names carry a " Spell" suffix the game's short names drop.
    out.names[a.slug] = perAppLocale((code) => {
      const name = feeds[code][a.slug]!.name!
      return code === 'en' ? name.replace(/\s*Spell$/, '') : name
    })
  }
  return out
}

export function phantimalStructure(
  en: Record<string, FeedPhantimal>,
  existing: Record<string, Json>,
): Structure {
  const out: Structure = { data: {}, names: {}, problems: [] }
  for (const p of Object.values(en).sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (!p.faction) {
      out.problems.push(`${p.slug}: the feed has no English faction; rebuild it`)
      continue
    }
    const generated: Json = {
      id: p.id,
      name: p.slug,
      season: p.season,
      range: p.range,
      damage: p.damage,
      faction: p.faction.toLowerCase(),
    }
    if (p.factions.length > 1) generated.qualifyingFactions = p.factions
    const prior = sameSeason(generated, existing[p.slug])
    if (prior?.qualifyingFactions) generated.qualifyingFactions = prior.qualifyingFactions
    const problem = idProblem(p.slug, generated, prior)
    if (problem) out.problems.push(problem)
    out.data[p.slug] = withCurated(generated, prior)
  }
  return out
}
