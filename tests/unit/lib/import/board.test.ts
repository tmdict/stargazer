import { describe, expect, it } from 'vitest'

import { BOARD_HEXES, fitBoard, hexCorners } from '@/lib/import/board'
import type { BoardFit, RgbaImage } from '@/lib/import/types'
import { createImage } from '../../fixtures/image'

// A formation board as the game draws it: dark tiles with faint edges inside a
// light outline, through the camera at `fit`.
function drawBoard(width: number, height: number, fit: BoardFit): RgbaImage {
  const img = createImage(width, height)
  const paint = (x: number, y: number, level: number): void => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const px = Math.round(x) + dx
        const py = Math.round(y) + dy
        if (px < 0 || py < 0 || px >= width || py >= height) continue
        const i = (py * width + px) * 4
        img.data.fill(level, i, i + 3)
      }
    }
  }
  for (let i = 0; i < img.data.length; i += 4) {
    img.data.fill(70, i, i + 3)
    img.data[i + 3] = 255
  }
  const edges = new Map<
    string,
    { a: { x: number; y: number }; b: { x: number; y: number }; n: number }
  >()
  for (const hex of BOARD_HEXES) {
    const corners = hexCorners(fit, hex)
    corners.forEach((a, k) => {
      const b = corners[(k + 1) % 6]!
      const key = `${Math.round(a.x + b.x)},${Math.round(a.y + b.y)}`
      const edge = edges.get(key)
      edges.set(key, { a, b, n: (edge?.n ?? 0) + 1 })
    })
  }
  for (const { a, b, n } of edges.values()) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2)
    for (let s = 0; s <= steps; s++) {
      paint(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps, n === 1 ? 220 : 95)
    }
  }
  return img
}

describe('fitBoard', () => {
  it.each([
    { scale: 46, x: 330, y: 300 },
    { scale: 67, x: 470, y: 390 },
    { scale: 35, x: 300, y: 500 },
  ])('recovers the scale and centre of a board at $scale px per hex', (fit) => {
    const found = fitBoard(drawBoard(940, 1100, { ...fit, support: 1 }))!
    expect(found.scale).toBeCloseTo(fit.scale, 0)
    expect(Math.abs(found.x - fit.x)).toBeLessThan(2)
    expect(Math.abs(found.y - fit.y)).toBeLessThan(2)
  })

  it('finds no board when part of it is cut off', () => {
    expect(fitBoard(drawBoard(940, 1100, { scale: 67, x: 470, y: 1000, support: 1 }))).toBeNull()
  })
})
