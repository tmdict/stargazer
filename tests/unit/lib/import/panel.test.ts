import { describe, expect, it } from 'vitest'

import { createImage } from '@/lib/import/image'
import { CANONICAL_WIDTH, TABS } from '@/lib/import/layout'
import { framePanel } from '@/lib/import/panel'
import { findTabs } from '@/lib/import/strip'
import type { RgbaImage } from '@/lib/import/types'

const ORANGE: [number, number, number] = [225, 147, 90]
const BLUE: [number, number, number] = [124, 148, 188]

const block = (img: RgbaImage, x0: number, x1: number, y0: number, y1: number, rgb: number[]) => {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4
      img.data.set([...rgb, 255], i)
    }
  }
}

// A dark capture with the two tabs at `left`, `width` wide, a panel apart.
const capture = (w: number, h: number, left: number, width: number): RgbaImage => {
  const img = createImage(w, h)
  block(img, 0, w, 0, h, [60, 55, 50])
  block(img, left, left + width + 1, 400, 400 + width / 2, ORANGE)
  block(img, left, left + width + 1, 400 + width * 5, 400 + width * 5.5, BLUE)
  return img
}

describe('framePanel', () => {
  it('scales and shifts a loose crop so its tabs stand where the layout has them', () => {
    // A desktop window with wide margins: the panel at 1.5 times the layout.
    const { image, tabs } = framePanel(capture(2400, 2000, 600, TABS.width * 1.5))
    expect(image.width).toBe(CANONICAL_WIDTH)
    expect(image.height).toBe(Math.round(2000 / 1.5))
    const framed = findTabs(image)!
    expect(Math.abs(framed.left - TABS.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(framed.width - TABS.width)).toBeLessThanOrEqual(1)
    expect(tabs!.ally.top).toBe(Math.round(400 / 1.5))
  })

  it('takes a crop whose tab touches its left edge as starting at the panel', () => {
    const { image, tabs } = framePanel(capture(1300, 1800, 0, 160))
    expect(image.height).toBe(Math.round((1800 * CANONICAL_WIDTH) / 1300))
    expect(findTabs(image)!.left).toBe(0)
    expect(tabs!.ally.top).toBe(Math.round((400 * CANONICAL_WIDTH) / 1300))
  })
})
