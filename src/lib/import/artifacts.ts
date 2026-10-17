/* The round artifact icon under each player name. In game the icon is a disc
 * of the artifact's art inside a frame on a badge (a seasonal artifact's
 * frame and badge differ from a permanent one's), so only that disc is read,
 * against the central part of each reference image. The score adds two
 * signals: per-channel correlation follows the art's shapes, and a colour
 * histogram keeps its palette, which per-channel normalisation discards. The
 * header does not keep a fixed distance from the cards the anchor comes from,
 * so the disc is searched around its nominal centre. A reading is sure only
 * when it leads clearly, its shapes match well enough, and the crop holds art
 * at all: the colour term alone still ranks a black or empty disc. */

import { cropResize, dot, normalizedVectorMasked } from './image'
import { HEADER_ICON } from './layout'
import type { ArtifactReading, ArtifactTable, Rect, RgbaImage } from './types'

const T = 40
const MASK: boolean[] = []
for (let y = 0; y < T; y++) {
  for (let x = 0; x < T; x++) {
    const dx = x - T / 2 + 0.5
    const dy = y - T / 2 + 0.5
    MASK.push(dx * dx + dy * dy <= (T * 0.45) ** 2)
  }
}
const MASKED = MASK.flatMap((on, i) => (on ? [i] : []))
// The disc shows about the central 71% of the reference art.
const REFERENCE_ZOOM = 0.71
// Disc sizes tried around HEADER_ICON.diameter, and the search around the
// nominal centre.
const SIZES = [-3, 0, 3]
const REACH = 18
const STEP = 3
const COLOUR_WEIGHT = 1
// The floors sit under every correctly read icon measured on labelled
// screenshots and above black, empty and icon-less crops.
const SURE_MARGIN = 0.1
const SHAPE_FLOOR = 0.34
const SPREAD_FLOOR = 24
const DARK_LEVEL = 20
const DARK_SHARE = 0.5
// The review card shows the disc with its frame around it.
const CARD_SCALE = 1.8

// 4×4×4 RGB histogram over the disc, square-rooted so a dot product is the
// Bhattacharyya coefficient of two histograms.
function colourHistogram(img: RgbaImage): Float32Array {
  const h = new Float32Array(64)
  for (const p of MASKED) {
    const r = img.data[p * 4]! >> 6
    const g = img.data[p * 4 + 1]! >> 6
    const b = img.data[p * 4 + 2]! >> 6
    h[r * 16 + g * 4 + b]! += 1
  }
  for (let i = 0; i < 64; i++) h[i] = Math.sqrt(h[i]! / MASKED.length)
  return h
}

// Whether a disc crop has art in it: a black, flat or empty disc does not.
function holdsArt(img: RgbaImage): boolean {
  let sum = 0
  let sq = 0
  let dark = 0
  for (const p of MASKED) {
    const l = 0.299 * img.data[p * 4]! + 0.587 * img.data[p * 4 + 1]! + 0.114 * img.data[p * 4 + 2]!
    sum += l
    sq += l * l
    if (l < DARK_LEVEL) dark++
  }
  const n = MASKED.length
  const spread = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
  return spread >= SPREAD_FLOOR && dark / n <= DARK_SHARE
}

const square = (cx: number, cy: number, size: number): Rect => ({
  x: Math.round(cx - size / 2),
  y: Math.round(cy - size / 2),
  w: size,
  h: size,
})

export function buildArtifactTable(
  icons: readonly { artifactId: number; image: RgbaImage }[],
): ArtifactTable {
  const ids: number[] = []
  const vectors: Float32Array[] = []
  const colours: Float32Array[] = []
  for (const { artifactId, image } of icons) {
    const w = image.width * REFERENCE_ZOOM
    const h = image.height * REFERENCE_ZOOM
    const centre = cropResize(
      image,
      { x: (image.width - w) / 2, y: (image.height - h) / 2, w, h },
      T,
      T,
    )
    ids.push(artifactId)
    vectors.push(normalizedVectorMasked(centre, MASK))
    colours.push(colourHistogram(centre))
  }
  return { ids, vectors, colours }
}

export function readArtifact(
  shot: RgbaImage,
  centreX: number,
  centreY: number,
  table: ArtifactTable,
): ArtifactReading {
  const best = new Map<number, number>()
  let top: { score: number; shape: number; rect: Rect; crop: RgbaImage | null } = {
    score: -Infinity,
    shape: 0,
    rect: square(centreX, centreY, HEADER_ICON.diameter),
    crop: null,
  }
  for (const ds of SIZES) {
    const size = HEADER_ICON.diameter + ds
    for (let dx = -REACH; dx <= REACH; dx += STEP) {
      for (let dy = -REACH; dy <= REACH; dy += STEP) {
        const rect = square(centreX + dx, centreY + dy, size)
        if (rect.x < 0 || rect.y < 0 || rect.x + size > shot.width || rect.y + size > shot.height)
          continue
        const crop = cropResize(shot, rect, T, T)
        const shapes = normalizedVectorMasked(crop, MASK)
        const colour = colourHistogram(crop)
        table.ids.forEach((id, i) => {
          const shape = dot(shapes, table.vectors[i]!)
          const score = shape + COLOUR_WEIGHT * dot(colour, table.colours[i]!)
          if (score > top.score) top = { score, shape, rect, crop }
          if ((best.get(id) ?? -Infinity) < score) best.set(id, score)
        })
      }
    }
  }
  const candidates = [...best.entries()]
    .map(([artifactId, score]) => ({ artifactId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const margin = candidates.length > 1 ? candidates[0]!.score - candidates[1]!.score : 0
  const sure =
    top.crop !== null && margin >= SURE_MARGIN && top.shape >= SHAPE_FLOOR && holdsArt(top.crop)
  const cardSize = Math.round(top.rect.w * CARD_SCALE)
  const card = square(top.rect.x + top.rect.w / 2, top.rect.y + top.rect.h / 2, cardSize)
  return { candidates, margin, sure, card: cropResize(shot, card, card.w, card.h) }
}
