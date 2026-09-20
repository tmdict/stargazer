/* The round artifact icon under each player name, matched against the icon
 * set with the badge corner masked (the "+30" chip covers it). Margins are
 * thin because the in-game icon carries a gold ring the references lack, so
 * readings are always offered for review. */

import { cropResize, dot, normalizedVectorMasked } from './image'
import { HEADER_ICON } from './layout'
import type { ArtifactReading, ArtifactTable, Rect, RgbaImage } from './types'

const T = 40
const MASK: boolean[] = []
for (let y = 0; y < T; y++) {
  for (let x = 0; x < T; x++) {
    const dx = x - T / 2 + 0.5
    const dy = y - T / 2 + 0.5
    MASK.push(dx * dx + dy * dy <= (T * 0.44) ** 2 && !(x > T * 0.58 && y > T * 0.58))
  }
}
// The reference art fills its square; the in-game icon is cut slightly
// inside it, so each reference contributes a few inset crops.
const INSETS = [0, 0.05, 0.1, 0.15]
const DIAMETERS = [-8, -2, 4, 10]
// Wide enough for the header's spacing to differ by a phone shape: the icons
// sit about two dozen pixels further from the column on a taller screen.
const OFFSETS = [-28, -21, -14, -7, 0, 7, 14, 21, 28]
const OFFSETS_Y = [-16, -8, 0, 8, 16]

export function buildArtifactTable(
  icons: readonly { artifactId: number; image: RgbaImage }[],
): ArtifactTable {
  const ids: number[] = []
  const vectors: Float32Array[] = []
  for (const { artifactId, image } of icons) {
    for (const inset of INSETS) {
      const px = Math.round(image.width * inset)
      const rect = { x: px, y: px, w: image.width - 2 * px, h: image.height - 2 * px }
      ids.push(artifactId)
      vectors.push(normalizedVectorMasked(cropResize(image, rect, T, T), MASK))
    }
  }
  return { ids, vectors }
}

export function readArtifact(
  shot: RgbaImage,
  centreX: number,
  centreY: number,
  table: ArtifactTable,
): ArtifactReading {
  let bestBox: Rect = {
    x: Math.round(centreX - HEADER_ICON.diameter / 2),
    y: Math.round(centreY - HEADER_ICON.diameter / 2),
    w: HEADER_ICON.diameter,
    h: HEADER_ICON.diameter,
  }
  let bestScore = -Infinity
  const best = new Map<number, number>()
  for (const dd of DIAMETERS) {
    const d = HEADER_ICON.diameter + dd
    for (const dx of OFFSETS) {
      for (const dy of OFFSETS_Y) {
        const rect = {
          x: Math.round(centreX + dx - d / 2),
          y: Math.round(centreY + dy - d / 2),
          w: d,
          h: d,
        }
        if (rect.x < 0 || rect.y < 0 || rect.x + d > shot.width || rect.y + d > shot.height)
          continue
        const v = normalizedVectorMasked(cropResize(shot, rect, T, T), MASK)
        table.vectors.forEach((ref, i) => {
          const s = dot(v, ref)
          if (s > bestScore) {
            bestScore = s
            bestBox = rect
          }
          const id = table.ids[i]!
          if ((best.get(id) ?? -1) < s) best.set(id, s)
        })
      }
    }
  }
  const candidates = [...best.entries()]
    .map(([artifactId, score]) => ({ artifactId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const margin = candidates.length > 1 ? candidates[0]!.score - candidates[1]!.score : 0
  return { candidates, margin, card: cropResize(shot, bestBox, bestBox.w, bestBox.h) }
}
