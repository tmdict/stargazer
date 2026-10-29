/* What a hero card yields and the tables a card is read against: the frame
 * references, the hero table of portrait descriptors, and the faces learned
 * from corrections. Pure data, shared by every screen that shows hero cards. */

import type { Rect, RgbaImage } from '../core/types'

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

// Who the face is, once the cards shown with it have been settled against each other.
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

// A paragon frame (S+, which the app calls P0, to P4), or a card below S+: a plate
// with no frame, or a lower tier's frame.
export type FrameFamily = 'paragon' | 'below'

export interface FrameFamilyReading {
  family: FrameFamily
  sure: boolean
}

export interface ParagonReading {
  level: number
  score: number
  // Best score among the other levels' frames.
  runnerUp: number
  sure: boolean
}

/* The frame's top half beside the S+ frame's, in mean RGB distance. The P2 and P3
 * frames add a crown the S+ frame lacks: `p2` and `p3` are how far the card is from
 * each crown where it would be (0 to 255). P1 and P4 paint parts of the S+ frame in
 * colours of their own: `p1Tint` and `p4Tint` are the card's distance there from that
 * level's colours less its distance from S+'s, negative when nearer the level's. */
export interface Crest {
  p2: number
  p3: number
  p1Tint: number
  p4Tint: number
}

export interface CrestReading {
  level: number
  sure: boolean
}

export interface RefinementReading {
  level: number
  // The row holds six stars, which refinement needs.
  full: boolean
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

export interface LearnedIcon {
  characterId: number
  // Int8-quantised descriptor, base64.
  descriptor: string
  learnedAt: number
}

// What a card is read against.
export interface CardReferences {
  frames: readonly FrameRef[]
  heroes: HeroTable
}
