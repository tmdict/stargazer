/* Match screenshot import: the readings a result or formation screenshot
 * yields, and the reference tables the readers match against. Pure data,
 * shared by the worker, the composable, and the plan builder in
 * lib/teams/teamImport. Every pixel buffer is an RGBA `RgbaImage` (the shape
 * of a canvas ImageData), so nothing here depends on the DOM. */

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
  // The level's colour evidence is strong enough; for R0, the row has no pink tint.
  sure: boolean
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
  // The icon with its frame, for the review.
  card: RgbaImage
  candidates: { artifactId: number; score: number }[]
  margin: number
  // A clear lead, a good shape match, and art in the crop.
  sure: boolean
}

export type ImportWarning =
  | { kind: 'no-panel'; side: Team }
  | { kind: 'no-strip' }
  | { kind: 'unrecognised'; side: Team; row: number }
  // A formation shot without a whole board: nothing else is read from it.
  | { kind: 'no-board' }
  // A replay frame the arena could not be matched in: no board to draw.
  | { kind: 'no-arena' }

// A result screen, a formation panel, or a paused replay frame.
export type ShotKind = 'result' | 'formation' | 'replay'

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

// ---------- formation shots ----------

// Where a formation shot draws the board: screen pixels per hex radius, the
// board's centre (the middle hex), and the share of its outline found on a
// light line, which is the fit's evidence.
export interface BoardFit {
  scale: number
  x: number
  y: number
  support: number
}

// A unit standing on a formation board: its portrait's ring, the tile its
// pointer marks, and who it may be.
export interface UnitReading {
  hexId: number
  // In the shot's pixels.
  ring: { x: number; y: number; radius: number }
  // Share of the ring found: under 1 where a nearer portrait covers part of it.
  score: number
  // Best first: heroes by their base id, companions and phantimals by their
  // unit id.
  candidates: HeroCandidate[]
  // The portrait, cropped, for the review.
  card: RgbaImage
}

// What a formation shot says. It shows one team, so its card row is that
// side's cells and its artifact that side's; the slot strip under the board
// stands in for the result strip (mapIndex, mapCount), with no results.
export interface FormationReading extends ScreenshotReading {
  // The read image's size, the pixels the board fit and the rings are in.
  size: { width: number; height: number }
  board: BoardFit | null
  // The team the shot shows, from where its lit tiles lean; null without a board.
  side: Team | null
  // The lit tiles (the shown team's deployment tiles) by hex id, and the
  // tiles portraits cover too much to read.
  tiles: number[]
  unclear: number[]
  units: UnitReading[]
}

export const isFormationReading = (reading: ScreenshotReading): reading is FormationReading =>
  'units' in reading

// Where a replay frame sits against the reference frame its camera was
// measured in: reference pixel p is frame pixel (x, y) + scale * p, and score is
// how well the arena matched there.
export interface ReplayPlacement {
  scale: number
  x: number
  y: number
  score: number
}

// A paused replay frame: no cards, only where the board lies in it. The map
// strip's ring stands in for the result strip (mapIndex, mapCount), with no
// results; the sides and artifacts are empty.
export interface ReplayReading extends ScreenshotReading {
  // The read image's size, the pixels the placement is in.
  size: { width: number; height: number }
  placement: ReplayPlacement | null
}

export const isReplayReading = (reading: ScreenshotReading): reading is ReplayReading =>
  'placement' in reading

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
  // One row per artifact: its id, the central art's shape vector and its
  // colour histogram.
  ids: number[]
  vectors: Float32Array[]
  colours: Float32Array[]
}

export interface LearnedIcon {
  characterId: number
  // Int8-quantised descriptor, base64.
  descriptor: string
  learnedAt: number
}

export interface GreyImage {
  width: number
  height: number
  data: Float32Array
}

// The Supreme League arena for placing replay frames, at two reductions.
export interface ArenaRef {
  fine: GreyImage
  coarse: GreyImage
}

export interface ReferenceSet {
  frames: FrameRef[]
  heroes: HeroTable
  artifacts: ArtifactTable
  // Companions and phantimals with art of their own, by unit id, kept apart
  // from the heroes so a result card never ranks against them.
  units: HeroTable
}
