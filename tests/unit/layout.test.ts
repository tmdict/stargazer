import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'
import { Layout, POINTY } from '@/lib/layout'

describe('Layout', () => {
  const SQRT3 = Math.sqrt(3)

  describe('coordinate conversion', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 100, y: 100 }
    const layout = new Layout(POINTY, size, origin)

    it('should convert hex to pixel coordinates', () => {
      expect(layout.hexToPixel(new Hex(0, 0, 0))).toEqual({ x: 100, y: 100 })

      // q axis maps to pure horizontal movement
      const qPixel = layout.hexToPixel(new Hex(1, 0, -1))
      expect(qPixel.x).toBeCloseTo(100 + SQRT3 * 10)
      expect(qPixel.y).toBeCloseTo(100)

      // r axis moves diagonally (half a hex right, one and a half down)
      const rPixel = layout.hexToPixel(new Hex(0, 1, -1))
      expect(rPixel.x).toBeCloseTo(100 + (SQRT3 / 2) * 10)
      expect(rPixel.y).toBeCloseTo(115)
    })
  })

  describe('corner calculations', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 0, y: 0 }
    const layout = new Layout(POINTY, size, origin)

    it('pointy-top: first corner sits at 30°, corners step by 60°', () => {
      const corner0 = layout.hexCornerOffset(0)
      expect(corner0.x).toBeCloseTo(10 * Math.cos(Math.PI / 6))
      expect(corner0.y).toBeCloseTo(5)

      // Corner 3 is diametrically opposite corner 0
      const corner3 = layout.hexCornerOffset(3)
      expect(corner3.x).toBeCloseTo(-corner0.x)
      expect(corner3.y).toBeCloseTo(-corner0.y)
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
