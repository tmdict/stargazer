import { describe, expect, it } from 'vitest'

import { readStars, type StarRow } from '@/lib/import/card/stars'
import type { RgbaImage } from '@/lib/import/core/types'
import { CARD_STARS as ROW } from '@/lib/import/screens/result/layout'
import { createImage } from '../../../fixtures/image'

type Rgb = [number, number, number]

// A dark frame box with a centred row of `count` bright stars where a result
// card puts its star row, roughly the size a frame match returns (74 × 100); one
// colour for every star, or one per star.
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
  const startX = box.x + box.w / 2 - ROW.left - ((count - 1) / 2) * ROW.pitch
  for (let k = 0; k < count; k++) {
    const rgb = Array.isArray(colour[0]) ? (colour as Rgb[])[k]! : (colour as Rgb)
    const cx = Math.round(startX + k * ROW.pitch)
    const top = box.y + Math.round(box.h / 2) - ROW.above + 1
    for (let y = top; y < top + 5; y++) {
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
  it('reads a full row and its colour family', () => {
    expect(readStars(...args(frameWithStars(6, [250, 210, 60])))).toMatchObject({
      full: true,
      family: 'gold',
      level: 2,
    })
    expect(readStars(...args(frameWithStars(6, [200, 150, 245])))).toMatchObject({
      full: true,
      family: 'purple',
      level: 1,
    })
    expect(readStars(...args(frameWithStars(6, [250, 90, 110])))).toMatchObject({
      full: true,
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
    // Four pink pixels in the first star (centred at x 34): about 2% of the row.
    const y = f.box.y + Math.round(f.box.h / 2) - ROW.above + 3
    for (let x = 31; x <= 34; x++) f.shot.data.set([250, 200, 245], (y * f.shot.width + x) * 4)
    expect(readStars(...args(f))).toMatchObject({ level: 0, sure: false })
  })

  // The winged P4 frame's white wings sit just above its star row and are
  // brighter than it.
  it('reads the row where the card puts it, not a brighter band above it', () => {
    const f = frameWithStars(6, [250, 90, 110])
    for (let y = f.box.y + 2; y < f.box.y + 9; y++)
      for (let x = f.box.x; x < f.box.x + f.box.w; x++)
        f.shot.data.set([245, 245, 250], (y * f.shot.width + x) * 4)
    expect(readStars(...args(f))).toMatchObject({ full: true, family: 'red', level: 3 })
  })

  // Five stars, an unrefined hero's fullest row, under a hat or hair that
  // tints it pink.
  it("reads a row of five as R0, for review when it is a refined family's colour", () => {
    expect(readStars(...args(frameWithStars(5, [250, 250, 250])))).toMatchObject({
      full: false,
      level: 0,
      sure: true,
    })
    expect(readStars(...args(frameWithStars(5, [250, 200, 245])))).toMatchObject({
      full: false,
      level: 0,
      sure: false,
    })
  })

  it('reads rows of two to five as short', () => {
    for (const count of [2, 3, 4, 5])
      expect(readStars(...args(frameWithStars(count, [250, 200, 245])))).toMatchObject({
        full: false,
        level: 0,
      })
  })

  // The blue P4 frame's side pieces sit just beyond a full row's outer stars,
  // as bright as stars, and pink hair beside a row of five tints it.
  it('reads a row of five between bright side pieces as short', () => {
    const f = frameWithStars(5, [225, 240, 250])
    const centre = f.box.x + f.box.w / 2 - ROW.left
    const top = f.box.y + Math.round(f.box.h / 2) - ROW.above
    for (let y = top; y < top + 7; y++) {
      for (const x of [centre - 29, centre - 28, centre + 28, centre + 29])
        f.shot.data.set([170, 220, 250], (y * f.shot.width + x) * 4)
      for (const x of [centre - 21, centre - 20, centre + 20, centre + 21])
        f.shot.data.set([250, 110, 200], (y * f.shot.width + x) * 4)
    }
    expect(readStars(...args(f))).toMatchObject({ full: false, level: 0 })
  })

  // A sleep mask under a row of three: its pale top fills the row's lower
  // pixel rows from side to side, and its pink ears and folds rise beside the
  // stars, 15 and 21 px from the row's centre.
  it('reads a row of three over bright headwear as short', () => {
    const f = frameWithStars(3, [225, 240, 250])
    const centre = f.box.x + f.box.w / 2 - ROW.left
    const top = f.box.y + Math.round(f.box.h / 2) - ROW.above
    for (let x = f.box.x + 8; x < f.box.x + f.box.w - 8; x++) {
      for (let y = top + 5; y < top + 7; y++)
        f.shot.data.set([215, 190, 235], (y * f.shot.width + x) * 4)
      const off = Math.abs(x - centre)
      if (Math.abs(off - 15) <= 1 || Math.abs(off - 21) <= 1)
        for (let y = top + 1; y < top + 5; y++)
          f.shot.data.set([250, 160, 220], (y * f.shot.width + x) * 4)
    }
    expect(readStars(...args(f))).toMatchObject({ full: false, level: 0 })
  })

  // The paragon frame's gold arc crosses the row's ends, where a full row's
  // outer stars sit, and lights them about half as much as a star.
  it('reads a row of two between gold frame arcs as short', () => {
    const f = frameWithStars(2, [225, 240, 250])
    const centre = f.box.x + f.box.w / 2 - ROW.left
    const top = f.box.y + Math.round(f.box.h / 2) - ROW.above
    for (const end of [-1, 1]) {
      const x = Math.round(centre + end * 2.5 * ROW.pitch)
      for (let y = top; y < top + 7; y++)
        for (const xx of [x - 1, x]) f.shot.data.set([235, 160, 60], (y * f.shot.width + xx) * 4)
    }
    expect(readStars(...args(f))).toMatchObject({ full: false, level: 0 })
  })
})

const args = (
  f: ReturnType<typeof frameWithStars>,
): [RgbaImage, { x: number; y: number; w: number; h: number }, StarRow] => [f.shot, f.box, ROW]
