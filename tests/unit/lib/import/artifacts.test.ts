import { describe, expect, it } from 'vitest'

import { buildArtifactTable, readArtifact } from '@/lib/import/artifacts'
import { createImage, cropResize } from '@/lib/import/image'
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

const BADGE: [number, number, number] = [181, 81, 70]
const CX = 200
const CY = 100

// A header strip with the icon's art disc drawn a few pixels off the nominal
// centre, the way the game shows it: the central part of the art, round.
const header = (disc: Paint | RgbaImage | null): RgbaImage => {
  const shot = image(400, 200, () => BADGE)
  if (!disc) return shot
  const d = HEADER_ICON.diameter
  const art =
    typeof disc === 'function'
      ? image(d, d, disc)
      : cropResize(disc, { x: 18.5, y: 18.5, w: 91, h: 91 }, d, d)
  const x0 = CX + 7 - d / 2
  const y0 = CY - 5 - d / 2
  for (let y = 0; y < d; y++)
    for (let x = 0; x < d; x++) {
      if (Math.hypot(x - d / 2 + 0.5, y - d / 2 + 0.5) > d / 2) continue
      const from = (y * d + x) * 4
      const to = ((y0 + y) * shot.width + x0 + x) * 4
      shot.data.set(art.data.subarray(from, from + 4), to)
    }
  return shot
}

describe('readArtifact', () => {
  it('finds the art disc near its nominal centre and reads it surely', () => {
    const reading = readArtifact(header(REFS[2]!), CX, CY, table)
    expect(reading.candidates[0]!.artifactId).toBe(2)
    expect(reading.margin).toBeGreaterThan(0.1)
    expect(reading.sure).toBe(true)
  })

  it('is not sure of a black disc even when its colours lead clearly', () => {
    const reading = readArtifact(
      header(() => [0, 0, 0]),
      CX,
      CY,
      table,
    )
    expect(reading.candidates[0]!.artifactId).toBe(4)
    expect(reading.margin).toBeGreaterThan(0.1)
    expect(reading.sure).toBe(false)
  })

  it('is not sure of an empty badge', () => {
    const reading = readArtifact(header(null), CX, CY, table)
    expect(reading.candidates).toHaveLength(3)
    expect(reading.sure).toBe(false)
  })

  it('reads nothing, surely or not, when the search falls off the shot', () => {
    const reading = readArtifact(header(null), -100, -100, table)
    expect(reading.candidates).toEqual([])
    expect(reading.sure).toBe(false)
  })
})
