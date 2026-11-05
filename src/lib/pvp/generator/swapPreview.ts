/* A swap tried on a board as the page draws it: the engine places the heroes
 * swapped in with every unit that stays kept on its tile, and the chance to win
 * the map is counted as it is for the chosen team. */

import { placeTeam } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { SlData, SlUnit } from '../data/types'
import type { SlReader } from '../model/reader'
import { boardChance, levelGap } from './chance'
import type { SlFit } from './fit'
import { boardPlacement, boardTeam, heldOn } from './formation'
import type { SlBoard } from './setType'
import { homeMap } from './team'
import type { SlChoiceTeam, SlPick } from './types'

export interface SwapRequest {
  board: SlBoard
  team: Pick<SlChoiceTeam, 'source' | 'team' | 'family' | 'heroes' | 'artifact'>
  // The board's units as drawn.
  units: SlUnit[]
  // The heroes swapped out, and those that take their places, in the same order.
  out: number[]
  into: number[]
  picks: SlPick[]
}

export interface SwapPreview {
  // The units that join, each on the tile it takes.
  joined: SlUnit[]
  // The tiles of the units that leave: the heroes swapped out, their
  // companions, and a phantimal the new lineup no longer summons.
  left: number[]
  chance: number
}

export function previewSwap(
  data: SlData,
  { model }: SlReader,
  fit: SlFit,
  counts: (artifact: number) => boolean,
  { board, team, units, out, into, picks }: SwapRequest,
): SwapPreview {
  const heroes = team.heroes.map((id) => (out.includes(id) ? into[out.indexOf(id)]! : id))
  const placed = placeTeam(
    boardTeam(data, heroes, team.artifact),
    board.layout,
    boardPlacement(data, board, team),
    PLACEMENT_LOOKUPS,
    { held: heldOn(units) },
  )
  const drawn = new Set(units.map(([, unit]) => unit))
  const stays = new Set(placed.units)
  const { artifact } = team
  const side = {
    heroes,
    kind: team.family,
    artifact: artifact !== null && counts(artifact) ? artifact : null,
  }
  const levels = new Map(picks.map((pick) => [pick.id, pick]))
  return {
    joined: placed.units.flatMap((unit, i): SlUnit[] =>
      drawn.has(unit) ? [] : [[placed.positions[i]!, unit]],
    ),
    left: units.flatMap(([hexId, unit]) => (stays.has(unit) ? [] : [hexId])),
    chance: boardChance(
      model,
      side,
      levelGap(data.prices, levels, heroes),
      fit.measure(board, heroes, homeMap(data, team)),
    ),
  }
}
