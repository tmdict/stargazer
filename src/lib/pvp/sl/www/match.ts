/* Who Would Win?'s games: each a team on each side with its heroes' levels
 * and its artifact, and a match's result from its five games' chances, each
 * game won or lost on its own as the generator takes its boards. */

import { oddsInto } from '../model/odds.ts'
import type { Pair } from './panel.ts'

export const WWW_GAMES = 5

export interface WwwSlotHero {
  id: number
  paragon: number
  refinement: number
}

export interface WwwTeamState {
  heroes: (WwwSlotHero | null)[]
  artifact: number | null
}

export type WwwGame = Pair<WwwTeamState>

export type WwwLevelAttr = 'paragon' | 'refinement'

export interface WwwMatchOdds {
  // A's chance to win the match: more than half of its games.
  chance: number
  // A's chance of winning exactly k games, at index k.
  wins: number[]
}

export function matchOdds(chances: readonly number[]): WwwMatchOdds {
  const wins = [...oddsInto(chances, new Float64Array(chances.length + 1))]
  const needed = Math.floor(chances.length / 2) + 1
  return { chance: wins.slice(needed).reduce((sum, p) => sum + p, 0), wins }
}
