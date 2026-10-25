import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'

describe('Hex', () => {
  describe('coordinate operations', () => {
    it('calculates distance correctly', () => {
      const hex1 = new Hex(0, 0, 0)

      expect(hex1.distance(new Hex(1, -1, 0))).toBe(1)
      expect(hex1.distance(hex1)).toBe(0)
      expect(hex1.distance(new Hex(2, -3, 1))).toBe(3)
      expect(new Hex(-2, 1, 1).distance(new Hex(2, -1, -1))).toBe(4)
    })
  })
})
