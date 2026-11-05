/* Which artifact each team of a set gets: one each, none twice, by how much
 * the teams played them, never by the model's numbers.
 *
 * 1. Teams take artifacts they were recorded with this season. Among the ways
 *    to give them out, the one with the most games played on the artifacts
 *    given wins, and of equal ways the first found, which leaves an artifact
 *    with the team on the earlier board.
 * 2. A team left without one, such as one only earlier seasons recorded,
 *    takes the first free artifact of its group's fallback list in the file,
 *    boards in order.
 *
 * A team's artifact is always one of its own or among the first it falls back
 * to, as many as there are boards, which bounds the search (chooser.ts). The
 * file picks a team's board for every artifact it can end up with this way. */

import type { SlData, SlTeam } from '../data/types'

export interface ArtifactClaim {
  // Each artifact the team was recorded with this season, most used first, and
  // the games it played with it.
  own: { id: number; games: number }[]
  // Where it turns when its own are taken, first choice first.
  fallback: number[]
}

export const artifactClaims =
  (data: SlData) =>
  ({ artifacts, family }: Pick<SlTeam, 'artifacts' | 'family'>): ArtifactClaim => {
    const own = artifacts.map(([id, games]) => ({ id, games }))
    const list = data.fallback[family ?? data.fallback.length - 1]!
    return { own, fallback: list.filter((id) => !own.some((o) => o.id === id)) }
  }

// The artifact of each claim, in board order; null only when no artifact is free.
export function handOutArtifacts(claims: readonly ArtifactClaim[]): (number | null)[] {
  let best: { games: number; ids: (number | null)[] } | null = null
  const held = new Set<number>()
  const ids: (number | null)[] = []
  const walk = (k: number, games: number): void => {
    if (k === claims.length) {
      if (!best || games > best.games) best = { games, ids: [...ids] }
      return
    }
    for (const o of claims[k]!.own) {
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
  const out = [...best!.ids]

  for (const id of out) if (id !== null) held.add(id)
  claims.forEach((claim, i) => {
    if (out[i] !== null) return
    const id = claim.fallback.find((a) => !held.has(a))
    if (id === undefined) return
    out[i] = id
    held.add(id)
  })
  return out
}
