import { describe, expect, it } from 'vitest'

import { createImage } from '@/lib/import/image'
import { readStars } from '@/lib/import/stars'
import type { RgbaImage } from '@/lib/import/types'

type Rgb = [number, number, number]

// A dark frame box with a centred row of `count` bright stars near its top,
// roughly the size a frame match returns (74 × 100); one colour for every
// star, or one per star.
const frameWithStars = (
  count: number,
  colour: Rgb | Rgb[],
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
    const rgb = Array.isArray(colour[0]) ? (colour as Rgb[])[k]! : (colour as Rgb)
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

  // Headwear beside an unrefined row tints its end stars: the row still reads
  // as refined, but not surely.
  it('is not sure of a refined reading that only part of the row supports', () => {
    const white: Rgb = [225, 240, 250]
    const purple: Rgb = [200, 150, 245]
    const pink: Rgb = [250, 200, 245]
    expect(
      readStars(...args(frameWithStars(6, [purple, white, white, white, white, purple]))),
    ).toMatchObject({ level: 1, sure: false })
    expect(
      readStars(...args(frameWithStars(6, [pink, white, white, white, white, pink]))),
    ).toMatchObject({ level: 4, sure: false })
  })

  // An R4 row whose tint a browser's resampling has faded below the R4 share
  // reads as R0, and must not pass as a sure R0.
  it('is not sure of an R0 row with a faint pink tint', () => {
    const f = frameWithStars(6, [225, 240, 250])
    // Four pink pixels in the first star (centred at x 33): about 2% of the row.
    for (let x = 31; x <= 34; x++)
      f.shot.data.set([250, 200, 245], ((f.box.y + 10) * f.shot.width + x) * 4)
    expect(readStars(...args(f))).toMatchObject({ level: 0, sure: false })
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
