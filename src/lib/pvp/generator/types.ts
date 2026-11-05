/* The generator's input, the heroes a visitor picks at their levels, and its
 * answer, the set of recorded teams, one per board. */

import type { SlRecord } from '../data/types'
import type { SlLevels } from '../data/upgrades'

export interface SlPick extends SlLevels {
  id: number
}

export interface SlChoiceTeam {
  // Index into the file's maps whose teams it comes from; null for a row of
  // everyMap.
  source: number | null
  // Index into that list.
  team: number
  heroes: number[]
  // Index into the file's families; null outside every group.
  family: number | null
  chance: number
  // The group's [players, wins, losses] on the board's map; null outside every
  // group or on a map with no records.
  comp: SlRecord | null
  artifact: number | null
  // Index into the team's placements: the board drawn.
  placement: number
  core: number[]
  flex: { out: number; options: number[] }[]
  // Two-hero swaps: two heroes out, and the pairs that can take their places.
  pairs: { out: number[]; options: number[][] }[]
}

export interface SlChoice {
  chance: number
  // The chance of winning each number of boards, from none to all.
  odds: number[]
  // One per board, in board order.
  teams: SlChoiceTeam[]
}
