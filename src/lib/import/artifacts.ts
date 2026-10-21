/* The round artifact icon under each player name. In game the icon is a disc
 * of the artifact's art inside a frame on a badge (a seasonal artifact's
 * frame and badge differ from a permanent one's), so only that disc is read,
 * against the central part of each reference image. The score adds two
 * signals: per-channel correlation follows the art's shapes, and a colour
 * histogram keeps its palette, which per-channel normalisation discards. The
 * header does not keep a fixed distance from the cards the anchor comes from,
 * so the disc is searched around its nominal centre, placed by the best match
 * of any reference, and every reference is scored on that one disc: one left
 * to find its own place can win a crop beside the art (over the disc's rim)
 * and narrow a clear lead to a doubtful one. A reading is sure only when it
 * leads clearly, its shapes match well enough, and the crop holds art at all:
 * the colour term alone still ranks a black or empty disc. A player who
 * fields no artifact gets no badge, and that header reads as none. */

import { cropResize, dot, normalizedVectorMasked } from './core/image'
import type { Rect, RgbaImage } from './core/types'
import { HEADER_ICON } from './layout'
import type { ArtifactReading, ArtifactTable } from './types'

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
// Disc sizes tried around the nominal diameter, and the search around the
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
// No badge: the search window shows the header's own background and the name,
// with no dark frame in it, and nothing matches it. On labelled screenshots a
// badge leaves at least 3% of the window darker than BADGE_DARK and its icon
// scores 1.43 or more; a header without one, no dark pixel and at most 0.76.
const NONE_SCORE = 1
const NONE_DARK_SHARE = 0.01
const BADGE_DARK = 60
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

const luma = (img: RgbaImage, p: number): number =>
  0.299 * img.data[p * 4]! + 0.587 * img.data[p * 4 + 1]! + 0.114 * img.data[p * 4 + 2]!

// Whether a disc crop has art in it: a black, flat or empty disc does not.
function holdsArt(img: RgbaImage): boolean {
  let sum = 0
  let sq = 0
  let dark = 0
  for (const p of MASKED) {
    const l = luma(img, p)
    sum += l
    sq += l * l
    if (l < DARK_LEVEL) dark++
  }
  const n = MASKED.length
  const spread = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
  return spread >= SPREAD_FLOOR && dark / n <= DARK_SHARE
}

// Half the search window's side: every disc place and size it tries.
const windowHalf = (diameter: number): number => REACH + (diameter + SIZES[SIZES.length - 1]!) / 2

function darkShare(shot: RgbaImage, cx: number, cy: number, diameter: number): number {
  const half = windowHalf(diameter)
  let dark = 0
  let n = 0
  for (let y = Math.max(0, Math.round(cy - half)); y < Math.min(shot.height, cy + half); y++) {
    for (let x = Math.max(0, Math.round(cx - half)); x < Math.min(shot.width, cx + half); x++) {
      n++
      if (luma(shot, y * shot.width + x) < BADGE_DARK) dark++
    }
  }
  return n ? dark / n : 0
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

// A disc crop with the two descriptors every reference is scored against.
interface Disc {
  crop: RgbaImage
  shapes: Float32Array
  colour: Float32Array
}

const scoreOn = (disc: Disc, table: ArtifactTable, i: number) => {
  const shape = dot(disc.shapes, table.vectors[i]!)
  return { shape, score: shape + COLOUR_WEIGHT * dot(disc.colour, table.colours[i]!) }
}

export function readArtifact(
  shot: RgbaImage,
  centreX: number,
  centreY: number,
  table: ArtifactTable,
  diameter: number = HEADER_ICON.diameter,
): ArtifactReading {
  let top: { score: number; shape: number; rect: Rect; disc: Disc | null } = {
    score: -Infinity,
    shape: 0,
    rect: square(centreX, centreY, diameter),
    disc: null,
  }
  for (const ds of SIZES) {
    const size = diameter + ds
    for (let dx = -REACH; dx <= REACH; dx += STEP) {
      for (let dy = -REACH; dy <= REACH; dy += STEP) {
        const rect = square(centreX + dx, centreY + dy, size)
        if (rect.x < 0 || rect.y < 0 || rect.x + size > shot.width || rect.y + size > shot.height)
          continue
        const crop = cropResize(shot, rect, T, T)
        const disc = {
          crop,
          shapes: normalizedVectorMasked(crop, MASK),
          colour: colourHistogram(crop),
        }
        table.ids.forEach((_, i) => {
          const { shape, score } = scoreOn(disc, table, i)
          if (score > top.score) top = { score, shape, rect, disc }
        })
      }
    }
  }
  const { disc } = top
  const cardSize = Math.round(top.rect.w * CARD_SCALE)
  const card = square(top.rect.x + top.rect.w / 2, top.rect.y + top.rect.h / 2, cardSize)
  const cardImage = cropResize(shot, card, card.w, card.h)
  // A window that runs off the shot (a crop through the badge) shows too little
  // of it to call the header empty.
  const half = windowHalf(diameter)
  const inShot =
    centreX - half >= 0 &&
    centreY - half >= 0 &&
    centreX + half <= shot.width &&
    centreY + half <= shot.height
  if (
    disc &&
    inShot &&
    top.score < NONE_SCORE &&
    darkShare(shot, centreX, centreY, diameter) < NONE_DARK_SHARE
  )
    return { candidates: [], margin: 0, sure: true, card: cardImage }
  const candidates = disc
    ? table.ids
        .map((artifactId, i) => ({ artifactId, score: scoreOn(disc, table, i).score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : []
  const margin = candidates.length > 1 ? candidates[0]!.score - candidates[1]!.score : 0
  const sure =
    disc !== null && margin >= SURE_MARGIN && top.shape >= SHAPE_FLOOR && holdsArt(disc.crop)
  return { candidates, margin, sure, card: cardImage }
}
