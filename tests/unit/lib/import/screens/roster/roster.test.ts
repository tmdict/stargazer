import { describe, expect, it } from 'vitest'

import { FRAME_NAMES, prepareFrameRefs } from '@/lib/import/card/frames'
import { buildHeroTable } from '@/lib/import/card/heroes'
import type { RgbaImage } from '@/lib/import/core/types'
import { fitComb } from '@/lib/import/screens/roster/comb'
import { readRoster } from '@/lib/import/screens/roster/roster'
import { createImage } from '../../../../fixtures/image'

const CREAM = [235, 230, 220] as const
const CARD = [90, 60, 40] as const
const ASPECT = 404 / 280

const fill = (
  img: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: readonly number[],
) => {
  for (let py = Math.max(0, y); py < Math.min(img.height, y + h); py++) {
    for (let px = Math.max(0, x); px < Math.min(img.width, x + w); px++) {
      const i = (py * img.width + px) * 4
      img.data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], i)
    }
  }
}

// The Resonating Hall drawn plainly: a cream ground, the five Hands of Resonance at a
// pitch of their own, and a grid of six columns whose last slot of the second row is
// empty and whose fourth row runs off the bottom of the shot. `header` draws the
// grid's title ending at that height; `pill` the filter button over the second row's
// fifth card.
function drawRoster({ header, pill = false }: { header?: number; pill?: boolean } = {}): RgbaImage {
  const img = createImage(640, 830)
  fill(img, 0, 0, 640, 830, CREAM)
  for (let k = 0; k < 5; k++) fill(img, 25 + 120 * k, 120, 110, Math.round(110 * ASPECT), CARD)
  if (header !== undefined) fill(img, 24, header - 10, 180, 10, CARD)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      if (row === 1 && col === 5) continue
      fill(img, 24 + 100 * col, 330 + 145 * row, 92, Math.round(92 * ASPECT), CARD)
    }
  }
  if (pill) fill(img, 430, 540, 70, 40, [255, 255, 255])
  return img
}

const refs = {
  frames: prepareFrameRefs(FRAME_NAMES.map(() => createImage(280, 404))),
  heroes: buildHeroTable([{ characterId: 1, image: createImage(180, 248) }]),
}

describe('fitComb', () => {
  it('finds the columns from their gutters, an end gutter cut by the crop', () => {
    // Gutters 6 px wide every 40 px, the first one off the left edge: the columns'
    // centres are at 40k - 0.5.
    const profile = Float32Array.from({ length: 236 }, (_, x) => ((x + 23) % 40 < 6 ? 1 : 0))
    const comb = fitComb(profile, 6, [30, 50])!
    // A flat gutter fits any comb that keeps every gutter on it, so the centres hold
    // to within a gutter.
    for (let k = 0; k < 6; k++) {
      expect(Math.abs(comb.phase + (k + 0.5) * comb.pitch - (40 * k - 0.5))).toBeLessThanOrEqual(6)
    }
    expect(comb.card).toBeGreaterThan(30)
    expect(comb.card).toBeLessThan(38)
  })
})

describe('readRoster', () => {
  it('places the Hands of Resonance and every grid slot by kind, and reads the whole cards', () => {
    const reading = readRoster(drawRoster(), refs)
    expect(Math.abs(reading.grid!.comb.pitch - 100)).toBeLessThan(2)
    const kinds = (row: number) =>
      reading.slots.filter((s) => !s.hands && s.row === row).map((s) => s.kind)
    expect(kinds(0)).toEqual(Array(6).fill('card'))
    expect(kinds(1)).toEqual([...Array(5).fill('card'), 'empty'])
    expect(kinds(2)).toEqual(Array(6).fill('card'))
    expect(kinds(3)).toEqual(Array(6).fill('clipped'))
    const hands = reading.slots.filter((s) => s.hands)
    hands.forEach((s, k) =>
      expect(Math.abs(s.box.x + s.box.w / 2 - (80 + 120 * k))).toBeLessThan(10),
    )
    // Whole cards are read, the rest are not; a card's box is in the screenshot's
    // pixels, over its slot, though the cards are read on a rescaled copy. The blank
    // templates leave the frame match free within its search, hence the slack.
    for (const slot of reading.slots) {
      expect(slot.cell !== null).toBe(slot.kind === 'card')
      if (!slot.cell) continue
      const centre = (r: { x: number; y: number; w: number; h: number }) => [
        r.x + r.w / 2,
        r.y + r.h / 2,
      ]
      const [cx, cy] = centre(slot.cell.box)
      const [sx, sy] = centre(slot.box)
      expect(Math.hypot(cx! - sx!, cy! - sy!)).toBeLessThan(0.25 * slot.box.w)
      expect(slot.cell.box.w / slot.box.w).toBeGreaterThan(0.8)
      expect(slot.cell.box.w / slot.box.w).toBeLessThan(1.25)
    }
    // A plain card with no frame is below S+, and so P0, R0 by rule.
    const card = reading.slots.find((s) => s.kind === 'card')!
    expect(card.frame).toEqual({ family: 'below', sure: true })
    expect([card.cell!.paragon.level, card.cell!.refinement.level]).toEqual([0, 0])
  })

  // Three screenshots read take about 2 s alone, past the default limit while the
  // whole suite runs in parallel.
  it(
    'skips a first row the scroll cuts under the header, and a card under the filter button',
    { timeout: 15_000 },
    () => {
      const kinds = (reading: ReturnType<typeof readRoster>, row: number) =>
        reading.slots.filter((s) => !s.hands && s.row === row).map((s) => s.kind)
      // The title right above the first row's frames: the scroll has cut their tops.
      expect(kinds(readRoster(drawRoster({ header: 322 }), refs), 0)).toEqual(
        Array(6).fill('clipped'),
      )
      // The same title clear of the row.
      expect(kinds(readRoster(drawRoster({ header: 298 }), refs), 0)).toEqual(Array(6).fill('card'))
      expect(kinds(readRoster(drawRoster({ pill: true }), refs), 1)).toEqual([
        ...Array(4).fill('card'),
        'clipped',
        'empty',
      ])
    },
  )
})
