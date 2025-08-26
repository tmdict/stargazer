import { describe, expect, it } from 'vitest'

import { Hex } from '../../src/lib/hex'

describe('Hex', () => {
  describe('constructor', () => {
    it('should create a valid hex with q + r + s = 0', () => {
      const hex = new Hex(1, -2, 1)
      expect(hex.q).toBe(1)
      expect(hex.r).toBe(-2)
      expect(hex.s).toBe(1)
    })

    it('should throw error when q + r + s != 0', () => {
      expect(() => new Hex(1, 2, 3)).toThrow('q=1 + r=2 + s=3 must be 0')
    })

    it('should have default id of -1', () => {
      const hex = new Hex(1, -1, 0)
      expect(hex.id).toBe(-1)
    })

    it('should accept custom id', () => {
      const hex = new Hex(1, -1, 0, 42)
      expect(hex.id).toBe(42)
    })
  })

  describe('id management', () => {
    it('should set and get id', () => {
      const hex = new Hex(0, 0, 0)
      hex.setId(100)
      expect(hex.getId()).toBe(100)
      expect(hex.id).toBe(100)
    })
  })

  describe('equals', () => {
    it('should return true for hexes with same coordinates', () => {
      const hex1 = new Hex(1, -2, 1)
      const hex2 = new Hex(1, -2, 1, 99)
      expect(hex1.equals(hex2)).toBe(true)
    })

    it('should return false for hexes with different coordinates', () => {
      const hex1 = new Hex(1, -2, 1)
      const hex2 = new Hex(2, -2, 0)
      expect(hex1.equals(hex2)).toBe(false)
    })
  })

  describe('toString', () => {
    it('should return comma-separated coordinates', () => {
      const hex = new Hex(1, -2, 1)
      expect(hex.toString()).toBe('1,-2,1')
    })

    it('should handle negative values', () => {
      const hex = new Hex(-3, 2, 1)
      expect(hex.toString()).toBe('-3,2,1')
    })
  })

  describe('mathematical operations', () => {
    describe('add', () => {
      it('should add two hexes correctly', () => {
        const hex1 = new Hex(1, -2, 1)
        const hex2 = new Hex(2, -1, -1)
        const result = hex1.add(hex2)
        expect(result.q).toBe(3)
        expect(result.r).toBe(-3)
        expect(result.s).toBe(0)
      })

      it('should handle adding zero hex', () => {
        const hex1 = new Hex(1, -2, 1)
        const hex2 = new Hex(0, 0, 0)
        const result = hex1.add(hex2)
        expect(result.equals(hex1)).toBe(true)
      })
    })

    describe('subtract', () => {
      it('should subtract two hexes correctly', () => {
        const hex1 = new Hex(3, -3, 0)
        const hex2 = new Hex(2, -1, -1)
        const result = hex1.subtract(hex2)
        expect(result.q).toBe(1)
        expect(result.r).toBe(-2)
        expect(result.s).toBe(1)
      })

      it('should handle subtracting same hex', () => {
        const hex = new Hex(1, -2, 1)
        const result = hex.subtract(hex)
        expect(result.q).toBe(0)
        expect(result.r).toBe(0)
        expect(result.s).toBe(0)
      })
    })

    describe('scale', () => {
      it('should scale hex by positive factor', () => {
        const hex = new Hex(1, -2, 1)
        const result = hex.scale(3)
        expect(result.q).toBe(3)
        expect(result.r).toBe(-6)
        expect(result.s).toBe(3)
      })

      it('should scale hex by negative factor', () => {
        const hex = new Hex(1, -2, 1)
        const result = hex.scale(-2)
        expect(result.q).toBe(-2)
        expect(result.r).toBe(4)
        expect(result.s).toBe(-2)
      })

      it('should return zero hex when scaled by 0', () => {
        const hex = new Hex(1, -2, 1)
        const result = hex.scale(0)
        expect(result.q).toBeCloseTo(0)
        expect(result.r).toBeCloseTo(0)
        expect(result.s).toBeCloseTo(0)
      })
    })

    describe('distance', () => {
      it('should calculate distance between adjacent hexes', () => {
        const hex1 = new Hex(0, 0, 0)
        const hex2 = new Hex(1, -1, 0)
        expect(hex1.distance(hex2)).toBe(1)
      })

      it('should calculate distance between distant hexes', () => {
        const hex1 = new Hex(0, 0, 0)
        const hex2 = new Hex(2, -3, 1)
        expect(hex1.distance(hex2)).toBe(3)
      })

      it('should return 0 for same hex', () => {
        const hex = new Hex(1, -2, 1)
        expect(hex.distance(hex)).toBe(0)
      })

      it('should handle negative coordinates', () => {
        const hex1 = new Hex(-2, 1, 1)
        const hex2 = new Hex(2, -1, -1)
        expect(hex1.distance(hex2)).toBe(4)
      })
    })
  })

  describe('neighbor operations', () => {
    describe('neighbor', () => {
      it('should return correct neighbor for each direction', () => {
        const hex = new Hex(0, 0, 0)

        const neighbor0 = hex.neighbor(0)
        expect(neighbor0.q).toBe(1)
        expect(neighbor0.r).toBe(-1)
        expect(neighbor0.s).toBe(0)

        const neighbor1 = hex.neighbor(1)
        expect(neighbor1.q).toBe(1)
        expect(neighbor1.r).toBe(0)
        expect(neighbor1.s).toBe(-1)

        const neighbor2 = hex.neighbor(2)
        expect(neighbor2.q).toBe(0)
        expect(neighbor2.r).toBe(1)
        expect(neighbor2.s).toBe(-1)

        const neighbor3 = hex.neighbor(3)
        expect(neighbor3.q).toBe(-1)
        expect(neighbor3.r).toBe(1)
        expect(neighbor3.s).toBe(0)

        const neighbor4 = hex.neighbor(4)
        expect(neighbor4.q).toBe(-1)
        expect(neighbor4.r).toBe(0)
        expect(neighbor4.s).toBe(1)

        const neighbor5 = hex.neighbor(5)
        expect(neighbor5.q).toBe(0)
        expect(neighbor5.r).toBe(-1)
        expect(neighbor5.s).toBe(1)
      })

      it('should wrap direction indices correctly', () => {
        const hex = new Hex(0, 0, 0)
        const neighbor6 = hex.neighbor(6)
        const neighbor0 = hex.neighbor(0)
        expect(neighbor6.equals(neighbor0)).toBe(true)

        const neighbor7 = hex.neighbor(7)
        const neighbor1 = hex.neighbor(1)
        expect(neighbor7.equals(neighbor1)).toBe(true)
      })

      it('should handle negative direction indices', () => {
        const hex = new Hex(0, 0, 0)
        const neighborNeg1 = hex.neighbor(-1)
        const neighbor5 = hex.neighbor(5)
        // With proper modulo: ((-1 % 6) + 6) % 6 = 5
        expect(neighborNeg1.equals(neighbor5)).toBe(true)

        const neighborNeg7 = hex.neighbor(-7)
        // -7 should wrap to 5: ((-7 % 6) + 6) % 6 = 5
        expect(neighborNeg7.equals(neighbor5)).toBe(true)
      })
    })

    describe('getNeighbors', () => {
      it('should return all 6 neighbors', () => {
        const hex = new Hex(0, 0, 0)
        const neighbors = hex.getNeighbors()
        expect(neighbors).toHaveLength(6)
      })

      it('should return neighbors in correct order', () => {
        const hex = new Hex(0, 0, 0)
        const neighbors = hex.getNeighbors()

        expect(neighbors[0].equals(new Hex(1, -1, 0))).toBe(true)
        expect(neighbors[1].equals(new Hex(1, 0, -1))).toBe(true)
        expect(neighbors[2].equals(new Hex(0, 1, -1))).toBe(true)
        expect(neighbors[3].equals(new Hex(-1, 1, 0))).toBe(true)
        expect(neighbors[4].equals(new Hex(-1, 0, 1))).toBe(true)
        expect(neighbors[5].equals(new Hex(0, -1, 1))).toBe(true)
      })

      it('should work for non-origin hex', () => {
        const hex = new Hex(2, -3, 1)
        const neighbors = hex.getNeighbors()
        expect(neighbors).toHaveLength(6)

        expect(neighbors[0].equals(new Hex(3, -4, 1))).toBe(true)
        expect(neighbors[3].equals(new Hex(1, -2, 1))).toBe(true)
      })
    })
  })

  describe('static methods', () => {
    describe('getNeighborCoordinates', () => {
      it('should return correct neighbor coordinates', () => {
        const neighbors = Hex.getNeighborCoordinates(0, 0, 0)
        expect(neighbors).toHaveLength(6)

        expect(neighbors[0]).toEqual({ q: 1, r: -1, s: 0 })
        expect(neighbors[1]).toEqual({ q: 1, r: 0, s: -1 })
        expect(neighbors[2]).toEqual({ q: 0, r: 1, s: -1 })
        expect(neighbors[3]).toEqual({ q: -1, r: 1, s: 0 })
        expect(neighbors[4]).toEqual({ q: -1, r: 0, s: 1 })
        expect(neighbors[5]).toEqual({ q: 0, r: -1, s: 1 })
      })

      it('should work for non-origin coordinates', () => {
        const neighbors = Hex.getNeighborCoordinates(2, -3, 1)
        expect(neighbors).toHaveLength(6)

        expect(neighbors[0]).toEqual({ q: 3, r: -4, s: 1 })
        expect(neighbors[3]).toEqual({ q: 1, r: -2, s: 1 })
      })
    })

    describe('fromAxial', () => {
      it('should convert axial coordinates to cube', () => {
        const hex = Hex.fromAxial(2, -3)
        expect(hex.q).toBe(2)
        expect(hex.r).toBe(-3)
        expect(hex.s).toBe(1)
      })

      it('should maintain q + r + s = 0 constraint', () => {
        const hex = Hex.fromAxial(5, -2)
        expect(hex.q + hex.r + hex.s).toBe(0)
      })

      it('should handle zero coordinates', () => {
        const hex = Hex.fromAxial(0, 0)
        expect(hex.q).toBeCloseTo(0)
        expect(hex.r).toBeCloseTo(0)
        expect(hex.s).toBeCloseTo(0)
      })

      it('should handle negative coordinates', () => {
        const hex = Hex.fromAxial(-3, 4)
        expect(hex.q).toBe(-3)
        expect(hex.r).toBe(4)
        expect(hex.s).toBe(-1)
      })
    })
  })
})
