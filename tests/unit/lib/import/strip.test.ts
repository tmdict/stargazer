import { describe, expect, it } from 'vitest'

import { createImage } from '@/lib/import/image'
import { STRIP } from '@/lib/import/layout'
import { findTabs, readStrip, readTab } from '@/lib/import/strip'
import { Team } from '@/lib/types/team'

const W = 1150
const H = 1660

const fill = (img: ReturnType<typeof createImage>, rgb: [number, number, number]) => {
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = rgb[0]
    img.data[i + 1] = rgb[1]
    img.data[i + 2] = rgb[2]
    img.data[i + 3] = 255
  }
}

const disc = (
  img: ReturnType<typeof createImage>,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  rgb: [number, number, number],
) => {
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
    for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d < r0 || d > r1) continue
      const i = (y * img.width + x) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
    }
  }
}

describe('readStrip', () => {
  it('finds the ringed circle and reads the badges', () => {
    const shot = createImage(W, H)
    fill(shot, [60, 55, 50])
    const pitch = STRIP.pitch * W
    const radius = pitch * STRIP.radius
    const cy = 1600
    const first = STRIP.centre * W - 2 * pitch
    const results = [Team.ALLY, Team.ENEMY, Team.ALLY, Team.ALLY, Team.ENEMY]
    results.forEach((who, i) => {
      const cx = first + i * pitch
      disc(shot, cx, cy, 0, radius, [245, 238, 225])
      if (i === 2) disc(shot, cx, cy, radius * 0.9, radius * 1.02, [60, 190, 80])
      disc(
        shot,
        cx + radius * 0.72,
        cy + radius * 0.72,
        0,
        radius * 0.3,
        who === Team.ALLY ? [235, 130, 60] : [60, 110, 200],
      )
    })
    const reading = readStrip(shot, 1500)
    expect(reading.mapCount).toBe(5)
    expect(reading.mapIndex).toBe(2)
    expect(reading.mapResults).toEqual(results)
  })

  it('tells a three-circle strip by its missing outer discs', () => {
    const shot = createImage(W, H)
    fill(shot, [60, 55, 50])
    const pitch = STRIP.pitch * W
    const radius = pitch * STRIP.radius
    const cy = 1600
    const first = STRIP.centre * W - pitch
    for (let i = 0; i < 3; i++) {
      const cx = first + i * pitch
      disc(shot, cx, cy, 0, radius, [245, 238, 225])
      if (i === 0) disc(shot, cx, cy, radius * 0.9, radius * 1.02, [60, 190, 80])
      disc(shot, cx + radius * 0.72, cy + radius * 0.72, 0, radius * 0.3, [235, 130, 60])
    }
    const reading = readStrip(shot, 1500)
    expect(reading.mapCount).toBe(3)
    expect(reading.mapIndex).toBe(0)
    expect(reading.mapResults).toEqual([Team.ALLY, Team.ALLY, Team.ALLY])
  })

  it('reports nothing when there is no ring', () => {
    const shot = createImage(W, H)
    fill(shot, [60, 55, 50])
    expect(readStrip(shot, 1500)).toEqual({ mapIndex: null, mapResults: [], mapCount: null })
  })
})

describe('readTab', () => {
  it('reads orange as the left player and blue as the right', () => {
    const shot = createImage(300, 300)
    fill(shot, [232, 140, 70])
    expect(readTab(shot, 60, 100)).toBe(Team.ALLY)
    fill(shot, [95, 125, 190])
    expect(readTab(shot, 60, 100)).toBe(Team.ENEMY)
    fill(shot, [120, 120, 120])
    expect(readTab(shot, 60, 100)).toBeNull()
  })
})

describe('findTabs', () => {
  const block = (
    img: ReturnType<typeof createImage>,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    rgb: [number, number, number],
  ) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * img.width + x) * 4
        img.data[i] = rgb[0]
        img.data[i + 1] = rgb[1]
        img.data[i + 2] = rgb[2]
      }
    }
  }
  const orange: [number, number, number] = [225, 147, 90]
  const blue: [number, number, number] = [124, 148, 188]

  it('finds the ally and enemy tabs and reads their colours', () => {
    const shot = createImage(W, H)
    fill(shot, [60, 55, 50])
    block(shot, 0, W, 20, 120, orange) // the header bar spans the width: not a tab
    block(shot, 15, 165, 160, 230, orange)
    block(shot, 15, 165, 870, 940, blue)
    block(shot, 0, W, 760, 800, orange) // the summary bar spans the width: not a tab
    expect(findTabs(shot)).toEqual({
      ally: { top: 160, bottom: 229, won: true },
      enemy: { top: 870, bottom: 939, won: false },
    })
    expect(findTabs(createImage(W, H))).toBeNull()
  })
})
