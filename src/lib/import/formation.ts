/* One formation screenshot to a reading. The panel shows one team on its map:
 * the board (board.ts) with that team's deployment tiles lit and its units
 * standing on them, the slot strip under the board, and the card row with the
 * team's artifact before it. Every region is placed from the board fit in hex
 * radii, so the shot's size and padding do not matter. The board and its units
 * are read at the shot's own size; the card row on a copy resampled to the
 * scale at which its cards meet the frame templates. */

import { Team } from '@/lib/types/team'
import { readArtifact } from './artifacts'
import { BOARD_HEXES, fitBoard, hexCentre, hexCorners } from './board'
import { heroDescriptor, rankHeroes } from './heroes'
import { cropResize, maskedNcc } from './image'
import { readCards } from './pipeline'
import { GREEN_RING_FLOOR, isGreen, ringGreen } from './strip'
import type {
  ArtifactReading,
  BoardFit,
  FormationReading,
  HeroReading,
  ImportWarning,
  ReferenceSet,
  RgbaImage,
  UnitReading,
} from './types'

const luminance = (img: RgbaImage, x: number, y: number): number => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return 0
  const i = (yi * img.width + xi) * 4
  return (img.data[i]! + img.data[i + 1]! + img.data[i + 2]!) / 3
}

const saturation = (img: RgbaImage, x: number, y: number): number => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return 255
  const i = (yi * img.width + xi) * 4
  const r = img.data[i]!
  const g = img.data[i + 1]!
  const b = img.data[i + 2]!
  return Math.max(r, g, b) - Math.min(r, g, b)
}

// ---------- units ----------

// A portrait stands on its tile with its pointer's tip at the tile centre, so
// its ring sits RING_RISE hex radii above that centre on every row, and is
// RING_RADIUS across. Measured on 128 units over four capture sets: rise 0.75
// to 0.91, radius 0.63.
const RING_RISE = 0.83
const RING_RADIUS = 0.63
// Each tile's ring is searched this far either side of its nominal centre.
const RING_REACH = 0.3
const RING_STEP = 0.04
const RING_SAMPLES = 48
// The ring is light and grey, brighter than the portrait inside it and the
// board outside. A tile holds a unit when this share of its circle reads so:
// 0.54 to 0.98 on units (a nearer portrait can cover part of a far one's ring),
// at most 0.29 on empty tiles.
const RING_FLOOR = 0.4
const RING_LIGHT = 180
const RING_CONTRAST = 12
const RING_GREY = 45

function ringScore(img: RgbaImage, cx: number, cy: number, r: number): number {
  const d = Math.max(3, r * 0.12)
  let hit = 0
  for (let k = 0; k < RING_SAMPLES; k++) {
    const a = (2 * Math.PI * k) / RING_SAMPLES
    const c = Math.cos(a)
    const s = Math.sin(a)
    const on = Math.max(
      luminance(img, cx + r * c, cy + r * s),
      luminance(img, cx + (r - 1) * c, cy + (r - 1) * s),
      luminance(img, cx + (r + 1) * c, cy + (r + 1) * s),
    )
    const inner = luminance(img, cx + (r - d) * c, cy + (r - d) * s)
    const outer = luminance(img, cx + (r + d) * c, cy + (r + d) * s)
    if (
      on > RING_LIGHT &&
      on - Math.max(inner, outer) > RING_CONTRAST &&
      saturation(img, cx + r * c, cy + r * s) < RING_GREY
    ) {
      hit++
    }
  }
  return hit / RING_SAMPLES
}

// Face crops of a portrait in ring radii (width, and top relative to the ring's
// centre), in the hero table's landscape shape. The first ranks the whole
// table; the others suit heroes framed wider or higher and re-score the leaders.
const FACE_BOXES = [
  { w: 1.0, top: -0.45 },
  { w: 1.2, top: -0.5 },
  { w: 1.1, top: -0.6 },
  { w: 1.2, top: -0.62 },
] as const
const FACE_ASPECT = 0.75
// Enough candidates that a lineup read elsewhere still finds its hero among them.
const UNIT_CANDIDATES = 60
const UNIT_CARD = 64

function findUnits(shot: RgbaImage, fit: BoardFit): Omit<UnitReading, 'candidates' | 'card'>[] {
  const s = fit.scale
  const radius = RING_RADIUS * s
  const units: Omit<UnitReading, 'candidates' | 'card'>[] = []
  for (const hex of BOARD_HEXES) {
    const centre = hexCentre(fit, hex)
    let best = { score: 0, x: 0, y: 0 }
    for (let dy = -RING_REACH; dy <= RING_REACH + 1e-9; dy += RING_STEP) {
      for (let dx = -RING_REACH; dx <= RING_REACH + 1e-9; dx += RING_STEP) {
        const x = centre.x + dx * s
        const y = centre.y + (dy - RING_RISE) * s
        const score = ringScore(shot, x, y, radius)
        if (score > best.score) best = { score, x, y }
      }
    }
    if (best.score >= RING_FLOOR) {
      units.push({ hexId: hex.getId(), ring: { x: best.x, y: best.y, radius }, score: best.score })
    }
  }
  return units
}

function identify(
  shot: RgbaImage,
  refs: ReferenceSet,
  unit: Omit<UnitReading, 'candidates' | 'card'>,
): UnitReading {
  const { x, y, radius: r } = unit.ring
  const alignments = FACE_BOXES.map((box) => {
    const w = Math.round(box.w * r)
    return heroDescriptor(shot, {
      x: Math.round(x - w / 2),
      y: Math.round(y + box.top * r),
      w,
      h: Math.round(w * FACE_ASPECT),
    })
  })
  const candidates = [
    ...rankHeroes(refs.heroes, alignments, UNIT_CANDIDATES),
    ...rankHeroes(refs.units, alignments, UNIT_CANDIDATES),
  ].sort((a, b) => b.score - a.score)
  const side = Math.round(2 * r)
  const card = cropResize(
    shot,
    { x: Math.round(x - r), y: Math.round(y - r), w: side, h: side },
    UNIT_CARD,
    UNIT_CARD,
  )
  return { ...unit, candidates, card }
}

// ---------- tiles ----------

// A tile is read on its lower half, where its own portrait does not reach:
// samples in hex radii from its centre, scaled by how large that tile is
// drawn. Samples any portrait covers are left out, and a tile with under
// TILE_MIN_SHARE of them left is unclear.
const TILE_SAMPLES = (() => {
  const out: { x: number; y: number }[] = []
  for (let y = 0.1; y <= 0.55 + 1e-9; y += 0.09) {
    for (let x = -0.6; x <= 0.6 + 1e-9; x += 0.15) out.push({ x, y })
  }
  return out
})()
// Corners of a pointy-top hex: 0 lower right, 1 bottom, 2 lower left.
const COS_30 = Math.cos(Math.PI / 6)
const TILE_MIN_SHARE = 0.25
// Lit tiles read about 135 and over, the others 115 and under. The split goes
// in the widest gap between the board's own tile readings, when it is this wide.
const LIT_GAP = 12

function readTiles(
  shot: RgbaImage,
  fit: BoardFit,
  units: readonly Omit<UnitReading, 'candidates' | 'card'>[],
): { tiles: number[]; unclear: number[] } {
  const covered = (x: number, y: number): boolean =>
    units.some(({ ring }) => Math.hypot(x - ring.x, y - ring.y) <= ring.radius + 3)
  const medians: { id: number; median: number }[] = []
  const unclear: number[] = []
  for (const hex of BOARD_HEXES) {
    const centre = hexCentre(fit, hex)
    const corners = hexCorners(fit, hex)
    const across = (corners[0]!.x - corners[2]!.x) / (2 * COS_30)
    const down = corners[1]!.y - centre.y
    const values: number[] = []
    for (const p of TILE_SAMPLES) {
      const x = centre.x + p.x * across
      const y = centre.y + p.y * down
      if (!covered(x, y)) values.push(luminance(shot, x, y))
    }
    if (values.length < TILE_SAMPLES.length * TILE_MIN_SHARE) {
      unclear.push(hex.getId())
      continue
    }
    values.sort((a, b) => a - b)
    medians.push({ id: hex.getId(), median: values[Math.floor(values.length / 2)]! })
  }
  const sorted = medians.map((m) => m.median).sort((a, b) => a - b)
  let split = Infinity
  let widest = LIT_GAP
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!
    if (gap >= widest) {
      widest = gap
      split = (sorted[i]! + sorted[i - 1]!) / 2
    }
  }
  return { tiles: medians.filter((m) => m.median > split).map((m) => m.id), unclear }
}

// Every map's ally tiles lean to the near half of the board (rows below the
// middle, r > 0) and its enemy tiles to the far half, so the shown team is
// the one its lit tiles, or failing those its units, lean towards.
function sideOf(hexIds: readonly number[]): Team | null {
  const rows = hexIds.map((id) => BOARD_HEXES.find((hex) => hex.getId() === id)!.r)
  const lean = rows.reduce((sum, r) => sum + r, 0)
  if (lean === 0) return null
  return lean > 0 ? Team.ALLY : Team.ENEMY
}

// ---------- slot strip ----------

// The numbered circles under the board, measured on four capture sets: their
// centres STRIP.below hex radii below the board's centre, STRIP.pitch apart
// about STRIP.centre, the selected one ringed in green of radius STRIP.ring.
// A circle is there when its numeral is: white pixels fill 0.24 to 0.41 of
// its inner disc, and none where a strip has no circle.
const STRIP = { below: 5.73, pitch: 1.87, centre: -0.05, ring: 0.71, band: 0.55 } as const
const STRIP_POSITIONS = [-2, -1, 0, 1, 2] as const
const NUMERAL_DISC = 0.3
const NUMERAL_FLOOR = 0.1

function numeralShare(shot: RgbaImage, cx: number, cy: number, r: number): number {
  let n = 0
  let white = 0
  for (let y = Math.round(cy - r); y <= cy + r; y++) {
    for (let x = Math.round(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      if (Math.hypot(x - cx, y - cy) > r) continue
      n++
      const i = (y * shot.width + x) * 4
      if (shot.data[i]! > 200 && shot.data[i + 1]! > 200 && shot.data[i + 2]! > 190) white++
    }
  }
  return n ? white / n : 0
}

/* The selected slot (0-based among the circles there) and how many there
 * are; null when the strip is cut off or no ring is found. */
function readSlot(shot: RgbaImage, fit: BoardFit): { index: number; count: number } | null {
  const s = fit.scale
  const cy = fit.y + STRIP.below * s
  const x0 = fit.x + STRIP.centre * s
  const top = Math.max(0, Math.round(cy - STRIP.band * s))
  const bottom = Math.min(shot.height, Math.round(cy + STRIP.band * s))
  const left = Math.max(0, Math.round(x0 - 2.5 * STRIP.pitch * s))
  const right = Math.min(shot.width, Math.round(x0 + 2.5 * STRIP.pitch * s))
  let n = 0
  let sx = 0
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * shot.width + x) * 4
      if (isGreen(shot.data[i]!, shot.data[i + 1]!, shot.data[i + 2]!)) {
        n++
        sx += x
      }
    }
  }
  if (n === 0) return null
  const position = Math.round((sx / n - x0) / (STRIP.pitch * s))
  const centreOf = (k: number): number => x0 + k * STRIP.pitch * s
  if (!STRIP_POSITIONS.includes(position as (typeof STRIP_POSITIONS)[number])) return null
  const ring = ringGreen(
    shot,
    Math.round(centreOf(position)),
    Math.round(cy),
    Math.round(STRIP.ring * s),
  )
  if (ring < GREEN_RING_FLOOR) {
    return null
  }
  const present = STRIP_POSITIONS.filter(
    (k) => numeralShare(shot, centreOf(k), cy, NUMERAL_DISC * s) >= NUMERAL_FLOOR,
  )
  const index = present.indexOf(position as (typeof STRIP_POSITIONS)[number])
  return index < 0 ? null : { index, count: present.length }
}

// ---------- card row ----------

// The hero cards sit in a row under the strip, their tops CARD_TOP hex radii
// below the board's centre and CARD_PITCH apart. The row starts at one of two
// places, as the phantimal slot before the artifact card is there or not:
// measured on four capture sets, 2.45 to 2.51 hex radii left of the board's
// centre with it and 3.38 to 3.44 without. Each start is searched CARD_SLACK
// either way and the stronger frame comb wins, since the other start puts
// every card half a card off its frame. Read on a copy where the board is
// CARD_SCALE px per hex radius, the scale at which the cards meet the frame
// templates.
const CARD_SCALE = 46.2
const CARD_TOP = 7.2
const CARD_STARTS = [-2.49, -3.41] as const
const CARD_SLACK = 0.2
const CARD_PITCH = 1.58
const CARD_PITCH_SLACK = 2
const CARD_COUNT = 5
// The comb mean a row must reach to be read at all.
const ROW_FLOOR = 0.27
// The artifact card before the row: its art disc's centre from the first
// card's top-left and its diameter, in hex radii. Placed so on four capture
// sets, where it reads all ten labelled artifacts.
const ARTIFACT = { dx: -1.25, dy: 0.85, diameter: 0.78 } as const

interface Comb {
  mean: number
  x: number
  y: number
  pitch: number
}

function findRow(shot: RgbaImage, refs: ReferenceSet, fit: BoardFit): Comb | null {
  const s = fit.scale
  const slack = Math.round(CARD_SLACK * s)
  const cardAt = new Map<string, number>()
  const frameAt = (x: number, y: number): number => {
    const key = `${x},${y}`
    let best = cardAt.get(key)
    if (best === undefined) {
      best = -1
      for (const ref of refs.frames) best = Math.max(best, maskedNcc(shot, ref.image, x, y, 3))
      cardAt.set(key, best)
    }
    return best
  }
  const nominal = Math.round(CARD_PITCH * s)
  const y0 = Math.round(fit.y + CARD_TOP * s)
  let best: Comb | null = null
  for (const start of CARD_STARTS) {
    const x0 = Math.round(fit.x + start * s)
    for (let pitch = nominal - CARD_PITCH_SLACK; pitch <= nominal + CARD_PITCH_SLACK; pitch++) {
      for (let dy = -slack; dy <= slack; dy += 2) {
        for (let dx = -slack; dx <= slack; dx += 2) {
          let sum = 0
          for (let k = 0; k < CARD_COUNT; k++) sum += frameAt(x0 + dx + k * pitch, y0 + dy)
          const mean = sum / CARD_COUNT
          if (!best || mean > best.mean) best = { mean, x: x0 + dx, y: y0 + dy, pitch }
        }
      }
    }
  }
  return best && best.mean >= ROW_FLOOR ? best : null
}

/* The five hero cards, read as the result import reads a column, and the
 * artifact card before them; none of either when the shot has no card row. */
function readCardRow(
  shot: RgbaImage,
  refs: ReferenceSet,
  fit: BoardFit,
): { cells: HeroReading[]; artifact: ArtifactReading | null } {
  const k = CARD_SCALE / fit.scale
  const scaled =
    Math.abs(k - 1) < 0.02
      ? { shot, fit }
      : {
          shot: cropResize(
            shot,
            { x: 0, y: 0, w: shot.width, h: shot.height },
            Math.round(shot.width * k),
            Math.round(shot.height * k),
          ),
          fit: { ...fit, scale: fit.scale * k, x: fit.x * k, y: fit.y * k },
        }
  const comb = findRow(scaled.shot, refs, scaled.fit)
  if (!comb) return { cells: [], artifact: null }
  const seeds = Array.from({ length: CARD_COUNT }, (_, i) => ({
    x: comb.x + i * comb.pitch,
    y: comb.y,
  }))
  const cells = readCards(scaled.shot, refs, seeds, true)
  if (!cells.some((cell) => cell.recognised)) return { cells: [], artifact: null }
  const s = scaled.fit.scale
  const artifact =
    refs.artifacts.ids.length === 0
      ? null
      : readArtifact(
          scaled.shot,
          comb.x + ARTIFACT.dx * s,
          comb.y + ARTIFACT.dy * s,
          refs.artifacts,
          Math.round(ARTIFACT.diameter * s),
        )
  return { cells, artifact }
}

// ---------- the reading ----------

const emptyReading = (warnings: ImportWarning[]): FormationReading => ({
  mapIndex: null,
  mapCount: null,
  winner: null,
  mapResults: [],
  sides: { [Team.ALLY]: [], [Team.ENEMY]: [] },
  artifacts: { [Team.ALLY]: null, [Team.ENEMY]: null },
  warnings,
  board: null,
  side: null,
  tiles: [],
  unclear: [],
  units: [],
})

export function readFormation(shot: RgbaImage, refs: ReferenceSet): FormationReading {
  const board = fitBoard(shot)
  if (!board) return emptyReading([{ kind: 'no-board' }])
  const warnings: ImportWarning[] = []
  const found = findUnits(shot, board)
  const { tiles, unclear } = readTiles(shot, board, found)
  const side = sideOf(tiles) ?? sideOf(found.map((unit) => unit.hexId))
  const slot = readSlot(shot, board)
  if (!slot) warnings.push({ kind: 'no-strip' })
  const row = side === null ? null : readCardRow(shot, refs, board)
  if (side !== null && row?.cells.length === 0) warnings.push({ kind: 'no-panel', side })
  const reading = emptyReading(warnings)
  if (side !== null && row) {
    reading.sides[side] = row.cells
    reading.artifacts[side] = row.artifact
  }
  return {
    ...reading,
    mapIndex: slot?.index ?? null,
    mapCount: slot?.count ?? null,
    board,
    side,
    tiles,
    unclear,
    units: found.map((unit) => identify(shot, refs, unit)),
  }
}
