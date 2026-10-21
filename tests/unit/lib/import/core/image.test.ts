import { describe, expect, it } from 'vitest'

import { cropResize, maskedNcc, resample } from '@/lib/import/core/image'
import type { RgbaImage } from '@/lib/import/core/types'
import { createImage } from '../../../fixtures/image'

const paint = (img: RgbaImage, x: number, y: number, rgb: [number, number, number], a = 255) => {
  const i = (y * img.width + x) * 4
  img.data[i] = rgb[0]
  img.data[i + 1] = rgb[1]
  img.data[i + 2] = rgb[2]
  img.data[i + 3] = a
}

describe('cropResize', () => {
  it('averages the covered source pixels when downscaling', () => {
    const img = createImage(2, 2)
    paint(img, 0, 0, [0, 0, 0])
    paint(img, 1, 0, [200, 0, 0])
    paint(img, 0, 1, [0, 100, 0])
    paint(img, 1, 1, [0, 0, 40])
    const out = cropResize(img, { x: 0, y: 0, w: 2, h: 2 }, 1, 1)
    expect([...out.data]).toEqual([50, 25, 10, 255])
  })

  it('repeats source pixels when upscaling', () => {
    const img = createImage(1, 1)
    paint(img, 0, 0, [9, 8, 7])
    const out = cropResize(img, { x: 0, y: 0, w: 1, h: 1 }, 2, 2)
    expect(out.width).toBe(2)
    expect([...out.data.slice(12, 15)]).toEqual([9, 8, 7])
  })
})

describe('resample', () => {
  it('weights each source pixel by how much of the target pixel it covers', () => {
    const img = createImage(4, 1)
    ;[0, 100, 200, 40].forEach((v, x) => paint(img, x, 0, [v, 0, 0]))
    // Target pixels 1.5 source pixels wide, from half a pixel in.
    const out = resample(img, { x: 0.5, y: 0, w: 3, h: 1 }, 2, 1)
    expect(out.data[0]).toBeCloseTo((0 * 0.5 + 100 * 1) / 1.5, 0)
    expect(out.data[4]).toBeCloseTo((200 * 1 + 40 * 0.5) / 1.5, 0)
  })

  it('keeps pixels as they are at scale 1', () => {
    const img = createImage(3, 1)
    ;[10, 20, 30].forEach((v, x) => paint(img, x, 0, [v, v, v]))
    const out = resample(img, { x: 1, y: 0, w: 2, h: 1 }, 2, 1)
    expect([out.data[0], out.data[4]]).toEqual([20, 30])
  })
})

describe('maskedNcc', () => {
  it('finds a template where it was stamped and only there', () => {
    const shot = createImage(40, 40)
    const template = createImage(12, 12)
    // A two-tone ring: a frame has texture within each channel, and a
    // single-colour patch is by design never a match.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const edge = x < 2 || y < 2 || x > 9 || y > 9
        const rgb: [number, number, number] = !edge
          ? [20, 20, 20]
          : (x + y) % 2
            ? [230, 150, 40]
            : [120, 80, 20]
        paint(template, x, y, rgb, edge ? 255 : 0)
        paint(shot, 10 + x, 15 + y, rgb)
      }
    }
    expect(maskedNcc(shot, template, 10, 15, 1)).toBeCloseTo(1, 3)
    expect(maskedNcc(shot, template, 20, 25, 1)).toBeLessThan(0.5)
  })

  it('scores a flat patch 0 and a template mostly outside the shot -1', () => {
    const template = createImage(12, 12)
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) paint(template, x, y, x < 6 ? [230, 150, 40] : [20, 20, 20])
    }
    const flat = createImage(40, 40)
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) paint(flat, x, y, [200, 140, 60])
    expect(maskedNcc(flat, template, 10, 10, 1)).toBe(0)
    expect(maskedNcc(flat, template, 36, 36, 1)).toBe(-1)
  })
})
