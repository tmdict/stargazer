import { describe, expect, it } from 'vitest'

import { buildArtifactTable, readArtifact } from '@/lib/import/artifacts'
import { createImage } from '@/lib/import/image'
import { HEADER_ICON } from '@/lib/import/layout'
import type { RgbaImage } from '@/lib/import/types'

type Paint = (x: number, y: number) => [number, number, number]

const image = (w: number, h: number, paint: Paint): RgbaImage => {
  const img = createImage(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      img.data.set([...paint(x, y), 255], i)
    }
  return img
}

// Reference icons with different shapes and palettes; the fourth is mostly
// dark, so a black disc matches its colours closely.
const REFS: Record<number, RgbaImage> = {
  1: image(128, 128, (x, y) =>
    Math.hypot(x - 64, y - 64) % 24 < 12 ? [230, 190, 40] : [150, 20, 20],
  ),
  2: image(128, 128, (x, y) => ((x + y) % 32 < 16 ? [40, 90, 220] : [210, 230, 250])),
  3: image(128, 128, (x, y) =>
    (Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? [30, 160, 70] : [240, 240, 200],
  ),
  4: image(128, 128, (x, y) =>
    Math.hypot(x - 64, y - 64) % 40 < 3 ? [200, 200, 220] : [10, 10, 14],
  ),
}
const table = buildArtifactTable(
  Object.entries(REFS).map(([id, img]) => ({ artifactId: Number(id), image: img })),
)

// Draws `id`'s art as a disc centred at (x, y), as the header shows it: the
// middle 71% of the reference filling the disc. Below 1, `strength` blends it
// into what is under it.
const disc = (shot: RgbaImage, id: number, x: number, y: number, strength = 1): void => {
  const ref = REFS[id]!
  const r = HEADER_ICON.diameter / 2
  const zoom = (ref.width * 0.71) / HEADER_ICON.diameter
  for (let py = Math.ceil(y - r); py < y + r; py++)
    for (let px = Math.ceil(x - r); px < x + r; px++) {
      if (Math.hypot(px - x, py - y) > r) continue
      const u = Math.min(ref.width - 1, Math.round(ref.width / 2 + (px - x) * zoom))
      const v = Math.min(ref.height - 1, Math.round(ref.height / 2 + (py - y) * zoom))
      const i = (py * shot.width + px) * 4
      for (let c = 0; c < 3; c++)
        shot.data[i + c] = Math.round(
          strength * ref.data[(v * ref.width + u) * 4 + c]! + (1 - strength) * shot.data[i + c]!,
        )
    }
}

describe('readArtifact', () => {
  it('is not sure of a black disc even when its colours lead clearly', () => {
    // A red header badge with a black disc where the art would be, a few
    // pixels off the nominal centre.
    const cx = 200
    const cy = 100
    const shot = image(400, 200, (x, y) =>
      Math.hypot(x - cx - 7, y - cy + 5) <= HEADER_ICON.diameter / 2 ? [0, 0, 0] : [181, 81, 70],
    )
    const reading = readArtifact(shot, cx, cy, table)
    expect(reading.candidates[0]!.artifactId).toBe(4)
    expect(reading.margin).toBeGreaterThan(0.1)
    expect(reading.sure).toBe(false)
  })

  // A player who fields no artifact gets no badge: the header's background and
  // the start of the name fill the search window.
  it('reads a header with no badge as no artifact, unless the shot is cropped through it', () => {
    const header = (cx: number, cy: number): RgbaImage =>
      image(400, 200, (x, y) =>
        x > cx - 10 && x < cx + 30 && y > cy - 8 && y < cy + 8 && x % 7 < 2
          ? [250, 250, 250]
          : [205, 125, 70],
      )
    const reading = readArtifact(header(200, 100), 200, 100, table)
    expect(reading.candidates).toEqual([])
    expect(reading.sure).toBe(true)
    // Near the top edge the search window runs off the shot, where a badge
    // could be, so the header is not called empty.
    expect(readArtifact(header(200, 25), 200, 25, table).sure).toBe(false)
  })

  // A rival's art beside the disc, still inside the search, must not count as
  // the rival matching the disc.
  it('scores every reference on the disc the best match settled on', () => {
    const cx = 200
    const cy = 100
    const shot = image(400, 200, () => [181, 81, 70])
    disc(shot, 1, cx - 17, cy)
    disc(shot, 2, cx + 17, cy, 0.8)
    const reading = readArtifact(shot, cx, cy, table)
    expect(reading.candidates[0]!.artifactId).toBe(1)
    expect(reading.margin).toBeGreaterThan(1)
  })
})
