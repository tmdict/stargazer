import { describe, expect, it } from 'vitest'

import { Hex } from '../../src/lib/hex'
import { FLAT, Layout, POINTY, type Point } from '../../src/lib/layout'

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

  describe('constructor', () => {
    it('should create layout with pointy-top orientation', () => {
      const size = { x: 10, y: 10 }
      const origin = { x: 100, y: 100 }
      const layout = new Layout(POINTY, size, origin)

      expect(layout.orientation).toBe(POINTY)
      expect(layout.size).toEqual(size)
      expect(layout.origin).toEqual(origin)
    })

    it('should create layout with flat-top orientation', () => {
      const size = { x: 20, y: 20 }
      const origin = { x: 200, y: 200 }
      const layout = new Layout(FLAT, size, origin)

      expect(layout.orientation).toBe(FLAT)
      expect(layout.size).toEqual(size)
      expect(layout.origin).toEqual(origin)
    })
  })

  describe('coordinate conversion', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 100, y: 100 }
    const layout = new Layout(POINTY, size, origin)

    describe('hexToPixel', () => {
      it('should convert origin hex to pixel center', () => {
        const hex = new Hex(0, 0, 0)
        const pixel = layout.hexToPixel(hex)
        expect(pixel.x).toBeCloseTo(100)
        expect(pixel.y).toBeCloseTo(100)
      })

      it('should convert non-origin hex correctly', () => {
        const hex = new Hex(1, 0, -1)
        const pixel = layout.hexToPixel(hex)
        expect(pixel.x).toBeCloseTo(100 + SQRT3 * 10)
        expect(pixel.y).toBeCloseTo(100)
      })

      it('should handle negative coordinates', () => {
        const hex = new Hex(-1, 1, 0)
        const pixel = layout.hexToPixel(hex)
        expect(pixel.x).toBeCloseTo(100 - (SQRT3 * 10) / 2)
        expect(pixel.y).toBeCloseTo(100 + 15)
      })
    })

    describe('pixelToHex', () => {
      it('should convert pixel at origin to hex', () => {
        const pixel = { x: 100, y: 100 }
        const hex = layout.pixelToHex(pixel)
        expect(hex.q).toBeCloseTo(0)
        expect(hex.r).toBeCloseTo(0)
        expect(hex.s).toBeCloseTo(0)
      })

      it('should convert offset pixel to hex', () => {
        const pixel = { x: 100 + SQRT3 * 10, y: 100 }
        const hex = layout.pixelToHex(pixel)
        expect(hex.q).toBeCloseTo(1)
        expect(hex.r).toBeCloseTo(0)
        expect(hex.s).toBeCloseTo(-1)
      })
    })

    describe('round-trip conversion', () => {
      it('should maintain accuracy for integer hex coordinates', () => {
        const originalHex = new Hex(2, -3, 1)
        const pixel = layout.hexToPixel(originalHex)
        const convertedHex = layout.pixelToHex(pixel)

        expect(Math.round(convertedHex.q)).toBe(originalHex.q)
        expect(Math.round(convertedHex.r)).toBe(originalHex.r)
        expect(Math.round(convertedHex.s)).toBe(originalHex.s)
      })
    })
  })

  describe('corner calculations', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 0, y: 0 }
    const layout = new Layout(POINTY, size, origin)

    describe('hexCornerOffset', () => {
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

      it('should work with flat-top orientation', () => {
        const flatLayout = new Layout(FLAT, size, origin)
        const corner0 = flatLayout.hexCornerOffset(0)
        const angle0 = 0
        expect(corner0.x).toBeCloseTo(10 * Math.cos(angle0))
        expect(corner0.y).toBeCloseTo(10 * Math.sin(angle0))
      })
    })

    describe('polygonCorners', () => {
      it('should return 6 corner points for a hex', () => {
        const hex = new Hex(0, 0, 0)
        const corners = layout.polygonCorners(hex)
        expect(corners).toHaveLength(6)
      })

      it('should form regular hexagon', () => {
        const hex = new Hex(0, 0, 0)
        const corners = layout.polygonCorners(hex)

        const distances = corners.map((corner) =>
          Math.sqrt(corner.x * corner.x + corner.y * corner.y),
        )

        distances.forEach((distance) => {
          expect(distance).toBeCloseTo(10, 1)
        })
      })

      it('should be offset for non-origin hex', () => {
        const hex = new Hex(1, 0, -1)
        const corners = layout.polygonCorners(hex)
        const center = layout.hexToPixel(hex)

        corners.forEach((corner) => {
          const dx = corner.x - center.x
          const dy = corner.y - center.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          expect(distance).toBeCloseTo(10, 1)
        })
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

    it('should work with non-origin hex', () => {
      const hex = new Hex(1, -1, 0)
      const screenOrigin = { x: 20, y: 30 }
      const screen = layout.hexToScreen(hex, screenOrigin)
      const pixel = layout.hexToPixel(hex)

      expect(screen.x).toBeCloseTo(pixel.x + 20)
      expect(screen.y).toBeCloseTo(pixel.y + 30)
    })
  })

  describe('getArrowPath', () => {
    const size = { x: 30, y: 30 }
    const origin = { x: 400, y: 300 }
    const layout = new Layout(POINTY, size, origin)

    it('should create path between two hexes', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(2, -1, -1)
      const path = layout.getArrowPath(startHex, endHex)

      expect(path).toContain('M')
      expect(path).toContain('Q')
      expect(path.match(/M/g)).toHaveLength(1)
      expect(path.match(/Q/g)).toHaveLength(1)
    })

    it('should handle character radius', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(1, 0, -1)
      const pathNoRadius = layout.getArrowPath(startHex, endHex, 0)
      const pathWithRadius = layout.getArrowPath(startHex, endHex, 10)

      expect(pathNoRadius).not.toBe(pathWithRadius)
    })

    it('should handle inverted curve', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(2, -2, 0)
      const normalPath = layout.getArrowPath(startHex, endHex, 10, false)
      const invertedPath = layout.getArrowPath(startHex, endHex, 10, true)

      expect(normalPath).not.toBe(invertedPath)
    })

    it('should create valid SVG path', () => {
      const startHex = new Hex(-1, 0, 1)
      const endHex = new Hex(1, -1, 0)
      const path = layout.getArrowPath(startHex, endHex, 15)

      const pathRegex = /^M\s+[-\d.]+\s+[-\d.]+\s+Q\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+$/
      expect(path).toMatch(pathRegex)
    })

    it('should handle same hex (zero distance)', () => {
      const hex = new Hex(0, 0, 0)
      const path = layout.getArrowPath(hex, hex, 10)

      expect(path).toContain('M')
      expect(path).toContain('Q')

      // Should create a small loop path
      const pathRegex = /^M\s+[-\d.]+\s+[-\d.]+\s+Q\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+$/
      expect(path).toMatch(pathRegex)

      // Should not contain NaN
      expect(path).not.toContain('NaN')
    })

    it('should curve based on position relative to grid center', () => {
      const leftHex1 = new Hex(-3, 1, 2)
      const leftHex2 = new Hex(-3, 2, 1)
      const rightHex1 = new Hex(3, -1, -2)
      const rightHex2 = new Hex(3, -2, -1)

      const leftPath = layout.getArrowPath(leftHex1, leftHex2, 10)
      const rightPath = layout.getArrowPath(rightHex1, rightHex2, 10)

      expect(leftPath).not.toBe(rightPath)
    })

    it('should apply different curvature for inverted arrows', () => {
      const startHex = new Hex(0, 0, 0)
      const endHex = new Hex(3, -3, 0)
      const normalPath = layout.getArrowPath(startHex, endHex, 10, false)
      const invertedPath = layout.getArrowPath(startHex, endHex, 10, true)

      const normalMatch = normalPath.match(/Q\s+([-\d.]+)\s+([-\d.]+)/)
      const invertedMatch = invertedPath.match(/Q\s+([-\d.]+)\s+([-\d.]+)/)

      expect(normalMatch).toBeTruthy()
      expect(invertedMatch).toBeTruthy()

      if (normalMatch && invertedMatch) {
        const normalControlX = parseFloat(normalMatch[1])
        const invertedControlX = parseFloat(invertedMatch[1])
        expect(normalControlX).not.toBeCloseTo(invertedControlX)
      }
    })

    it('should handle angular offset for inverted arrows', () => {
      const startHex = new Hex(-2, 1, 1)
      const endHex = new Hex(2, -1, -1)
      const path = layout.getArrowPath(startHex, endHex, 20, true)

      expect(path).toContain('M')
      expect(path).toContain('Q')

      const coords = path.match(/[-\d.]+/g)
      expect(coords).toBeTruthy()
      expect(coords!.length).toBe(6)
    })
  })
})
