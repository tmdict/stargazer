/* The shape every prediction model fits. A model learns from one season's
 * decided games and then answers three questions: who should win a match-up
 * and by how much, how strong a team is against a typical opponent, and what
 * a match-up's answer adds up from. The pages ask only these, so a model can
 * be added beside another without either page changing. */

import type { Game, Side } from '../data/games'

export type { Game, Side }

// gap: the upgrade gap toward A in Rivalry points.
export interface Matchup {
  a: Side
  b: Side
  gap: number
}

export type Reason = 'heroes' | 'counters' | 'artifacts' | 'upgrades'

export const REASONS: readonly Reason[] = ['heroes', 'counters', 'artifacts', 'upgrades']

// One line under a reason: a hero, the five heroes together, an empty slot, or
// the artifact of one side, with its number toward that side on the edge's
// scale.
export interface ReasonItem {
  side: 'a' | 'b'
  subject: 'hero' | 'lineup' | 'empty' | 'artifact'
  // The hero or artifact id; null for the lineup and an empty slot.
  id: number | null
  value: number
}

export interface Explanation {
  // Each reason's share of the edge; they add up to it.
  parts: Record<Reason, number>
  items: Partial<Record<Reason, ReasonItem[]>>
}

// Every answer is on the edge's scale, the log-odds of A winning.
export interface Model {
  edge(m: Matchup): number
  // A side against a typical opponent of the season at the top levels, the
  // side `gap` Rivalry points from them.
  againstTypical(side: Side, gap: number): number
  explain(m: Matchup): Explanation
}

export interface ModelKind {
  id: string
  learn(games: Game[]): Model
}
