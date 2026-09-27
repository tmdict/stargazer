import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'

describe('Hex', () => {
  describe('coordinate operations', () => {
    it('calculates distance correctly', () => {
      const hex1 = new Hex(0, 0, 0)

      // Adjacent hex
      expect(hex1.distance(new Hex(1, -1, 0))).toBe(1)

      // Same hex
      expect(hex1.distance(hex1)).toBe(0)

      // Distant hex
      expect(hex1.distance(new Hex(2, -3, 1))).toBe(3)

      // Negative coordinates
      expect(new Hex(-2, 1, 1).distance(new Hex(2, -1, -1))).toBe(4)
    })
  })

  describe('neighbor operations', () => {
    it('wraps direction indices correctly', () => {
      const hex = new Hex(0, 0, 0)
      expect(hex.neighbor(6).equals(hex.neighbor(0))).toBe(true)
      expect(hex.neighbor(7).equals(hex.neighbor(1))).toBe(true)
      expect(hex.neighbor(-1).equals(hex.neighbor(5))).toBe(true)
    })
  })
})
