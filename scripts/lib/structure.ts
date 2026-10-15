// The season's structural files, derived from the feed: seasonal artifact and
// phantimal data files and the artifact display names. Pure functions; the
// importer (import-structure.ts) reads the feed and the existing files and
// writes what these return.

import { APP_LOCALES, type AppLocale, type LocaleData } from '../../src/lib/types/i18n.ts'
import { perAppLocale } from './shared.ts'

// Feed stat codes → the artifact files' stats keys.
export const STAT_KEY: Record<string, string> = {
  HP: 'hp',
  ATK: 'atk',
  DEF: 'def',
  ARM: 'phys-def',
  MR: 'magic-def',
  HAST: 'haste',
  ATKHAST: 'atk-spd',
  PT: 'def-penetration',
  HEAL: 'vitality',
  BLOCK: 'ranged-def',
  LFS: 'life-drain',
  CRIT: 'crit',
}

// The permanent artifacts hold ids 1-6; a season's set follows in feed order.
const PRE_SEASON_COUNT = 6
// The feed's season numbers count from 100 (108 is season 8).
const SEASON_OFFSET = 100
// Camp slot 5 is the game's combined Hypogean/Celestial camp, so its phantimal
// counts for both factions.
const DUAL_CAMP = 5
const DUAL_FACTIONS = ['hypogean', 'celestial']
// Feed damage codes → the phantimal files' damage values.
export const DAMAGE_TYPE: Record<string, string> = { AD: 'physical', AP: 'magic' }

export type Json = Record<string, unknown>

export interface FeedArtifact {
  slug: string
  set: string
  name: string | null
  fairyId?: number
  seasonType?: number
  statBonuses: { stat: string; value: number }[]
}

export interface FeedPhantimal {
  slug: string
  faction: string | null
  campSlot?: number
  damageType?: string | null
  attackRange?: number | null
  seasonType?: number
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
  if (season.some((a) => a.fairyId == null || a.seasonType == null)) {
    out.problems.push('the feed has no fairyId/seasonType on artifacts; rebuild it')
    return out
  }
  season.sort((a, b) => a.fairyId! - b.fairyId!)
  season.forEach((a, rank) => {
    const stats: Record<string, number> = {}
    for (const { stat, value } of a.statBonuses) {
      const key = STAT_KEY[stat]
      if (key) stats[key] = value
      else out.problems.push(`${a.slug}: unmapped feed stat code "${stat}" (add it to STAT_KEY)`)
    }
    const generated = {
      id: PRE_SEASON_COUNT + rank + 1,
      name: a.slug,
      season: a.seasonType! - SEASON_OFFSET,
      stats,
    }
    const prior = sameSeason(generated, existing[a.slug])
    const problem = idProblem(a.slug, generated, prior)
    if (problem) out.problems.push(problem)
    out.data[a.slug] = withCurated(generated, prior)
    const unnamed = APP_LOCALES.filter((code) => !feeds[code][a.slug]?.name)
    if (unnamed.length > 0) {
      out.problems.push(`${a.slug}: the feed has no ${unnamed.join(' or ')} name`)
      return
    }
    // The feed's English names carry a " Spell" suffix the game's short names drop.
    out.names[a.slug] = perAppLocale((code) => {
      const name = feeds[code][a.slug]!.name!
      return code === 'en' ? name.replace(/\s*Spell$/, '') : name
    })
  })
  return out
}

export function phantimalStructure(
  en: Record<string, FeedPhantimal>,
  existing: Record<string, Json>,
): Structure {
  const out: Structure = { data: {}, names: {}, problems: [] }
  for (const p of Object.values(en).sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (
      p.campSlot == null ||
      p.damageType == null ||
      p.attackRange == null ||
      p.seasonType == null ||
      !p.faction
    ) {
      out.problems.push(
        `${p.slug}: the feed has no campSlot/damageType/attackRange/seasonType/faction; rebuild it`,
      )
      continue
    }
    const damage = DAMAGE_TYPE[p.damageType]
    if (!damage) {
      out.problems.push(
        `${p.slug}: unmapped feed damage type "${p.damageType}" (add it to DAMAGE_TYPE)`,
      )
      continue
    }
    const generated: Json = {
      id: p.campSlot,
      name: p.slug,
      season: p.seasonType - SEASON_OFFSET,
      range: p.attackRange,
      damage,
      faction: p.faction.toLowerCase(),
    }
    if (p.campSlot === DUAL_CAMP) generated.qualifyingFactions = DUAL_FACTIONS
    const prior = sameSeason(generated, existing[p.slug])
    if (prior?.qualifyingFactions) generated.qualifyingFactions = prior.qualifyingFactions
    const problem = idProblem(p.slug, generated, prior)
    if (problem) out.problems.push(problem)
    out.data[p.slug] = withCurated(generated, prior)
  }
  return out
}
