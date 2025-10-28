import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'
import { FLAT, Layout, POINTY, type Point } from '@/lib/layout'

describe('Layout', () => {
  const SQRT3 = Math.sqrt(3)

  describe('orientation constants', () => {
    it('should have correct POINTY orientation values', () => {
      expect(POINTY.f0).toBeCloseTo(SQRT3)
      expect(POINTY.f1).toBeCloseTo(SQRT3 / 2)
      expect(POINTY.f2).toBe(0)
      expect(POINTY.f3).toBeCloseTo(3 / 2)
      expect(POINTY.b0).toBeCloseTo(SQRT3 / 3)
      expect(POINTY.b1).toBeCloseTo(-1 / 3)
      expect(POINTY.b2).toBe(0)
      expect(POINTY.b3).toBeCloseTo(2 / 3)
      expect(POINTY.startAngle).toBe(0.5)
    })

    it('should have correct FLAT orientation values', () => {
      expect(FLAT.f0).toBeCloseTo(3 / 2)
      expect(FLAT.f1).toBe(0)
      expect(FLAT.f2).toBeCloseTo(SQRT3 / 2)
      expect(FLAT.f3).toBeCloseTo(SQRT3)
      expect(FLAT.b0).toBeCloseTo(2 / 3)
      expect(FLAT.b1).toBe(0)
      expect(FLAT.b2).toBeCloseTo(-1 / 3)
      expect(FLAT.b3).toBeCloseTo(SQRT3 / 3)
      expect(FLAT.startAngle).toBe(0)
    })
  })

  describe('coordinate conversion', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 100, y: 100 }
    const layout = new Layout(POINTY, size, origin)

    it('should convert hex to pixel coordinates', () => {
      expect(layout.hexToPixel(new Hex(0, 0, 0))).toEqual({ x: 100, y: 100 })

      const pixel = layout.hexToPixel(new Hex(1, 0, -1))
      expect(pixel.x).toBeCloseTo(100 + SQRT3 * 10)
      expect(pixel.y).toBeCloseTo(100)
    })

    it('should convert pixel to hex coordinates', () => {
      const hex = layout.pixelToHex({ x: 100, y: 100 })
      expect(hex.q).toBeCloseTo(0)
      expect(hex.r).toBeCloseTo(0)
      expect(hex.s).toBeCloseTo(0)
    })

    it('should maintain accuracy for round-trip conversion', () => {
      const originalHex = new Hex(2, -3, 1)
      const pixel = layout.hexToPixel(originalHex)
      const convertedHex = layout.pixelToHex(pixel)

      expect(Math.round(convertedHex.q)).toBe(originalHex.q)
      expect(Math.round(convertedHex.r)).toBe(originalHex.r)
      expect(Math.round(convertedHex.s)).toBe(originalHex.s)
    })
  })

  describe('corner calculations', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 0, y: 0 }
    const layout = new Layout(POINTY, size, origin)

    it('should calculate correct offsets for all 6 corners', () => {
      const corners: Point[] = []
      for (let i = 0; i < 6; i++) {
        corners.push(layout.hexCornerOffset(i))
      }

      expect(corners).toHaveLength(6)
      corners.forEach((corner, i) => {
        const angle = (2 * Math.PI * (0.5 + i)) / 6
        expect(corner.x).toBeCloseTo(10 * Math.cos(angle))
        expect(corner.y).toBeCloseTo(10 * Math.sin(angle))
      })
    })

    it('should return 6 corner points for a hex', () => {
      const hex = new Hex(0, 0, 0)
      const corners = layout.polygonCorners(hex)

      expect(corners).toHaveLength(6)

      // Check they form regular hexagon
      const distances = corners.map((corner) =>
        Math.sqrt(corner.x * corner.x + corner.y * corner.y),
      )
      distances.forEach((distance) => {
        expect(distance).toBeCloseTo(10, 1)
      })
    })
  })

  describe('hexToScreen', () => {
    const size = { x: 10, y: 10 }
    const layoutOrigin = { x: 100, y: 100 }
    const layout = new Layout(POINTY, size, layoutOrigin)

    it('should add screen origin offset', () => {
      const hex = new Hex(0, 0, 0)
      const screenOrigin = { x: 50, y: 50 }
      const screen = layout.hexToScreen(hex, screenOrigin)

      expect(screen.x).toBeCloseTo(150)
      expect(screen.y).toBeCloseTo(150)
    })
  })

  describe('getArrowPath', () => {
    const size = { x: 30, y: 30 }
    const origin = { x: 400, y: 300 }
    const layout = new Layout(POINTY, size, origin)

    it('should create valid SVG path between hexes', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(2, -1, -1)
      const path = layout.getArrowPath(startHex, endHex)

      expect(path).toContain('M')
      expect(path).toContain('Q')
      expect(path.match(/M/g)).toHaveLength(1)
      expect(path.match(/Q/g)).toHaveLength(1)

      const pathRegex = /^M\s+[-\d.]+\s+[-\d.]+\s+Q\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+$/
      expect(path).toMatch(pathRegex)
    })

    it('should handle different parameters', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(1, 0, -1)

      const pathNoRadius = layout.getArrowPath(startHex, endHex, 0)
      const pathWithRadius = layout.getArrowPath(startHex, endHex, 10)
      const normalPath = layout.getArrowPath(startHex, endHex, 10, false)
      const invertedPath = layout.getArrowPath(startHex, endHex, 10, true)

      expect(pathNoRadius).not.toBe(pathWithRadius)
      expect(normalPath).not.toBe(invertedPath)
    })

    it('should handle same hex (zero distance)', () => {
      const hex = new Hex(0, 0, 0)
      const path = layout.getArrowPath(hex, hex, 10)

      const pathRegex = /^M\s+[-\d.]+\s+[-\d.]+\s+Q\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+$/
      expect(path).toMatch(pathRegex)
      expect(path).not.toContain('NaN')
    })
  })
})
