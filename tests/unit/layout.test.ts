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

  describe('rotated layout (the invert view)', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 300, y: 300 }
    const canonical = new Layout(POINTY, size, origin)
    const rotated = new Layout(POINTY, size, origin, true)
    const hexes = [new Hex(0, 0, 0), new Hex(1, 0, -1), new Hex(-2, 3, -1), new Hex(4, -1, -3)]

    it('reflects every hex center through the origin', () => {
      for (const hex of hexes) {
        const p = canonical.hexToPixel(hex)
        const r = rotated.hexToPixel(hex)
        expect(r.x).toBeCloseTo(2 * origin.x - p.x)
        expect(r.y).toBeCloseTo(2 * origin.y - p.y)
      }
    })

    it('matches the (-q,-r,-s) hex rotation: rotated(h) lands on canonical(-h)', () => {
      for (const hex of hexes) {
        const r = rotated.hexToPixel(hex)
        const opposite = canonical.hexToPixel(new Hex(-hex.q, -hex.r, -hex.s))
        expect(r.x).toBeCloseTo(opposite.x)
        expect(r.y).toBeCloseTo(opposite.y)
      }
    })

    it('reflects corner index i to the rotated position of canonical corner i', () => {
      for (const hex of hexes) {
        const p = canonical.polygonCorners(hex)
        const r = rotated.polygonCorners(hex)
        for (let i = 0; i < 6; i++) {
          expect(r[i]!.x).toBeCloseTo(2 * origin.x - p[i]!.x)
          expect(r[i]!.y).toBeCloseTo(2 * origin.y - p[i]!.y)
        }
      }
    })

    it('defaults to unrotated and keeps canonical output bit-identical', () => {
      const plain = new Layout(POINTY, size, origin)
      expect(plain.rotated).toBe(false)
      for (const hex of hexes) {
        expect(plain.hexToPixel(hex)).toEqual(canonical.hexToPixel(hex))
      }
    })

    it('reflects arrow endpoints through the origin', () => {
      const path = rotated.getLinePath(hexes[1]!, hexes[2]!)
      const canonicalPath = canonical.getLinePath(
        new Hex(-1, 0, 1),
        new Hex(2, -3, 1),
      )
      expect(path).toBe(canonicalPath)
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
