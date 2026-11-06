/* A swap tried on a board as the page draws it: the engine places the heroes
 * swapped in with every unit that stays kept on its tile. */

import { placeTeam } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { SlData, SlUnit } from '../data/types'
import { boardPlacement, boardTeam, heldOn } from './formation'
import type { SlBoard } from './setType'
import type { SlChoiceTeam } from './types'

export interface SwapRequest {
  board: SlBoard
  team: Pick<SlChoiceTeam, 'source' | 'team' | 'family' | 'heroes' | 'artifact'>
  // The board's units as drawn.
  units: SlUnit[]
  // The heroes swapped out, and those that take their places, in the same order.
  out: number[]
  into: number[]
}

export interface SwapPreview {
  // The units that join, each on the tile it takes.
  joined: SlUnit[]
  // The tiles of the units that leave: the heroes swapped out, their
  // companions, and a phantimal the new lineup no longer summons.
  left: number[]
}

export function previewSwap(
  data: SlData,
  { board, team, units, out, into }: SwapRequest,
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
  return {
    joined: placed.units.flatMap((unit, i): SlUnit[] =>
      drawn.has(unit) ? [] : [[placed.positions[i]!, unit]],
    ),
    left: units.flatMap(([hexId, unit]) => (stays.has(unit) ? [] : [hexId])),
  }
}
