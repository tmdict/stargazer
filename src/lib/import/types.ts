/* Match screenshot import: the reading a result screenshot yields, and the
 * reference tables the readers match against. Pure data, shared by the worker,
 * the composable, and the plan builder in lib/teams/teamImport. Every pixel
 * buffer is an RGBA `RgbaImage` (the shape of a canvas ImageData), so nothing
 * here depends on the DOM. */

import type { Team } from '@/lib/types/team'

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface HeroCandidate {
  characterId: number
  score: number
  // Matched a descriptor learned from an earlier correction rather than the
  // bundled portrait.
  learned: boolean
}

export type StarFamily = 'white' | 'purple' | 'gold' | 'red'

export interface HeroReading {
  // The matched frame, in the normalised screenshot's pixels.
  box: Rect
  // The card, cropped, for the review grid.
  card: RgbaImage
  // Best first. With `recognised` false none cleared the floor and the list
  // is only a hint for the picker.
  candidates: HeroCandidate[]
  recognised: boolean
  // Best score minus the runner-up's: the confidence signal.
  margin: number
  // The face crop's descriptor, kept so a correction can be learned.
  descriptor: Float32Array
  paragon: { level: number; score: number; runnerUp: number; sure: boolean }
  refinement: { level: number; stars: number; family: StarFamily }
}

export interface ArtifactReading {
  candidates: { artifactId: number; score: number }[]
  margin: number
}

export type ImportWarning =
  | { kind: 'no-panel'; side: Team }
  | { kind: 'no-strip' }
  | { kind: 'unrecognised'; side: Team; row: number }

export interface ScreenshotReading {
  // 0-based, from the green ring on the bottom strip; null when no strip.
  mapIndex: number | null
  // The winner of this map, from the Ally tab colour.
  winner: Team | null
  // Per strip circle, who won, from the tick or cross; null where cropped off.
  mapResults: (Team | null)[]
  // Five rows each, top to bottom.
  sides: Record<Team, HeroReading[]>
  artifacts: Record<Team, ArtifactReading | null>
  warnings: ImportWarning[]
}

// ---------- references ----------

export interface FrameRef {
  level: number
  scale: number
  image: RgbaImage
}

export interface HeroTable {
  // Row i describes descriptor i: the hero and whether it was learned.
  ids: Int32Array
  learnedRows: Uint8Array
  // Int8-quantised descriptors, row-major, DESCRIPTOR_LENGTH per row.
  vectors: Int8Array
  // Worker-resident portraits for the refinement crops.
  portraits: Map<number, RgbaImage>
}

export interface ArtifactTable {
  ids: number[]
  vectors: Float32Array[]
}

export interface LearnedIcon {
  characterId: number
  // Int8-quantised descriptor, base64.
  descriptor: string
  learnedAt: number
}

export interface ReferenceSet {
  frames: FrameRef[]
  heroes: HeroTable
  artifacts: ArtifactTable
}
