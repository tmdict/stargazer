/* A team's kind, the group in the data file it belongs with, for teams the
 * file holds as other heroes or not at all. Five heroes recorded as a team
 * this season, on any map, take that team's group. Otherwise the recorded
 * teams sharing the most heroes with it, at least 3, vote, one vote a team,
 * and the group with the most votes wins, the one listed first in the file on
 * a tie. A team outside every group has no vote, and a team with no votes is
 * outside every group (null). */

import { lineupKey } from './games.ts'
import type { SlTeam } from './types.ts'

export type KindOf = (heroes: readonly number[]) => number | null

const MIN_SHARED = 3

// The group with the most votes, the lower index on a tie, a vote for no
// group last.
const winner = (votes: ReadonlyMap<number | null, number>): number | null => {
  let best: number | null = null
  let most = -1
  for (const [kind, n] of votes) {
    if (n > most || (n === most && kind !== null && (best === null || kind < best))) {
      best = kind
      most = n
    }
  }
  return best
}

export function kindRule(teams: readonly Pick<SlTeam, 'heroes' | 'family'>[]): KindOf {
  const recorded = new Map<string, Map<number | null, number>>()
  for (const t of teams) {
    const key = lineupKey(t.heroes)
    const votes = recorded.get(key) ?? new Map<number | null, number>()
    votes.set(t.family, (votes.get(t.family) ?? 0) + 1)
    recorded.set(key, votes)
  }
  return (heroes) => {
    const own = recorded.get(lineupKey(heroes))
    if (own) return winner(own)
    const picked = new Set(heroes)
    let most = MIN_SHARED
    let votes = new Map<number | null, number>()
    for (const t of teams) {
      const shared = t.heroes.filter((h) => picked.has(h)).length
      if (shared < most) continue
      if (shared > most) {
        most = shared
        votes = new Map()
      }
      if (t.family !== null) votes.set(t.family, (votes.get(t.family) ?? 0) + 1)
    }
    return votes.size ? winner(votes) : null
  }
}
