/* Portrait frames: the six reference images (P0 to P4, plus the winged P4)
 * matched by alpha-masked correlation. A frame match does two jobs: it names
 * the paragon level and it pins the card's exact box, which every other
 * per-card region is measured from. The column anchor scores all five rows
 * together, because a single frame (the plain brown P0 above all) correlates
 * with orange UI regions about as well as with a real card. */

import { cropResize, maskedNcc } from './image'
import { CARD_PITCH_RANGE, CARD_ROWS, PANEL_GAP_RANGE } from './layout'
import { hasSummaryBar } from './strip'
import type { FrameRef, ParagonReading, Rect, RgbaImage } from './types'

// Reference image order: p0, p1, p2, p3, p4, p4-crown.
export const FRAME_NAMES = ['p0', 'p1', 'p2', 'p3', 'p4', 'p4-crown'] as const
const FRAME_LEVELS = [0, 1, 2, 3, 4, 4] as const
const FRAME_SCALES = [0.25, 0.265, 0.28] as const

// Offsets tried around a column seed, and around the anchor for each card;
// the card search is fine and covers every offset so a card's box does not
// depend on where the anchor grid happened to fall.
export const ANCHOR_SEARCH = { oy: [-60, 40], ox: [-16, 16], step: 4 } as const
const CARD_SEARCH = { oy: [-6, 6], ox: [-4, 4], step: 1 } as const
// Under a tab the column is searched more widely sideways, since a taller
// phone puts it further from the panel's edge.
export const TAB_ANCHOR_OX = [-16, 40] as const

// Whole-height scan for the card columns (a raw capture, whose column also
// sits further right than in a crop): one frame scale, a row profile at this
// step, the fine anchor search then settles offset and scale. The two columns
// are scored as a pair a panel gap apart, which no background pattern imitates.
const COLUMN_SCAN = { step: 4, ox: [-16, -8, 0, 8, 16, 24, 32], scale: 0.25 } as const
const SCAN_PAIRS_TRIED = 500

// The comb mean a column must reach to be read. One placed by a landmark
// (its tab, or the scanned pair with a summary bar under each) may score its
// frames weaker and still count: the position is settled by structure, and a
// capture taken while the panel was still fading in scores its frames low.
export const ANCHOR_FLOOR = 0.35
export const LANDMARK_FLOOR = 0.27

// A pitch step either side of the seed's is tried at the anchor; a small
// gain is asked for, since a wrong pitch that happens to score a hair better
// on one shot would move the lower rows off their frames.
const PITCH_STEP = 2
const PITCH_GAIN = 0.01

// Amber when the score is low or the runner-up family is close: fitted on the
// graded samples, where it flags exactly the misread cards.
const SURE_SCORE = 0.65
const SURE_FLOOR = 0.5
const SURE_GAP = 0.05

export function prepareFrameRefs(images: readonly RgbaImage[]): FrameRef[] {
  const refs: FrameRef[] = []
  images.forEach((image, i) => {
    for (const scale of FRAME_SCALES) {
      const w = Math.round(image.width * scale)
      const h = Math.round(image.height * scale)
      refs.push({
        level: FRAME_LEVELS[i] ?? 0,
        scale,
        image: cropResize(image, { x: 0, y: 0, w: image.width, h: image.height }, w, h),
      })
    }
  })
  return refs
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}

// The best frame of any level at one position.
const bestFrameAt = (shot: RgbaImage, refs: readonly FrameRef[], x: number, y: number): number => {
  let best = -1
  for (const ref of refs) {
    const s = maskedNcc(shot, ref.image, x, y)
    if (s > best) best = s
  }
  return best
}

// Where a column is expected: its first card's top-left corner and the row pitch.
export interface ColumnSeed {
  x: number
  y: number
  pitch: number
}

export interface PanelAnchor extends ColumnSeed {
  // Mean of the five rows' best frame scores.
  mean: number
}

// The comb: the five rows scored together at one column position.
const combMean = (shot: RgbaImage, refs: readonly FrameRef[], at: ColumnSeed): number => {
  let sum = 0
  for (let i = 0; i < CARD_ROWS; i++) {
    sum += bestFrameAt(shot, refs, at.x, Math.round(at.y + at.pitch * i))
  }
  return sum / CARD_ROWS
}

const fifthCardTop = (at: ColumnSeed): number => Math.round(at.y + at.pitch * (CARD_ROWS - 1))

/* Where the five-card column of a panel actually sits: the position near the
 * seed whose rows sum to the best frame matches, at the seed's pitch or a
 * step either side of it when that lines the rows up clearly better. */
export function findPanelAnchor(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  seed: ColumnSeed,
  oxRange: readonly [number, number] = ANCHOR_SEARCH.ox,
): PanelAnchor {
  let best: PanelAnchor = { ...seed, mean: -1 }
  for (const scale of FRAME_SCALES) {
    const scaled = refs.filter((r) => r.scale === scale)
    for (const oy of range(ANCHOR_SEARCH.oy[0], ANCHOR_SEARCH.oy[1], ANCHOR_SEARCH.step)) {
      for (const ox of range(oxRange[0], oxRange[1], ANCHOR_SEARCH.step)) {
        const at = { x: seed.x + ox, y: seed.y + oy, pitch: seed.pitch }
        const mean = combMean(shot, scaled, at)
        if (mean > best.mean) best = { ...at, mean }
      }
    }
  }
  for (const pitch of [seed.pitch - PITCH_STEP, seed.pitch + PITCH_STEP]) {
    const mean = combMean(shot, refs, { x: best.x, y: best.y, pitch })
    if (mean > best.mean + PITCH_GAIN) best = { ...best, pitch, mean }
  }
  return best
}

export interface ColumnPair {
  ally: ColumnSeed
  enemy: ColumnSeed
}

/* The two columns' seeds anywhere in the shot, for a capture that is not
 * cropped to the panel. Every row position gets its best single frame score
 * once; combs of any pitch and pairs of any panel gap are then sums over that
 * profile, so both are searched freely. The tab above the first card matches
 * a frame about as well as a card, so a comb one row too high scores like the
 * real one; the summary bar under the fifth card tells them apart. Null when
 * no pair clears the floor and has its bars. */
export function scanForColumns(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  columnX: number,
): ColumnPair | null {
  const scaled = refs.filter((r) => r.scale === COLUMN_SCAN.scale)
  const { step } = COLUMN_SCAN
  const rows = Math.floor((shot.height - (scaled[0]?.image.height ?? 0)) / step)
  if (rows <= 0) return null
  const profiles = COLUMN_SCAN.ox.map((ox) => {
    const raw = new Float32Array(rows)
    for (let i = 0; i < rows; i++) raw[i] = bestFrameAt(shot, scaled, columnX + ox, i * step)
    // Pooled over a step either side, so a row a little off the comb's
    // pitch still counts.
    const pooled = new Float32Array(rows)
    for (let i = 0; i < rows; i++) {
      pooled[i] = Math.max(raw[i]!, raw[i - 1] ?? -1, raw[i + 1] ?? -1)
    }
    return pooled
  })
  const comb = (profile: Float32Array, i: number, pitch: number): number => {
    let sum = 0
    for (let k = 0; k < CARD_ROWS; k++) {
      const j = Math.round((i * step + pitch * k) / step)
      if (j >= rows) return -1
      sum += profile[j]!
    }
    return sum / CARD_ROWS
  }
  const pairs: { ox: number; i: number; gap: number; pitch: number; mean: number }[] = []
  profiles.forEach((profile, oxIndex) => {
    for (const pitch of range(CARD_PITCH_RANGE[0], CARD_PITCH_RANGE[1], 2)) {
      const combs = Array.from({ length: rows }, (_, i) => comb(profile, i, pitch))
      for (let i = 0; i < rows; i++) {
        if (combs[i]! < LANDMARK_FLOOR) continue
        for (let gap = PANEL_GAP_RANGE[0]; gap <= PANEL_GAP_RANGE[1]; gap += step) {
          const j = i + gap / step
          if (j >= rows || combs[j]! < LANDMARK_FLOOR) continue
          pairs.push({ ox: oxIndex, i, gap, pitch, mean: (combs[i]! + combs[j]!) / 2 })
        }
      }
    }
  })
  pairs.sort((a, b) => b.mean - a.mean)
  for (const pair of pairs.slice(0, SCAN_PAIRS_TRIED)) {
    const x = columnX + COLUMN_SCAN.ox[pair.ox]!
    const ally = { x, y: pair.i * step, pitch: pair.pitch }
    const enemy = { x, y: ally.y + pair.gap, pitch: pair.pitch }
    if (hasSummaryBar(shot, x, fifthCardTop(ally)) && hasSummaryBar(shot, x, fifthCardTop(enemy))) {
      return { ally, enemy }
    }
  }
  return null
}

export interface CardMatch {
  ref: FrameRef
  score: number
  box: Rect
  // Best score per paragon level (index = level).
  perLevel: number[]
}

/* The best frame at one card row, searched closely around the anchor. */
export function matchCard(
  shot: RgbaImage,
  refs: readonly FrameRef[],
  anchor: PanelAnchor,
  row: number,
): CardMatch {
  let best: CardMatch | null = null
  const perLevel = [-1, -1, -1, -1, -1]
  const top = Math.round(anchor.y + anchor.pitch * row)
  for (const ref of refs) {
    for (const oy of range(CARD_SEARCH.oy[0], CARD_SEARCH.oy[1], CARD_SEARCH.step)) {
      for (const ox of range(CARD_SEARCH.ox[0], CARD_SEARCH.ox[1], CARD_SEARCH.step)) {
        const x = anchor.x + ox
        const y = top + oy
        const score = maskedNcc(shot, ref.image, x, y)
        if (score > perLevel[ref.level]!) perLevel[ref.level] = score
        if (!best || score > best.score) {
          best = { ref, score, box: { x, y, w: ref.image.width, h: ref.image.height }, perLevel }
        }
      }
    }
  }
  return best!
}

export function paragonFromMatch(match: CardMatch): ParagonReading {
  const level = match.ref.level
  const runnerUp = Math.max(...match.perLevel.filter((_, i) => i !== level))
  const sure =
    match.score >= SURE_FLOOR && (match.score >= SURE_SCORE || runnerUp < match.score - SURE_GAP)
  return { level, score: match.score, runnerUp, sure }
}
