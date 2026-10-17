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
})
