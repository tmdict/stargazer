/* The map strip at the bottom and the Ally tab. The strip's circles sit at
 * a fixed pitch about the same centre whether there are three or five, so
 * only the green ring around the current map needs finding: each circle's
 * ring band is scored for green at the rows where green arcs could be, in a
 * band below the enemy panel (the panel's own bars are green too, and a raw
 * capture goes on below) and a little either side of its nominal centre; the
 * best places the whole strip and, with the outer discs, says how many
 * circles it has. The tick or cross under a circle is the left player's result
 * on that map; the Ally tab's colour is the same for the map on screen and
 * is always visible, so it is read too. The header's halves show the series
 * result, not the map's, and are not read. */

import { Team } from '@/lib/types/team'
import { hsvAt } from './image'
import { STRIP, TAB_REGION, TABS } from './layout'
import type { RgbaImage } from './types'

export interface StripReading {
  mapIndex: number | null
  mapResults: (Team | null)[]
  // How many circles the strip has (three or five); null when no ring was found.
  mapCount: number | null
}

const isGreen = (r: number, g: number, b: number): boolean => g > r + 30 && g > b + 30 && g > 90
const isCream = (r: number, g: number, b: number): boolean =>
  r > 190 && g > 180 && b > 160 && Math.max(r, g, b) - Math.min(r, g, b) < 50

/* The strip is read without knowing whether it has three or five circles:
 * both layouts share the centre and the pitch, so the ring is searched over
 * all five positions; a ring on an outer one means five circles, and a ring
 * on an inner one is settled by whether the outer positions hold a cream
 * disc at all. */
export function readStrip(shot: RgbaImage, searchTop: number): StripReading {
  const W = shot.width
  const pitch = STRIP.pitch * W
  const centre = STRIP.centre * W
  const positions = Array.from({ length: 5 }, (_, i) => centre + (i - 2) * pitch)
  const empty = { mapIndex: null, mapResults: [], mapCount: null }

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

  // Cream fraction of a circle's inner disc: present on the strip, absent
  // where a three-circle strip has no outer circles.
  const discCream = (cx: number, cy: number, radius: number): number => {
    let n = 0
    let cream = 0
    const r = radius * 0.45
    for (let y = Math.round(cy - r); y <= cy + r; y++) {
      for (let x = Math.round(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= shot.height) continue
        if (Math.hypot(x - cx, y - cy) > r) continue
        n++
        const p = (y * W + x) * 4
        if (isCream(shot.data[p]!, shot.data[p + 1]!, shot.data[p + 2]!)) cream++
      }
    }
    return n ? cream / n : 0
  }

  // Candidate centres: rows with a green arc about a radius above and,
  // unless the ring's lower half is cropped away, about a radius below.
  let best = { frac: 0, position: 0, cy: 0, dx: 0, radius: 0 }
  for (const scale of STRIP.radiusScales) {
    const radius = Math.round(pitch * STRIP.radius * scale)
    for (let cy = top + radius; cy < bottom; cy += 2) {
      const below = cy + radius
      if (!arcNear(cy - radius) || (below < shot.height - 4 && !arcNear(below))) continue
      positions.forEach((cx0, i) => {
        for (let dx = -STRIP.slack; dx <= STRIP.slack; dx += 4) {
          const frac = ringGreen(cx0 + dx, cy, radius)
          if (frac > best.frac) best = { frac, position: i, cy, dx, radius }
        }
      })
    }
  }
  // The ring is two thin lines inside the band, a few percent of its area on
  // a sharp capture and about one on a soft one.
  if (best.frac < 0.012) return empty
  const { cy, radius } = best
  const outer =
    discCream(positions[0]! + best.dx, cy, radius) > 0.5 &&
    discCream(positions[4]! + best.dx, cy, radius) > 0.5
  const mapCount = best.position === 0 || best.position === 4 || outer ? 5 : 3
  const first = mapCount === 5 ? 0 : 1
  const centres = positions.slice(first, first + mapCount).map((cx) => cx + best.dx)

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
  return { mapIndex: best.position - first, mapResults, mapCount }
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

// One pixel as one of the two result colours: the tab and summary fills are
// pale (saturation about a third for the blue), the panel's dark rows and
// the cream strip are not.
const resultColourAt = (shot: RgbaImage, x: number, y: number): 'won' | 'lost' | null => {
  const [h, s, v] = hsvAt(shot, x, y)
  if (v < 0.4) return null
  if (h >= 195 && h <= 245 && s >= 0.22) return 'lost'
  if ((h <= 60 || h >= 330) && s >= 0.4) return 'won'
  return null
}

/* Fraction of a region painted in either result colour: about one for a
 * tab or a summary bar, small for a card row's thin stat bars. */
export const solidResultFraction = (
  shot: RgbaImage,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number => {
  let n = 0
  let hit = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      n++
      if (resultColourAt(shot, x, y) !== null) hit++
    }
  }
  return n ? hit / n : 0
}

export interface TabBlock {
  top: number
  bottom: number
  // Orange: that team won this map.
  won: boolean
}

/* The Ally and Enemy tabs, the landmarks every panel region hangs from:
 * the top run is the ally tab, the next run a panel below it the enemy tab.
 * Null unless both are there. */
export function findTabs(shot: RgbaImage): { ally: TabBlock; enemy: TabBlock } | null {
  const [x0, x1] = TABS.x
  const [d0, d1] = TABS.darkX
  const runs: { top: number; bottom: number; won: boolean }[] = []
  for (let y = 0; y < shot.height; y++) {
    let won = 0
    let lost = 0
    for (let x = x0; x < x1; x++) {
      const c = resultColourAt(shot, x, y)
      if (c === 'won') won++
      else if (c === 'lost') lost++
    }
    const fill = Math.max(won, lost) / (x1 - x0)
    if (fill < TABS.fill) continue
    let dark = 0
    for (let x = d0; x < d1; x += 2) if (resultColourAt(shot, x, y) !== null) dark++
    if (dark / ((d1 - d0) / 2) > TABS.dark) continue
    const colourWon = won >= lost
    const last = runs[runs.length - 1]
    if (last && y - last.bottom <= 2 && last.won === colourWon) last.bottom = y
    else runs.push({ top: y, bottom: y, won: colourWon })
  }
  const tabs = runs.filter((r) => {
    const h = r.bottom - r.top + 1
    return h >= TABS.height[0] && h <= TABS.height[1]
  })
  for (let i = 0; i < tabs.length; i++) {
    const ally = tabs[i]!
    const enemy = tabs
      .slice(i + 1)
      .find((t) => t.top - ally.top >= TABS.gap[0] && t.top - ally.top <= TABS.gap[1])
    if (enemy) return { ally, enemy }
  }
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
