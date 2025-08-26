import { DIAGONAL_ROWS } from '../../types/grid'

/**
 * Pre-computed symmetry map for O(1) lookups
 * Maps each hex ID to its symmetrical counterpart
 */
const SYMMETRY_MAP: Map<number, number> = new Map()

// Build the symmetry map on module load
function buildSymmetryMap(): void {
  const middleRow = 7 // Row 8 (index 7) is the middle diagonal

  for (let row = 0; row < DIAGONAL_ROWS.length; row++) {
    const targetRow = 2 * middleRow - row

    // Skip if target row doesn't exist or is the same (middle diagonal)
    if (targetRow < 0 || targetRow >= DIAGONAL_ROWS.length) continue

    const sourceArray = DIAGONAL_ROWS[row]
    const targetArray = DIAGONAL_ROWS[targetRow]

    if (!sourceArray || !targetArray) {
      console.warn('symmetry: Skipping undefined diagonal arrays in buildSymmetryMap', {
        row,
        targetRow,
        sourceArrayExists: !!sourceArray,
        targetArrayExists: !!targetArray,
      })
      continue
    }

    // Mirror across diagonal: same position in mirrored row
    // First maps to first, last maps to last (not reversed)
    for (let pos = 0; pos < sourceArray.length; pos++) {
      if (pos >= targetArray.length) break // Bounds check

      const sourceId = sourceArray[pos]
      const targetId = targetArray[pos] // Same position, not reversed

      if (sourceId === undefined || targetId === undefined) {
        console.warn('symmetry: Skipping undefined hex IDs', {
          pos,
          row,
          targetRow,
          sourceId,
          targetId,
        })
        continue
      }

      SYMMETRY_MAP.set(sourceId, targetId)
      SYMMETRY_MAP.set(targetId, sourceId) // Bidirectional
    }
  }

  // Middle diagonal maps to itself
  const middleDiagonal = DIAGONAL_ROWS[middleRow]
  if (!middleDiagonal) {
    console.error('symmetry: Middle diagonal array is undefined', {
      middleRow,
      diagonalRowsLength: DIAGONAL_ROWS.length,
    })
    return
  }

  for (const hexId of middleDiagonal) {
    if (hexId !== undefined) {
      SYMMETRY_MAP.set(hexId, hexId)
    }
  }
}

// Initialize the map
buildSymmetryMap()

/**
 * Get the symmetrical hex ID for a given hex ID
 * O(1) lookup time
 */
export function getSymmetricalHexId(hexId: number): number | undefined {
  return SYMMETRY_MAP.get(hexId)
}

/**
 * Check if a hex is on the middle diagonal
 */
export function isOnMiddleDiagonal(hexId: number): boolean {
  const symmetricalId = SYMMETRY_MAP.get(hexId)
  return symmetricalId === hexId
}
