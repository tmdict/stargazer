/**
 * Diagonal rows organized by hex IDs - visually represents the hex grid structure
 * Each array represents a diagonal line from upper-left to lower-right
 * Row 8 (index 7) contains [22, 23, 24] which is the middle diagonal
 */
export const DIAGONAL_ROWS: readonly number[][] = [
  [1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7], // Row 3
  [8, 9, 10], // Row 4
  [11, 12, 13, 14], // Row 5
  [15, 16, 17], // Row 6
  [18, 19, 20, 21], // Row 7
  [22, 23, 24], // Row 8 - MIDDLE DIAGONAL
  [25, 26, 27, 28], // Row 9
  [29, 30, 31], // Row 10
  [32, 33, 34, 35], // Row 11
  [36, 37, 38], // Row 12
  [39, 40], // Row 13
  [41, 42, 43], // Row 14
  [44, 45], // Row 15
]

/**
 * Get the diagonal row number for a given hex ID.
 * Simple lookup in the DIAGONAL_ROWS array.
 */
export function getDiagonalRowNumber(hexId: number): number {
  for (let rowIndex = 0; rowIndex < DIAGONAL_ROWS.length; rowIndex++) {
    if (DIAGONAL_ROWS[rowIndex].includes(hexId)) {
      return rowIndex + 1 // Row numbers start at 1
    }
  }

  // Hex ID not found in our grid - shouldn't happen in normal usage
  return -1
}

/**
 * Check if two hexes are in the same diagonal row based on hex ID patterns.
 */
export function areHexesInSameDiagonalRow(hexId1: number, hexId2: number): boolean {
  return getDiagonalRowNumber(hexId1) === getDiagonalRowNumber(hexId2)
}
