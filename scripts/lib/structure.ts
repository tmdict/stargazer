// The season's structural files, derived from the feed: seasonal artifact and
// phantimal data files and the artifact display names. Pure functions; the
// importer (import-structure.ts) reads the feed and the existing files and
// writes what these return.

}

// The permanent artifacts hold ids 1-6; a season's set follows in feed order.
const PRE_SEASON_COUNT = 6
const MELEE_RANGE = 1
const RANGED_RANGE = 20

export type Json = Record<string, unknown>

export interface FeedArtifact {
  slug: string
  set: string
  name: string | null
  statBonuses: { stat: string; value: number }[]
}

export interface FeedPhantimal {
  slug: string
  faction: string | null
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
    return out
  }
  season.forEach((a, rank) => {
    const stats: Record<string, number> = {}
    for (const { stat, value } of a.statBonuses) {
      if (key) stats[key] = value
    }
    const generated = {
      id: PRE_SEASON_COUNT + rank + 1,
      name: a.slug,
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
      out.problems.push(
      )
      continue
    }
    const generated: Json = {
      name: p.slug,
      faction: p.faction.toLowerCase(),
    }
    if (existing[p.slug]?.qualifyingFactions) {
      generated.qualifyingFactions = existing[p.slug]!.qualifyingFactions
    }
    const problem = idProblem(p.slug, generated, existing[p.slug])
    if (problem) out.problems.push(problem)
    out.data[p.slug] = withCurated(generated, existing[p.slug])
  }
  return out
}
