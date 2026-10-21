/* The green ring every match screen draws around the current map on its
 * strip: the result screen's map strip, the formation panel's slot strip and
 * the replay's map strip. */

import type { RgbaImage } from '../../core/types'

// The ring is two thin lines inside its band, a few percent of the band's
// area on a sharp capture and about one on a soft one.
export const GREEN_RING_FLOOR = 0.012

export const isGreen = (r: number, g: number, b: number): boolean =>
  g > r + 30 && g > b + 30 && g > 90

// Green fraction in a circle's ring band.
export const ringGreen = (shot: RgbaImage, cx: number, cy: number, radius: number): number => {
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
