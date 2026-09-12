/* The map strip at the bottom and the Ally tab. The strip's circles sit at a
 * fixed pitch centred on the image whether there are three or five, so only
 * the green ring around the current map needs finding: it is searched below
 * the enemy panel (healing bars above it are green too), and confirmed by
 * how much green each circle's ring band holds. The tick or cross under a
 * circle is the left player's result on that map; the Ally tab's colour is
 * the same for the map on screen and is always visible, so it is read too. */

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
  const radius = Math.round(pitch * STRIP.radius)
  const firstCx = STRIP.centre * W - ((mapCount - 1) / 2) * pitch
  const centres = Array.from({ length: mapCount }, (_, i) => firstCx + i * pitch)
  const empty = { mapIndex: null, mapResults: centres.map(() => null) }

  let gn = 0
  let gy = 0
  let gMin = shot.height
  let gMax = 0
  for (let y = Math.max(0, searchTop); y < shot.height; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (isGreen(shot.data[i]!, shot.data[i + 1]!, shot.data[i + 2]!)) {
        gn++
        gy += y
        if (y < gMin) gMin = y
        if (y > gMax) gMax = y
      }
    }
  }
  if (gn < 30) return empty
  // The ring's lower half may be cropped away; then the top arc places it.
  const cut = gMax >= shot.height - 3
  const cy = cut ? gMin + radius : Math.round(gy / gn)

  // Green fraction in each circle's ring band; the current map's ring wins.
  let mapIndex: number | null = null
  let bestGreen = 0
  centres.forEach((cx, i) => {
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
    const frac = inRing ? green / inRing : 0
    if (frac > bestGreen) {
      bestGreen = frac
      mapIndex = i
    }
  })
  // The ring is two thin lines inside the band, a few percent of its area.
  if (bestGreen < 0.02) return empty

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
  return { mapIndex, mapResults }
}

/* The Ally tab beside the top panel: orange when the top (left) team won
 * this map, blue when it lost. Null when the region reads neither. */
export function readTab(shot: RgbaImage, anchorX: number, anchorY: number): Team | null {
  let cx = 0
  let cy = 0
  let n = 0
  for (let y = anchorY + TAB_REGION.dy; y < anchorY + TAB_REGION.dy + TAB_REGION.h; y++) {
    for (let x = anchorX + TAB_REGION.dx; x < anchorX + TAB_REGION.dx + TAB_REGION.w; x++) {
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
  if (hue >= 180 && hue <= 260) return Team.ENEMY
  if (hue <= 60 || hue >= 330) return Team.ALLY
  return null
}
