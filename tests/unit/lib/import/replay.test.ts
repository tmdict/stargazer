import { describe, expect, it } from 'vitest'

import { BOARD_HEXES } from '@/lib/import/board'
import { createImage } from '@/lib/import/image'
import {
  isReplayFrame,
  placeReplay,
  prepareArena,
  REPLAY_REFERENCE,
  replayHexCentre,
} from '@/lib/import/replay'
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

const ARENA = texture(REPLAY_REFERENCE.width / 4, REPLAY_REFERENCE.height / 4, 7)

// The arena as a frame of a window `scale` times the reference's, cropped so
// that reference pixel 0 lands at (x, y).
function frameOf(arena: RgbaImage, scale: number, x: number, y: number, w: number, h: number) {
  const img = createImage(w, h)
  for (let fy = 0; fy < h; fy++) {
    for (let fx = 0; fx < w; fx++) {
      const ax = Math.floor((fx - x) / scale / 4)
      const ay = Math.floor((fy - y) / scale / 4)
      const inside = ax >= 0 && ay >= 0 && ax < arena.width && ay < arena.height
      const i = (ay * arena.width + ax) * 4
      img.data.set(inside ? arena.data.subarray(i, i + 4) : [0, 0, 0, 255], (fy * w + fx) * 4)
    }
  }
  return img
}

describe('replay frames', () => {
  it('puts the fixed points measured in the reference frame on their tiles', () => {
    // Wall corners on tiles 31 and 15, wedge bases on 5 and 3 (the calibration study).
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
    const frame = frameOf(ARENA, 0.95, -30, 20, 1290, 1800)
    const placed = placeReplay(frame, arena)
    expect(placed.scale).toBeCloseTo(0.95, 2)
    expect(Math.abs(placed.x + 30)).toBeLessThan(8)
    expect(Math.abs(placed.y - 20)).toBeLessThan(8)
    const other = texture(ARENA.width, ARENA.height, 99)
    expect(isReplayFrame(frameOf(other, 0.95, -30, 20, 1290, 1800), arena)).toBe(false)
  })
})
