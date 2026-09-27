// The season's structural files, derived from the feed: seasonal artifact and
// phantimal data files and the artifact display names. Pure functions; the
// importer (import-structure.ts) reads the feed and the existing files and
// writes what these return.

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
const MELEE_RANGE = 1
const RANGED_RANGE = 20

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
  isMelee?: boolean
  seasonType?: number
}

export interface Structure {
  data: Record<string, Json>
  names: Record<string, { en: string; zh: string }>
  problems: string[]
}

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
  if (!existing || existing.season !== generated.season || existing.id === generated.id) return null
  return (
    `${slug}: the feed gives id ${String(generated.id)}, the file has ${String(existing.id)} ` +
    `in the same season; ids are in share links, so decide by hand`
  )
}

export function artifactStructure(
  en: Record<string, FeedArtifact>,
  zh: Record<string, FeedArtifact>,
  existing: Record<string, Json>,
): Structure {
  const out: Structure = { data: {}, names: {}, problems: [] }
  const season = Object.values(en).filter((a) => a.set === 'season')
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
    const problem = idProblem(a.slug, generated, existing[a.slug])
    if (problem) out.problems.push(problem)
    out.data[a.slug] = withCurated(generated, existing[a.slug])
    const zhName = zh[a.slug]?.name
    if (!a.name || !zhName) {
      out.problems.push(`${a.slug}: the feed has no en or zh name`)
      return
    }
    // The feed's English names carry a " Spell" suffix the game's short names drop.
    out.names[a.slug] = { en: a.name.replace(/\s*Spell$/, ''), zh: zhName }
  })
  return out
}

export function phantimalStructure(
  en: Record<string, FeedPhantimal>,
  existing: Record<string, Json>,
): Structure {
  const out: Structure = { data: {}, names: {}, problems: [] }
  for (const p of Object.values(en).sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (p.campSlot == null || p.isMelee == null || p.seasonType == null || !p.faction) {
      out.problems.push(
        `${p.slug}: the feed has no campSlot/isMelee/seasonType/faction; rebuild it`,
      )
      continue
    }
    const generated: Json = {
      id: p.campSlot,
      name: p.slug,
      season: p.seasonType - SEASON_OFFSET,
      range: p.isMelee ? MELEE_RANGE : RANGED_RANGE,
      faction: p.faction.toLowerCase(),
    }
    if (p.campSlot === DUAL_CAMP) generated.qualifyingFactions = DUAL_FACTIONS
    if (existing[p.slug]?.qualifyingFactions) {
      generated.qualifyingFactions = existing[p.slug]!.qualifyingFactions
    }
    const problem = idProblem(p.slug, generated, existing[p.slug])
    if (problem) out.problems.push(problem)
    out.data[p.slug] = withCurated(generated, existing[p.slug])
  }
  return out
}
