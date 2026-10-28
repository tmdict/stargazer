/* The generator's input, the heroes a visitor picks at their levels, and its
 * answer, the set of five recorded teams. */

import type { SlLevels } from '../data/upgrades.ts'

export interface SlPick extends SlLevels {
  id: number
}

export interface SlChoiceTeam {
  // 0 for this season's teams, 1 for the season before's.
  source: number
  // Index into that season's teams.
  team: number
  heroes: number[]
  // Index into that season's families; null outside every group.
  family: number | null
  chance: number
  // The comp's [players, wins, losses] on this map.
  comp: [number, number, number] | null
  artifact: number | null
  // Index into the team's placements: the board drawn.
  placement: number
  core: number[]
  flex: { out: number; options: number[] }[]
  // Two-hero swaps: two heroes out, and the pairs that can take their places.
  pairs: { out: number[]; options: number[][] }[]
}

export interface SlChoice {
  // Index into SlData.evidence.
  evidence: number
  chance: number
  // The chance of winning each number of maps, 0 to 5.
  odds: number[]
  // One per board, in board order.
  teams: SlChoiceTeam[]
}
