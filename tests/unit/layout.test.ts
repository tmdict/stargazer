import { describe, expect, it } from 'vitest'

import { Hex } from '@/lib/hex'
import { Layout, PERSPECTIVE, POINTY } from '@/lib/layout'

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
  })

  describe('rotated layout (the invert view)', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 300, y: 300 }
    const canonical = new Layout(POINTY, size, origin, false)
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

    it('reflects line path endpoints through the origin', () => {
      const path = rotated.getLinePath(hexes[1]!, hexes[2]!)
      const canonicalPath = canonical.getLinePath(new Hex(-1, 0, 1), new Hex(2, -3, 1))
      expect(path).toBe(canonicalPath)
    })
  })

  describe('tilted layout (the perspective view)', () => {
    const size = { x: 10, y: 10 }
    const origin = { x: 300, y: 300 }
    const tilt = 0.01
    const flat = new Layout(POINTY, size, origin)
    const tilted = new Layout(POINTY, size, origin, false, tilt)
    const offset = (p: { x: number; y: number }) => ({ x: p.x - origin.x, y: p.y - origin.y })

    it('scales each center about the origin by 1 / (1 - tilt * rows down)', () => {
      for (const hex of [
        new Hex(0, 0, 0),
        new Hex(3, 0, -3),
        new Hex(-1, 4, -3),
        new Hex(2, -4, 2),
      ]) {
        const f = offset(flat.hexToPixel(hex))
        const t = offset(tilted.hexToPixel(hex))
        const depth = 1 - (tilt * f.y) / size.y
        expect(t.x).toBeCloseTo(f.x / depth)
        expect(t.y).toBeCloseTo(f.y / depth)
      }
    })

    it("widens a hex's lower edge over its upper edge", () => {
      // Pointy-top: corners 0 and 2 are the lower pair, 5 and 3 the upper.
      const c = tilted.polygonCorners(new Hex(0, 2, -2))
      expect(c[0]!.x - c[2]!.x).toBeGreaterThan(c[5]!.x - c[3]!.x)
    })

    it('ends every arrow and line on the rims of the tokens it joins', () => {
      // The board's proportions: portraits of radius 30 on hexes of radius 40.
      const squash = PERSPECTIVE.compression
      const board = new Layout(POINTY, { x: 40, y: 40 }, origin, false, tilt, squash)
      const radius = 30
      const artifactRadius = 26
      const hexes: Hex[] = []
      for (let q = -3; q <= 3; q++) {
        for (let r = Math.max(-3, -q - 3); r <= Math.min(3, -q + 3); r++) {
          hexes.push(new Hex(q, r, -q - r))
        }
      }
      // Paths come out upright, y already times the squash. A smaller token stands
      // lower than the portraits by the difference in radius.
      const gap = (x: number, y: number, hex: Hex, r: number) => {
        const c = board.hexToPixel(hex)
        return Math.abs(Math.hypot(x - c.x, y - c.y * squash - (radius - r)) - r)
      }
      const offRim: string[] = []
      const check = (from: Hex, to: Hex, path: string, startRadius = radius) => {
        const v = path.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)!.map(Number)
        if (
          gap(v[0]!, v[1]!, from, startRadius) > 1e-3 ||
          gap(v.at(-2)!, v.at(-1)!, to, radius) > 1e-3
        ) {
          offRim.push(`${from.getId()} -> ${to.getId()}: ${path}`)
        }
      }
      for (const from of hexes) {
        for (const to of hexes) {
          if (from === to) continue
          // The curve scales of skill, ally and enemy arrows, arcing and bowing.
          for (const curveScale of [1, 1.5, 2]) {
            for (const arc of [true, false]) {
              check(from, to, board.getArrowPath(from, to, radius, { curveScale, arc }))
            }
          }
          const artifactArrow = board.getArrowPath(from, to, radius, {
            arc: false,
            startRadius: artifactRadius,
          })
          check(from, to, artifactArrow, artifactRadius)
          check(from, to, board.getLinePath(from, to, radius))
        }
      }
      expect(offRim).toEqual([])
    })

    it('never arcs an arrow above the top of the portrait at its higher end', () => {
      const squash = 0.6
      const arcing = new Layout(POINTY, size, origin, false, tilt, squash)
      const radius = 6
      // Long pairs, where the rise would otherwise be largest: across a row, into
      // the board, and on a slant.
      for (const [from, to] of [
        [new Hex(-3, 0, 3), new Hex(3, 0, -3)],
        [new Hex(0, 3, -3), new Hex(0, -3, 3)],
        [new Hex(-2, 3, -1), new Hex(3, -3, 0)],
      ] as const) {
        const [, y0, , cy, , y2] = arcing
          .getArrowPath(from, to, radius)
          .match(/-?[\d.]+/g)!
          .map(Number)
        // The top of the quadratic, then how far it sits above the higher end's
        // center on screen.
        const t = (y0! - cy!) / (y0! - 2 * cy! + y2!)
        const top =
          t > 0 && t < 1
            ? (1 - t) ** 2 * y0! + 2 * t * (1 - t) * cy! + t ** 2 * y2!
            : Math.min(y0!, y2!)
        // The path is upright (screen units); the centers need the squash.
        const higher = Math.min(arcing.hexToPixel(from).y, arcing.hexToPixel(to).y) * squash
        expect(higher - top).toBeLessThanOrEqual(radius + 1e-6)
        // It arcs up: the control point sits above the chord.
        expect(cy!).toBeLessThan((y0! + y2!) / 2)
      }
    })

    it('arcs a closest-target arrow under a skill arrow between the same pair', () => {
      const board = new Layout(
        POINTY,
        { x: 40, y: 40 },
        origin,
        false,
        tilt,
        PERSPECTIVE.compression,
      )
      // Far enough apart sideways that the height limit holds both arcs.
      const [from, to] = [new Hex(-3, 0, 3), new Hex(3, 0, -3)]
      const top = (path: string) => {
        const [, y0, , cy, , y2] = path.match(/-?[\d.]+/g)!.map(Number)
        const t = (y0! - cy!) / (y0! - 2 * cy! + y2!)
        return (1 - t) ** 2 * y0! + 2 * t * (1 - t) * cy! + t ** 2 * y2!
      }
      const skill = top(board.getArrowPath(from, to, 30))
      const closestTarget = top(board.getArrowPath(from, to, 30, { curveScale: 1.5 }))
      expect(closestTarget).toBeGreaterThan(skill + 1)
    })

    it('tilts after rotating, so the screen bottom stays nearest under invert', () => {
      const rotated = new Layout(POINTY, size, origin, true, tilt)
      for (const hex of [new Hex(1, 0, -1), new Hex(-2, 3, -1), new Hex(4, -1, -3)]) {
        const mirrored = new Hex(-hex.q, -hex.r, -hex.s)
        expect(rotated.hexToPixel(hex).x).toBeCloseTo(tilted.hexToPixel(mirrored).x)
        expect(rotated.hexToPixel(hex).y).toBeCloseTo(tilted.hexToPixel(mirrored).y)
      }
    })
  })

  describe('getArrowPath', () => {
    const size = { x: 30, y: 30 }
    const origin = { x: 400, y: 300 }
    const layout = new Layout(POINTY, size, origin)

    it('should handle same hex (zero distance)', () => {
      const hex = new Hex(0, 0, 0)
      const path = layout.getArrowPath(hex, hex, 10)

      const pathRegex = /^M\s+[-\d.]+\s+[-\d.]+\s+Q\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+$/
      expect(path).toMatch(pathRegex)
      expect(path).not.toContain('NaN')
    })
  })
})
