/* What the artifact reader reads and the table it reads against. */

import type { RgbaImage } from '../core/types'

export interface ArtifactReading {
  // The icon with its frame, for the review.
  card: RgbaImage
  // Best first; empty for a header with no badge (no artifact, sure) or with
  // the icon's place outside the shot (not sure).
  candidates: { artifactId: number; score: number }[]
  margin: number
  // A clear lead, a good shape match, and art in the crop; or no badge at all.
  sure: boolean
}

export interface ArtifactTable {
  // One row per artifact: its id, the central art's shape vector and its
  // colour histogram.
  ids: number[]
  vectors: Float32Array[]
  colours: Float32Array[]
}
