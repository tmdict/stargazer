/* The map strip at the bottom and the Ally tab. The strip's circles sit at
 * a fixed pitch whether there are three or five, so only the green ring
 * around the current map needs finding: each circle's ring band is scored
 * for green at the rows where green arcs could be, in a band below the enemy
 * panel (the panel's own bars are green too, and a raw capture goes on
 * below) and a little either side of its nominal centre; the best places the
 * whole strip. The tick or cross under a circle is the left player's result
 * on that map; the Ally tab's colour is the same for the map on screen and
 * is always visible, so it is read too. The header's halves show the series
 * result, not the map's, and are not read. */

import { Team } from '@/lib/types/team'
import { hsvAt } from './image'
import { STRIP, TAB_REGION } from './layout'
import type { RgbaImage } from './types'

export interface StripReading {
  mapIndex: number | null
  mapResults: (Team | null)[]
}

const isGreen = (r: number, g: number, b: number): boolean => g > r + 30 && g > b + 30 && g > 90

export function readStrip(shot: RgbaImage, mapCount: number, searchTop: number): StripReading {
  const W = shot.width
  const pitch = STRIP.pitch * W
  const firstCx = STRIP.centre * W - ((mapCount - 1) / 2) * pitch
  const empty = { mapIndex: null, mapResults: Array.from({ length: mapCount }, () => null) }

  const top = Math.max(0, searchTop)
  const bottom = Math.min(shot.height, top + Math.round(pitch * STRIP.band))
  const greenInRow = new Int32Array(shot.height)
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (isGreen(shot.data[i]!, shot.data[i + 1]!, shot.data[i + 2]!)) greenInRow[y]!++
    }
  }
  const arcNear = (y: number): boolean => {
    for (let dy = -4; dy <= 4; dy++) if ((greenInRow[y + dy] ?? 0) >= 2) return true
    return false
  }

  // Green fraction in a circle's ring band.
  const ringGreen = (cx: number, cy: number, radius: number): number => {
    let inRing = 0
    let green = 0
    for (let y = cy - radius - 4; y <= cy + radius + 4; y++) {
      for (let x = Math.round(cx - radius - 4); x <= cx + radius + 4; x++) {
        if (x < 0 || y < 0 || x >= W || y >= shot.height) continue
        const d = Math.hypot(x - cx, y - cy) / radius
        if (d < 0.85 || d > 1.1) continue
        inRing++
        const p = (y * W + x) * 4
        if (isGreen(shot.data[p]!, shot.data[p + 1]!, shot.data[p + 2]!)) green++
      }
    }
    return inRing ? green / inRing : 0
  }

  // Candidate centres: rows with a green arc about a radius above and,
  // unless the ring's lower half is cropped away, about a radius below.
  let best = { frac: 0, index: 0, cy: 0, dx: 0, radius: 0 }
  for (const scale of STRIP.radiusScales) {
    const radius = Math.round(pitch * STRIP.radius * scale)
    for (let cy = top + radius; cy < bottom; cy += 2) {
      const below = cy + radius
      if (!arcNear(cy - radius) || (below < shot.height - 4 && !arcNear(below))) continue
      for (let i = 0; i < mapCount; i++) {
        for (let dx = -STRIP.slack; dx <= STRIP.slack; dx += 4) {
          const frac = ringGreen(firstCx + i * pitch + dx, cy, radius)
          if (frac > best.frac) best = { frac, index: i, cy, dx, radius }
        }
      }
    }
  }
  // The ring is two thin lines inside the band, a few percent of its area on
  // a sharp capture and about one on a soft one.
  if (best.frac < 0.012) return empty
  const { cy, radius } = best
  const centres = Array.from({ length: mapCount }, (_, i) => firstCx + i * pitch + best.dx)

  const mapResults = centres.map((cx) => {
    const bx = Math.round(cx + radius * 0.72)
    const by = cy + Math.round(radius * 0.72)
    const br = Math.round(radius * 0.36)
    const y1 = Math.min(shot.height - 1, by + br)
    if (y1 < by - br + 6) return null
    let orange = 0
    let blue = 0
    let n = 0
    for (let y = by - br; y <= y1; y++) {
      for (let x = bx - br; x <= bx + br; x++) {
        if (x < 0 || y < 0 || x >= W) continue
        n++
        const p = (y * W + x) * 4
        const r = shot.data[p]!
        const g = shot.data[p + 1]!
        const b = shot.data[p + 2]!
        if (r > 180 && g > 90 && g < 170 && b < 110) orange++
        if (b > 120 && b > r + 40) blue++
      }
    }
    const need = Math.max(10, Math.round(n * 0.06))
    if (orange >= need && orange > blue) return Team.ALLY
    if (blue >= need && blue > orange) return Team.ENEMY
    return null
  })
  return { mapIndex: best.index, mapResults }
}

/* The game's two result colours, by the circular mean hue of the saturated
 * pixels in a region: orange for a win (or the ally panel), blue for a loss
 * (or the enemy panel), null when neither. */
export const resultHue = (
  shot: RgbaImage,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): 'won' | 'lost' | null => {
  let cx = 0
  let cy = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      const [h, s] = hsvAt(shot, x, y)
      if (s < 0.25) continue
      n++
      cx += Math.cos((h * Math.PI) / 180)
      cy += Math.sin((h * Math.PI) / 180)
    }
  }
  if (n < 50) return null
  const hue = ((Math.atan2(cy, cx) * 180) / Math.PI + 360) % 360
  if (hue >= 180 && hue <= 260) return 'lost'
  if (hue <= 60 || hue >= 330) return 'won'
  return null
}

/* The Ally tab beside the top panel: orange when the top (left) team won
 * this map, blue when it lost. Null when the region reads neither. */
export function readTab(shot: RgbaImage, anchorX: number, anchorY: number): Team | null {
  const result = resultHue(
    shot,
    anchorX + TAB_REGION.dx,
    anchorX + TAB_REGION.dx + TAB_REGION.w,
    anchorY + TAB_REGION.dy,
    anchorY + TAB_REGION.dy + TAB_REGION.h,
  )
  return result === null ? null : result === 'won' ? Team.ALLY : Team.ENEMY
}
