import type { Grid } from '../../grid'
import { Hex } from '../../hex'

/**
 * Mirror of a hex across the board's middle diagonal (the q = r line).
 * Swapping q and r reflects the position while keeping a valid cube
 * coordinate (q + r + s stays 0), so this works on any grid, not just the
 * full arena. Returns undefined when the mirrored position is off-grid.
 * Hexes on the middle diagonal mirror to themselves.
 */
export function getSymmetricalHexId(grid: Grid, hexId: number): number | undefined {
  const hex = grid.getHexById(hexId)
  return grid.getTileOrUndefined(new Hex(hex.r, hex.q, hex.s))?.hex.getId()
}
