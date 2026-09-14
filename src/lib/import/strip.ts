/* The two tabs and the map strip. The Ally and Enemy tabs are the landmarks
 * the card columns hang from, and their colour is the map's result. The
 * strip's circles sit at a fixed pitch about the same centre whether there
 * are three or five, so only the green ring around the current map needs
 * finding: each circle's ring band is scored for green at the rows where
 * green arcs could be, in a band below the enemy panel (the panel's own bars
 * are green too, and a raw capture goes on below) and a little either side
 * of its nominal centre; the best places the whole strip and, with the outer
 * discs, says how many circles it has. The tick or cross under a circle is
 * the left player's result on that map. The header's halves show the series
 * result, not the map's, and are not read. */

import { Team } from '@/lib/types/team'
import { hsvAt } from './image'
import { STRIP, SUMMARY_BAR, TAB_REGION, TABS, type Region } from './layout'
import type { Rect, RgbaImage } from './types'

// The ring is two thin lines inside its band, a few percent of the band's
// area on a sharp capture and about one on a soft one.
const RING_FLOOR = 0.012

const isGreen = (r: number, g: number, b: number): boolean => g > r + 30 && g > b + 30 && g > 90
const isCream = (r: number, g: number, b: number): boolean =>
  r > 190 && g > 180 && b > 160 && Math.max(r, g, b) - Math.min(r, g, b) < 50

const regionAt = (region: Region, x: number, y: number): Rect => ({
  x: x + region.dx,
  y: y + region.dy,
  w: region.w,
  h: region.h,
})

// ---------- the strip ----------

export interface StripReading {
  // 0-based circle the ring is on.
  mapIndex: number
  mapResults: (Team | null)[]
  // How many circles the strip has: three or five.
  mapCount: number
}

// Green fraction in a circle's ring band.
const ringGreen = (shot: RgbaImage, cx: number, cy: number, radius: number): number => {
  let inRing = 0
  let green = 0
  for (let y = cy - radius - 4; y <= cy + radius + 4; y++) {
    for (let x = Math.round(cx - radius - 4); x <= cx + radius + 4; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      const d = Math.hypot(x - cx, y - cy) / radius
      if (d < 0.85 || d > 1.1) continue
      inRing++
      const p = (y * shot.width + x) * 4
      if (isGreen(shot.data[p]!, shot.data[p + 1]!, shot.data[p + 2]!)) green++
    }
  }
  return inRing ? green / inRing : 0
}

// Cream fraction of a circle's inner disc: present on the strip, absent
// where a three-circle strip has no outer circles.
const discCream = (shot: RgbaImage, cx: number, cy: number, radius: number): number => {
  let n = 0
  let cream = 0
  const r = radius * 0.45
  for (let y = Math.round(cy - r); y <= cy + r; y++) {
    for (let x = Math.round(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      if (Math.hypot(x - cx, y - cy) > r) continue
      n++
      const p = (y * shot.width + x) * 4
      if (isCream(shot.data[p]!, shot.data[p + 1]!, shot.data[p + 2]!)) cream++
    }
  }
  return n ? cream / n : 0
}

// The tick or cross at a circle's lower right: orange for the left player's
// win, blue for a loss, null where it is cropped off or unreadable.
const readBadge = (shot: RgbaImage, cx: number, cy: number, radius: number): Team | null => {
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
      if (x < 0 || y < 0 || x >= shot.width) continue
      n++
      const p = (y * shot.width + x) * 4
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
}

/* The strip is read without knowing whether it has three or five circles:
 * both layouts share the centre and the pitch, so the ring is searched over
 * all five positions; a ring on an outer one means five circles, and a ring
 * on an inner one is settled by whether the outer positions hold a cream
 * disc at all. Null when no ring is found. */
export function readStrip(shot: RgbaImage, searchTop: number): StripReading | null {
  const W = shot.width
  const pitch = STRIP.pitch * W
  const centre = STRIP.centre * W
  const positions = Array.from({ length: 5 }, (_, i) => centre + (i - 2) * pitch)

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
          const frac = ringGreen(shot, cx0 + dx, cy, radius)
          if (frac > best.frac) best = { frac, position: i, cy, dx, radius }
        }
      })
    }
  }
  if (best.frac < RING_FLOOR) return null
  const { cy, radius } = best
  const outer =
    discCream(shot, positions[0]! + best.dx, cy, radius) > 0.5 &&
    discCream(shot, positions[4]! + best.dx, cy, radius) > 0.5
  const mapCount = best.position === 0 || best.position === 4 || outer ? 5 : 3
  const first = mapCount === 5 ? 0 : 1
  const centres = positions.slice(first, first + mapCount).map((cx) => cx + best.dx)
  return {
    mapIndex: best.position - first,
    mapResults: centres.map((cx) => readBadge(shot, cx, cy, radius)),
    mapCount,
  }
}

// ---------- result colours ----------

/* The game paints results in two colours, named here for the team whose
 * colour it is: orange is the ally's (a win on the Ally tab, the strip and
 * the ally panel), blue the enemy's. */

// One pixel as a result colour. The tab and summary fills are pale (saturation
// about a third for the blue); the panel's dark rows and the cream strip are not.
const resultColourAt = (shot: RgbaImage, x: number, y: number): Team | null => {
  const [h, s, v] = hsvAt(shot, x, y)
  if (v < 0.4) return null
  if (h >= 195 && h <= 245 && s >= 0.22) return Team.ENEMY
  if ((h <= 60 || h >= 330) && s >= 0.4) return Team.ALLY
  return null
}

// A region as a result colour, by the circular mean hue of its saturated pixels.
const resultHue = (shot: RgbaImage, rect: Rect): Team | null => {
  let cx = 0
  let cy = 0
  let n = 0
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
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

// Fraction of a region painted in either result colour.
const solidResultFraction = (shot: RgbaImage, rect: Rect): number => {
  let n = 0
  let hit = 0
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      n++
      if (resultColourAt(shot, x, y) !== null) hit++
    }
  }
  return n ? hit / n : 0
}

/* Whether a panel's summary bar sits under a fifth card whose top-left is
 * (x, y): a solid band, not the thin orange and blue stat bars a card row holds. */
export const hasSummaryBar = (shot: RgbaImage, x: number, y: number): boolean =>
  solidResultFraction(shot, regionAt(SUMMARY_BAR, x, y)) >= SUMMARY_BAR.solid

// ---------- the tabs ----------

export interface TabBlock {
  top: number
  bottom: number
  // Orange when that team won this map, blue when it lost.
  colour: Team
}

export interface TabPair {
  ally: TabBlock
  enemy: TabBlock
}

/* The Ally and Enemy tabs, the landmarks every panel region hangs from:
 * the top run is the ally tab, the next run a panel below it the enemy tab.
 * Null unless both are there. */
export function findTabs(shot: RgbaImage): TabPair | null {
  const [x0, x1] = TABS.x
  const [d0, d1] = TABS.darkX
  const runs: TabBlock[] = []
  for (let y = 0; y < shot.height; y++) {
    let orange = 0
    let blue = 0
    for (let x = x0; x < x1; x++) {
      const c = resultColourAt(shot, x, y)
      if (c === Team.ALLY) orange++
      else if (c === Team.ENEMY) blue++
    }
    const fill = Math.max(orange, blue) / (x1 - x0)
    if (fill < TABS.fill) continue
    let coloured = 0
    for (let x = d0; x < d1; x += 2) if (resultColourAt(shot, x, y) !== null) coloured++
    if (coloured / ((d1 - d0) / 2) > TABS.dark) continue
    const colour = orange >= blue ? Team.ALLY : Team.ENEMY
    const last = runs[runs.length - 1]
    if (last && y - last.bottom <= 2 && last.colour === colour) last.bottom = y
    else runs.push({ top: y, bottom: y, colour })
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

/* The Ally tab beside the top panel, placed from the ally column anchor: it
 * is painted in the map winner's colour. Null when the region reads neither. */
export function readTab(shot: RgbaImage, anchorX: number, anchorY: number): Team | null {
  return resultHue(shot, regionAt(TAB_REGION, anchorX, anchorY))
}
