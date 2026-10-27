/* Which artifact each team of a set gets: one each, none twice, by how much
 * the teams played them, never by the model's numbers.
 *
 * 1. This season's teams take artifacts they were recorded with. Among the
 *    ways to give them out, the one with the most games played on the
 *    artifacts given wins, and of equal ways the first found, which leaves an
 *    artifact with the team on the earlier map.
 * 2. A team left without one takes the free artifact its kind of team played
 *    most this season, then the season's most played, maps in order.
 * 3. Last season's teams take the first free artifact on their `like` list,
 *    maps in order.
 *
 * With five maps a team's artifact is always one of its own or among the
 * first five it falls back to, which bounds the search (chooser.ts). */

import type { SlData } from '../data/types.ts'

export interface ArtifactClaim {
  // This season's team: each artifact it was recorded with, most used first,
  // and the games it played with it. Last season's team: none.
  own: { id: number; games: number }[]
  // Where it turns when its own are taken, first choice first.
  fallback: number[]
  before: boolean
}

const count = <K>(counts: Map<K, number>, key: K): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

// Each team's claim, from the file's games.
export function artifactClaims(
  data: SlData,
): (source: number, team: number, kind: number | null) => ArtifactClaim {
  const season = new Map<number, number>()
  const byKind = new Map<number, Map<number, number>>()
  const byTeam = new Map<number, Map<number, number>>()
  for (const [team, , , artifact] of data.games) {
    if (artifact === null) continue
    count(season, artifact)
    const kind = data.teams[team]!.family
    if (kind !== null) {
      if (!byKind.has(kind)) byKind.set(kind, new Map())
      count(byKind.get(kind)!, artifact)
    }
    if (!byTeam.has(team)) byTeam.set(team, new Map())
    count(byTeam.get(team)!, artifact)
  }
  const fallbackOf = (kind: number | null): number[] => {
    const used = (kind === null ? undefined : byKind.get(kind)) ?? new Map<number, number>()
    return [...season.keys()].sort(
      (a, b) => (used.get(b) ?? 0) - (used.get(a) ?? 0) || season.get(b)! - season.get(a)! || a - b,
    )
  }
  return (source, team, kind) => {
    if (source !== 0) return { own: [], fallback: data.before!.teams[team]!.like, before: true }
    const games = byTeam.get(team)
    const own = data.teams[team]!.artifacts.map(([id]) => ({ id, games: games?.get(id) ?? 0 }))
    return {
      own,
      fallback: fallbackOf(kind).filter((id) => !own.some((o) => o.id === id)),
      before: false,
    }
  }
}

// The artifact of each claim, in map order; null only when no artifact is free.
export function handOutArtifacts(claims: readonly ArtifactClaim[]): (number | null)[] {
  const out: (number | null)[] = claims.map(() => null)
  const now = claims.flatMap((c, i) => (c.before ? [] : [i]))

  let best: { games: number; ids: (number | null)[] } | null = null
  const held = new Set<number>()
  const ids: (number | null)[] = []
  const walk = (k: number, games: number): void => {
    if (k === now.length) {
      if (!best || games > best.games) best = { games, ids: [...ids] }
      return
    }
    for (const o of claims[now[k]!]!.own) {
      if (held.has(o.id)) continue
      held.add(o.id)
      ids[k] = o.id
      walk(k + 1, games + o.games)
      held.delete(o.id)
    }
    ids[k] = null
    walk(k + 1, games)
  }
  walk(0, 0)
  now.forEach((i, k) => (out[i] = best!.ids[k] ?? null))

  for (const id of out) if (id !== null) held.add(id)
  const fill = (i: number): void => {
    if (out[i] !== null) return
    const id = claims[i]!.fallback.find((a) => !held.has(a))
    if (id === undefined) return
    out[i] = id
    held.add(id)
  }
  now.forEach(fill)
  claims.forEach((c, i) => c.before && fill(i))
  return out
}
