import { describe, expect, it } from 'vitest'

import {
  createImage,
  cropResize,
  dot,
  maskedNcc,
  normalizedVector,
  rgbToHsv,
} from '@/lib/import/image'
import type { RgbaImage } from '@/lib/import/types'

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

describe('rgbToHsv', () => {
  it('reads pure hues and greys', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual([0, 1, 1])
    expect(rgbToHsv(0, 255, 0)[0]).toBe(120)
    expect(rgbToHsv(0, 0, 255)[0]).toBe(240)
    expect(rgbToHsv(128, 128, 128)[1]).toBe(0)
  })
})

describe('normalizedVector', () => {
  it('correlates perfectly with itself and not with its inverse', () => {
    const img = createImage(3, 2)
    for (let p = 0; p < 6; p++)
      paint(img, p % 3, Math.floor(p / 3), [p * 40, 255 - p * 40, (p * 90) % 256])
    const v = normalizedVector(img)
    expect(dot(v, v)).toBeCloseTo(1, 5)
    const inverted = createImage(3, 2)
    for (let p = 0; p < 6; p++) {
      const i = p * 4
      paint(inverted, p % 3, Math.floor(p / 3), [
        255 - img.data[i]!,
        255 - img.data[i + 1]!,
        255 - img.data[i + 2]!,
      ])
    }
    expect(dot(v, normalizedVector(inverted))).toBeCloseTo(-1, 5)
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
