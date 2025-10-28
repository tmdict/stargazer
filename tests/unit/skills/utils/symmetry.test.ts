import { describe, expect, it } from 'vitest'

import { getSymmetricalHexId, isOnMiddleDiagonal } from '@/lib/skills/utils/symmetry'
import { DIAGONAL_ROWS } from '@/lib/types/grid'

describe('symmetry', () => {
  describe('getSymmetricalHexId', () => {
    it('returns correct symmetrical hex for top row', () => {
      // Row 1 (index 0) should map to Row 15 (index 14)
      const topRowHex = 23
      const symmetrical = getSymmetricalHexId(topRowHex)
      expect(symmetrical).toBeDefined()
      // Verify it's actually symmetrical (bidirectional)
      expect(getSymmetricalHexId(symmetrical!)).toBe(topRowHex)
    })

    it('returns correct symmetrical hex for bottom row', () => {
      // Row 15 (index 14) should map to Row 1 (index 0)
      const bottomRowHex = 45
      const symmetrical = getSymmetricalHexId(bottomRowHex)
      expect(symmetrical).toBeDefined()
      // Verify it's actually symmetrical (bidirectional)
      expect(getSymmetricalHexId(symmetrical!)).toBe(bottomRowHex)
    })

    it('maps middle diagonal to itself', () => {
      // Row 8 (index 7) is the middle diagonal
      const middleRow = DIAGONAL_ROWS[7]
      if (middleRow) {
        for (const hexId of middleRow) {
          if (hexId !== undefined) {
            expect(getSymmetricalHexId(hexId)).toBe(hexId)
          }
        }
      }
    })

    it('provides bidirectional mapping', () => {
      // Test that A→B and B→A
      const hexId = 1
      const symmetrical = getSymmetricalHexId(hexId)
      expect(symmetrical).toBeDefined()
      if (symmetrical !== undefined) {
        expect(getSymmetricalHexId(symmetrical)).toBe(hexId)
      }
    })

    it('maps hexes within same position in row', () => {
      // First position in row 2 maps to first position in row 14
      const row2First = DIAGONAL_ROWS[1]?.[0] // Hex 13
      const row14First = DIAGONAL_ROWS[13]?.[0] // Hex 44

      if (row2First !== undefined && row14First !== undefined) {
        expect(getSymmetricalHexId(row2First)).toBe(row14First)
        expect(getSymmetricalHexId(row14First)).toBe(row2First)
      }
    })

    it('handles all valid hex IDs', () => {
      // Test all hex IDs from 1 to 45
      for (let hexId = 1; hexId <= 45; hexId++) {
        const symmetrical = getSymmetricalHexId(hexId)
        expect(symmetrical).toBeDefined()
        expect(symmetrical).toBeGreaterThanOrEqual(1)
        expect(symmetrical).toBeLessThanOrEqual(45)
      }
    })

    it('returns undefined for invalid hex IDs', () => {
      expect(getSymmetricalHexId(0)).toBeUndefined()
      expect(getSymmetricalHexId(46)).toBeUndefined()
      expect(getSymmetricalHexId(-1)).toBeUndefined()
      expect(getSymmetricalHexId(100)).toBeUndefined()
    })

    it('maintains row structure in symmetry', () => {
      // Check that rows with same length map correctly
      const testRows = [
        { rowIndex: 0, length: 1 }, // Row 1
        { rowIndex: 14, length: 1 }, // Row 15
        { rowIndex: 3, length: 7 }, // Row 4
        { rowIndex: 11, length: 7 }, // Row 12
      ]

      for (const { rowIndex } of testRows) {
        const row = DIAGONAL_ROWS[rowIndex]
        const targetRowIndex = 14 - rowIndex
        const targetRow = DIAGONAL_ROWS[targetRowIndex]

        if (row && targetRow) {
          expect(row.length).toBe(targetRow.length)
        }
      }
    })
  })

  describe('isOnMiddleDiagonal', () => {
    it('correctly identifies middle diagonal hexes', () => {
      // Row 8 (index 7) is the middle diagonal
      const middleRow = DIAGONAL_ROWS[7]
      if (middleRow) {
        for (const hexId of middleRow) {
          if (hexId !== undefined) {
            expect(isOnMiddleDiagonal(hexId)).toBe(true)
          }
        }
      }
    })

    it('correctly identifies non-middle diagonal hexes', () => {
      // Test hexes that are definitely not on middle diagonal
      // We need to pick hexes we know aren't self-mapping
      const hex1 = 1
      const hex1Symmetrical = getSymmetricalHexId(hex1)

      // If hex1 maps to itself, it's on middle diagonal
      // If not, it shouldn't be on middle diagonal
      if (hex1Symmetrical === hex1) {
        // Hex 1 is on middle diagonal
        expect(isOnMiddleDiagonal(hex1)).toBe(true)
      } else {
        // Hex 1 is not on middle diagonal
        expect(isOnMiddleDiagonal(hex1)).toBe(false)
      }

      // Test a few hexes and verify consistency
      for (let hexId = 1; hexId <= 45; hexId++) {
        const symmetrical = getSymmetricalHexId(hexId)
        const onMiddle = isOnMiddleDiagonal(hexId)

        if (symmetrical === hexId) {
          expect(onMiddle).toBe(true)
        } else {
          expect(onMiddle).toBe(false)
        }
      }
    })

    it('handles invalid hex IDs', () => {
      expect(isOnMiddleDiagonal(0)).toBe(false)
      expect(isOnMiddleDiagonal(-1)).toBe(false)
      expect(isOnMiddleDiagonal(100)).toBe(false)
    })
  })

  describe('symmetry consistency', () => {
    it('ensures all hexes have valid symmetrical mappings', () => {
      let validMappings = 0
      let totalHexes = 0

      for (const row of DIAGONAL_ROWS) {
        if (row) {
          for (const hexId of row) {
            if (hexId !== undefined) {
              totalHexes++
              const symmetrical = getSymmetricalHexId(hexId)
              if (symmetrical !== undefined) {
                validMappings++
              }
            }
          }
        }
      }

      expect(validMappings).toBe(totalHexes)
      expect(totalHexes).toBe(45) // Total hexes in the grid
    })

    it('maintains symmetry invariants', () => {
      // For any hex not on middle diagonal:
      // distance from top = symmetrical hex's distance from bottom
      const topRowHexes = DIAGONAL_ROWS[0] || []
      const bottomRowHexes = DIAGONAL_ROWS[14] || []

      for (const hexId of topRowHexes) {
        if (hexId !== undefined) {
          const symmetrical = getSymmetricalHexId(hexId)
          expect(bottomRowHexes).toContain(symmetrical)
        }
      }
    })
  })
})
