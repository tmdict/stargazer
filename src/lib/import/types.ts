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
  // Matched a costume reference rather than the bundled art.
  costume: boolean
}

export type StarFamily = 'white' | 'purple' | 'gold' | 'red'

// Who the face is, once a side's five cells have been settled against each other.
export interface HeroIdentity {
  // Best first. With `recognised` false none cleared the floor and the list
  // is only a hint for the picker.
  candidates: HeroCandidate[]
  recognised: boolean
  // Best score minus the runner-up's: the confidence signal.
  margin: number
  // Whether the margin clears the bar for this kind of match.
  sure: boolean
}

export interface ParagonReading {
  level: number
  score: number
  // Best score among the other levels' frames.
  runnerUp: number
  sure: boolean
}

export interface RefinementReading {
  level: number
  stars: number
  family: StarFamily
}

export interface HeroReading extends HeroIdentity {
  // The matched frame, in the normalised screenshot's pixels.
  box: Rect
  // The card, cropped, for the review grid.
  card: RgbaImage
  // The face crop's descriptor, kept so a correction can be learned.
  descriptor: Float32Array
  paragon: ParagonReading
  refinement: RefinementReading
}

export interface ArtifactReading {
  candidates: { artifactId: number; score: number }[]
  margin: number
}

export type ImportWarning =
  | { kind: 'no-panel'; side: Team }
  | { kind: 'no-strip' }
  | { kind: 'unrecognised'; side: Team; row: number }

// What one screenshot says, independent of the mode it is reviewed in: the
// strip is always read, and the board it fills is settled at review time.
export interface ScreenshotReading {
  // 0-based, from the green ring on the bottom strip; null when no strip.
  mapIndex: number | null
  // How many maps the match had, from the strip's circles; null when no strip.
  mapCount: number | null
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

// A crop window over a worker-resident portrait: width, horizontal centre, top.
export interface CropWindow {
  w: number
  xc: number
  yt: number
}

export interface PortraitRef {
  characterId: number
  image: RgbaImage
  // A costume reference captured from the game rather than the bundled art;
  // its framing is looser, so it is cut over a wider window grid.
  costume?: boolean
}

export interface HeroTable {
  // Row i describes descriptor i: the hero, whether it was learned, and the
  // portrait it was cut from (-1 for a learned row).
  ids: Int32Array
  learnedRows: Uint8Array
  sources: Int32Array
  // Int8-quantised descriptors, row-major, DESCRIPTOR_LENGTH per row.
  vectors: Int8Array
  // Worker-resident portraits with their windows (in row order, in the
  // portrait's own pixels) and their scale over the half-size art, for the
  // refinement crops.
  portraits: {
    image: RgbaImage
    windows: readonly CropWindow[]
    scale: number
    costume: boolean
  }[]
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
