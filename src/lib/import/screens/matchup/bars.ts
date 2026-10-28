/* The team bars of the matchup list. Each game is a panel of two team boxes
 * side by side, the left one under a solid blue bar and the right one under a
 * red bar, and no other screen the import reads draws such a pair. Each pixel
 * row's longest run of each colour is measured, rows whose run spans a good part
 * of the shot join into bars, and a blue and a red bar of about one width, side
 * by side at about one height, are a panel. A bar the top banner partly covers
 * keeps its whole width, so it still pairs. */

import { hsvAt } from '../../core/image'
import type { Rect, RgbaImage } from '../../core/types'
import type { BarColour } from './types'

// Saturated and bright; hue in degrees.
const BAR = { s: 0.45, v: 0.5, blue: [200, 235], red: [15, 345] } as const
// A bar spans 0.43 to 0.45 of the shot on the samples; a run of less is not one.
const BAR_SHARE = 0.3
// A panel's red bar against its blue one, in bar widths: tops within `dy`, widths
// within `dw`, and the red bar starting `gap` right of the blue one's end.
const PAIR = { dy: 0.03, dw: 0.05, gap: [0.05, 0.2] } as const

export type Panel = Record<BarColour, Rect>

const colourAt = (img: RgbaImage, x: number, y: number): BarColour | null => {
  const [h, s, v] = hsvAt(img, x, y)
  if (s <= BAR.s || v <= BAR.v) return null
  if (h > BAR.blue[0] && h < BAR.blue[1]) return 'blue'
  if (h < BAR.red[0] || h > BAR.red[1]) return 'red'
  return null
}

/* Each bar colour's runs of rows, as rectangles over the rows' longest runs. */
function findBars(img: RgbaImage): Record<BarColour, Rect[]> {
  const bars: Record<BarColour, Rect[]> = { blue: [], red: [] }
  const open: Record<BarColour, Rect | null> = { blue: null, red: null }
  const least = BAR_SHARE * img.width
  for (let y = 0; y < img.height; y++) {
    const best = { blue: { x: 0, w: 0 }, red: { x: 0, w: 0 } }
    let run: { colour: BarColour; x: number } | null = null
    for (let x = 0; x <= img.width; x++) {
      const colour = x < img.width ? colourAt(img, x, y) : null
      if (run && colour === run.colour) continue
      if (run && x - run.x > best[run.colour].w) best[run.colour] = { x: run.x, w: x - run.x }
      run = colour ? { colour, x } : null
    }
    for (const colour of ['blue', 'red'] as const) {
      const { x, w } = best[colour]
      const bar = open[colour]
      if (w < least) {
        if (bar) bars[colour].push(bar)
        open[colour] = null
      } else if (bar) {
        const x1 = Math.max(bar.x + bar.w, x + w)
        bar.x = Math.min(bar.x, x)
        bar.w = x1 - bar.x
        bar.h++
      } else {
        open[colour] = { x, y, w, h: 1 }
      }
    }
  }
  for (const colour of ['blue', 'red'] as const) {
    const bar = open[colour]
    if (bar) bars[colour].push(bar)
  }
  return bars
}

/* The panels a shot shows bars for, top to bottom. */
export function findPanels(img: RgbaImage): Panel[] {
  const { blue, red } = findBars(img)
  return blue.flatMap((b) => {
    const r = red.find(
      (r) =>
        Math.abs(r.y - b.y) < PAIR.dy * b.w &&
        Math.abs(r.w - b.w) < PAIR.dw * b.w &&
        r.x - (b.x + b.w) > PAIR.gap[0] * b.w &&
        r.x - (b.x + b.w) < PAIR.gap[1] * b.w,
    )
    return r ? [{ blue: b, red: r }] : []
  })
}

/* Whether a shot shows the matchup list: a panel's pair of bars. */
export const isMatchupScreen = (img: RgbaImage): boolean => findPanels(img).length > 0
