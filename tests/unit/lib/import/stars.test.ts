import { describe, expect, it } from 'vitest'

import { createImage } from '@/lib/import/image'
import { readStars } from '@/lib/import/stars'
import type { RgbaImage } from '@/lib/import/types'

// A dark frame box with a centred row of `count` bright stars near its top,
// roughly the size a frame match returns (74 × 100).
const frameWithStars = (
  count: number,
  rgb: [number, number, number],
): { shot: RgbaImage; box: { x: number; y: number; w: number; h: number } } => {
  const shot = createImage(120, 140)
  const box = { x: 20, y: 20, w: 74, h: 100 }
  for (let i = 0; i < shot.data.length; i += 4) {
    shot.data[i] = 70
    shot.data[i + 1] = 60
    shot.data[i + 2] = 50
    shot.data[i + 3] = 255
  }
  const pitch = 9.5
  const startX = box.x + box.w / 2 - ((count - 1) / 2) * pitch
  for (let k = 0; k < count; k++) {
    const cx = Math.round(startX + k * pitch)
    for (let y = box.y + 8; y < box.y + 13; y++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const i = (y * shot.width + x) * 4
        shot.data[i] = rgb[0]
        shot.data[i + 1] = rgb[1]
        shot.data[i + 2] = rgb[2]
      }
    }
  }
  return { shot, box }
}

describe('readStars', () => {
  it('counts a full row and reads its colour family', () => {
    expect(readStars(...args(frameWithStars(6, [250, 210, 60])))).toMatchObject({
      stars: 6,
      family: 'gold',
      level: 2,
    })
    expect(readStars(...args(frameWithStars(6, [200, 150, 245])))).toMatchObject({
      stars: 6,
      family: 'purple',
      level: 1,
    })
    expect(readStars(...args(frameWithStars(6, [250, 90, 110])))).toMatchObject({
      stars: 6,
      family: 'red',
      level: 3,
    })
  })

  it('splits white rows by a pink tint', () => {
    expect(readStars(...args(frameWithStars(6, [225, 240, 250])))).toMatchObject({
      family: 'white',
      level: 0,
    })
    expect(readStars(...args(frameWithStars(6, [250, 200, 245])))).toMatchObject({
      family: 'white',
      level: 4,
    })
  })

  it('reads a short row as R0 whatever its colour', () => {
    const r = readStars(...args(frameWithStars(3, [250, 210, 60])))
    expect(r.stars).toBe(3)
    expect(r.level).toBe(0)
  })
})

const args = (
  f: ReturnType<typeof frameWithStars>,
): [RgbaImage, { x: number; y: number; w: number; h: number }] => [f.shot, f.box]
