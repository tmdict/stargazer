/* Where an Honor Duel board draws its off-field spots. Like the artifact host
 * cells they are off-grid hexes that hold no tile, so placement, pathfinding
 * and targeting never see them: six a side, on the cells the side's back rows
 * leave free. None lies further left or right than the board's widest row, so
 * a board drawn as wide as a phone's screen still shows them whole. */

import type { Grid } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { Team } from '@/lib/types/team'
import { DUEL_SPOT_COUNT } from './board'

const EAST = 1
const WEST = 4

// The ally side's spots in spot order, each so many steps from a tile on the
// board's lower edge: five beside the lower right rows, and the sixth past the
// artifact place.
const ALLY_SPOTS: readonly { anchor: number; direction: number; steps: number }[] = [
  { anchor: 3, direction: EAST, steps: 1 },
  { anchor: 3, direction: EAST, steps: 2 },
  { anchor: 3, direction: EAST, steps: 3 },
  { anchor: 11, direction: EAST, steps: 1 },
  { anchor: 18, direction: EAST, steps: 1 },
  { anchor: 1, direction: WEST, steps: 2 },
]

export const DUEL_SPOTS: readonly number[] = Array.from(
  { length: DUEL_SPOT_COUNT },
  (_, index) => index + 1,
)

// The enemy's spots are the ally's turned half a circle about the board's
// center, as the board's two halves are.
export function duelSpotHex(grid: Grid, team: Team, spot: number): Hex {
  const { anchor, direction, steps } = ALLY_SPOTS[spot - 1]!
  let hex = grid.getHexById(anchor)
  for (let step = 0; step < steps; step++) hex = hex.neighbor(direction)
  return team === Team.ALLY ? hex : new Hex(-hex.q, -hex.r, -hex.s)
}
