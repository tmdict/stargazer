import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'

describe('Hex', () => {
  describe('constructor', () => {
    it('creates hex with valid coordinates', () => {
      const hex = new Hex(1, -2, 1)
      expect(hex.q).toBe(1)
      expect(hex.r).toBe(-2)
      expect(hex.s).toBe(1)
    })

    it('creates hex at origin', () => {
      const hex = new Hex(0, 0, 0)
      expect(hex.q).toBe(0)
      expect(hex.r).toBe(0)
      expect(hex.s).toBe(0)
    })
  })

  describe('coordinate operations', () => {
    it('handles equals correctly', () => {
      const hex1 = new Hex(1, -2, 1)
      const hex2 = new Hex(1, -2, 1)
      const hex3 = new Hex(2, -2, 0)

      expect(hex1.equals(hex2)).toBe(true)
      expect(hex1.equals(hex3)).toBe(false)
      expect(hex1.equals(hex1)).toBe(true)
    })

    it('performs arithmetic operations', () => {
      const hex1 = new Hex(1, -2, 1)
      const hex2 = new Hex(2, -1, -1)

      // Add
      const sum = hex1.add(hex2)
      expect(sum.q).toBe(3)
      expect(sum.r).toBe(-3)
      expect(sum.s).toBe(0)

      // Subtract
      const diff = hex1.subtract(hex2)
      expect(diff.q).toBe(-1)
      expect(diff.r).toBe(-1)
      expect(diff.s).toBe(2)

      // Scale
      const scaled = hex1.scale(3)
      expect(scaled.q).toBe(3)
      expect(scaled.r).toBe(-6)
      expect(scaled.s).toBe(3)
    })

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
    it.each([
      [0, { q: 1, r: -1, s: 0 }],
      [1, { q: 1, r: 0, s: -1 }],
      [2, { q: 0, r: 1, s: -1 }],
      [3, { q: -1, r: 1, s: 0 }],
      [4, { q: -1, r: 0, s: 1 }],
      [5, { q: 0, r: -1, s: 1 }],
    ])('returns correct neighbor for direction %i', (direction, expected) => {
      const hex = new Hex(0, 0, 0)
      const neighbor = hex.neighbor(direction)
      expect(neighbor.q).toBe(expected.q)
      expect(neighbor.r).toBe(expected.r)
      expect(neighbor.s).toBe(expected.s)
    })

    it('wraps direction indices correctly', () => {
      const hex = new Hex(0, 0, 0)
      expect(hex.neighbor(6).equals(hex.neighbor(0))).toBe(true)
      expect(hex.neighbor(7).equals(hex.neighbor(1))).toBe(true)
      expect(hex.neighbor(-1).equals(hex.neighbor(5))).toBe(true)
    })

    it('returns all neighbors with getNeighbors()', () => {
      const hex = new Hex(0, 0, 0)
      const neighbors = hex.getNeighbors()

      expect(neighbors).toHaveLength(6)

      // Check each neighbor is distance 1 from center
      neighbors.forEach((neighbor) => {
        expect(hex.distance(neighbor)).toBe(1)
      })

      // Check all neighbors are unique
      const uniqueNeighbors = new Set(neighbors.map((n) => n.toString()))
      expect(uniqueNeighbors.size).toBe(6)
    })
  })

  describe('static methods', () => {
    it('creates hex from axial coordinates', () => {
      const hex = Hex.fromAxial(2, -3)
      expect(hex.q).toBe(2)
      expect(hex.r).toBe(-3)
      expect(hex.s).toBe(1)
    })

    it('gets neighbor coordinates without creating Hex instances', () => {
      const neighbors = Hex.getNeighborCoordinates(0, 0, 0)

      expect(neighbors).toHaveLength(6)
      expect(neighbors[0]).toEqual({ q: 1, r: -1, s: 0 })
      expect(neighbors[1]).toEqual({ q: 1, r: 0, s: -1 })
      expect(neighbors[2]).toEqual({ q: 0, r: 1, s: -1 })
      expect(neighbors[3]).toEqual({ q: -1, r: 1, s: 0 })
      expect(neighbors[4]).toEqual({ q: -1, r: 0, s: 1 })
      expect(neighbors[5]).toEqual({ q: 0, r: -1, s: 1 })
    })
  })

  describe('ID and string operations', () => {
    it('manages hex ID correctly', () => {
      const hex = new Hex(1, -2, 1)
      expect(hex.getId()).toBe(-1) // Default ID

      hex.setId(42)
      expect(hex.getId()).toBe(42)
    })

    it('converts to string correctly', () => {
      const hex = new Hex(1, -2, 1)
      expect(hex.toString()).toBe('1,-2,1')
    })
  })

  describe('edge cases', () => {
    it('throws error for invalid coordinates', () => {
      expect(() => new Hex(1, 1, 1)).toThrow('q=1 + r=1 + s=1 must be 0')
      expect(() => new Hex(0, 0, 1)).toThrow('q=0 + r=0 + s=1 must be 0')
    })

    it('handles large coordinates', () => {
      const hex = new Hex(1000, -500, -500)
      expect(hex.q).toBe(1000)
      expect(hex.r).toBe(-500)
      expect(hex.s).toBe(-500)
    })

    it('handles fractional coordinates in operations', () => {
      const hex = new Hex(1.5, -2.5, 1)
      const scaled = hex.scale(2)
      expect(scaled.q).toBe(3)
      expect(scaled.r).toBe(-5)
      expect(scaled.s).toBe(2)
    })
  })
})
