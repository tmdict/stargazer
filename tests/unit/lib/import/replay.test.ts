import { describe, expect, it } from 'vitest'

import { BOARD_HEXES } from '@/lib/import/board'
import { createImage } from '@/lib/import/image'
import { isReplayFrame, prepareArena, readReplay, replayHexCentre } from '@/lib/import/replay'
import type { RgbaImage } from '@/lib/import/types'

// A grey picture of overlapping soft blobs, the same for one seed.
function texture(width: number, height: number, seed: number): RgbaImage {
  let state = seed
  const random = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const blobs = Array.from({ length: 90 }, () => ({
    x: random() * width,
    y: random() * height,
    r: 4 + random() * 30,
    v: random() * 200 - 100,
  }))
  const img = createImage(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 128
      for (const b of blobs)
        v += b.v * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.r * b.r))
      img.data.set([v, v, v, 255], (y * width + x) * 4)
    }
  }
  return img
}

// A quarter of the 1400 x 1940 reference frame, as the arena picture is.
const ARENA = texture(350, 485, 7)

// The arena as a frame of a window `scale` times the reference's, cropped so
// that reference pixel 0 lands at (x, y), with pixel noise up to `noise` either
// way standing in for the units and effects over it.
function frameOf(
  arena: RgbaImage,
  scale: number,
  x: number,
  y: number,
  w: number,
  h: number,
  noise = 0,
) {
  const img = createImage(w, h)
  let state = 5
  const random = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  for (let fy = 0; fy < h; fy++) {
    for (let fx = 0; fx < w; fx++) {
      const ax = Math.floor((fx - x) / scale / 4)
      const ay = Math.floor((fy - y) / scale / 4)
      const inside = ax >= 0 && ay >= 0 && ax < arena.width && ay < arena.height
      const v = (inside ? arena.data[(ay * arena.width + ax) * 4]! : 0) + (random() * 2 - 1) * noise
      img.data.set([v, v, v, 255], (fy * w + fx) * 4)
    }
  }
  return img
}

describe('replay frames', () => {
  it('puts the fixed points measured in the reference frame on their tiles', () => {
    // Wall corners on tiles 31 and 15, wedge bases on 5 and 3.
    const measured: [number, number, number][] = [
      [31, 600, 789],
      [15, 925, 1159],
      [5, 234, 1151],
      [3, 759, 1351],
    ]
    const reference = { scale: 1, x: 0, y: 0, score: 1 }
    for (const [tile, x, y] of measured) {
      const centre = replayHexCentre(
        reference,
        BOARD_HEXES.find((h) => h.getId() === tile)!,
      )
      expect(Math.hypot(centre.x - x, centre.y - y)).toBeLessThan(10)
    }
  })

  it("finds a frame's scale and shift from the arena around it", () => {
    const arena = prepareArena(ARENA)
    // The noise lowers the fine copies' scores more than the coarse ones'.
    const frame = frameOf(ARENA, 0.95, -30, 20, 1290, 1800, 120)
    const placed = readReplay(frame, arena).placement!
    expect(placed.scale).toBeCloseTo(0.95, 2)
    expect(Math.abs(placed.x + 30)).toBeLessThan(3)
    expect(Math.abs(placed.y - 20)).toBeLessThan(3)
    const other = texture(ARENA.width, ARENA.height, 99)
    expect(isReplayFrame(frameOf(other, 0.95, -30, 20, 1290, 1800), arena)).toBe(false)
  })
})
