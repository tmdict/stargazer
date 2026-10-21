/* A paused replay frame of a 5v5 Supreme League match: where Stargazer's board
 * lies in it. Every Supreme League map is fought in one arena under one fixed
 * camera, so a frame differs from the reference frame the camera was measured
 * in only by the desktop window's size and the crop: a scale and a shift. They
 * are found by matching the arena around the fight against a grey picture of
 * it with the units taken out (replay-arena.png), which holds whatever the
 * crop keeps, the game's UI included or not. The camera then takes every tile
 * to the frame, and the map strip's green ring names the map when the UI is in
 * view. The numbers are measured on real frames. */

import type { Hex } from '@/lib/hex'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { Team } from '@/lib/types/team'
import { cropResize } from '../../core/image'
import type { RgbaImage } from '../../core/types'
import { ringGreen } from '../match/ring'
import type { ImportWarning } from '../match/types'
import type { ArenaRef, GreyImage, ReplayPlacement, ReplayReading } from './types'

// The reference frame's size; the arena picture is a quarter of it.
const REPLAY_REFERENCE = { width: 1400, height: 1940 } as const
const ARENA_FACTOR = 4

// The camera in reference pixels: a board point (x, y) on the pointy-top layout
// at unit size, turned by psi to (u, v), lands at
//   d = 1 + p v,  X = cx + sx u / d,  Y = cy + sy v / d,
// a floor tilted away from the viewer with its far rows drawn smaller.
const CAMERA = {
  psi: 0.009669983444381344,
  p: -0.008121946962408566,
  sx: 97.89599923037078,
  sy: 60.7006522695,
  cx: 760.8041348962155,
  cy: 968.6597521050933,
} as const

// The map strip's five circles in reference pixels. The current map's ring
// measures about a quarter green in its band, the other circles none.
const STRIP = { x: 505.3, pitch: 120.85, y: 211.3, radius: 44 } as const
const RING_FLOOR = 0.1

// The placement search: scales around the frame's width over the reference's
// (a crop keeps most of the window's width), shifts up to this fraction of the
// frame. Replay frames score 0.68 to 0.88 though units and effects differ;
// result and formation screens, over the same arena blurred or not at all, 0.13
// to 0.25. Below the floor a frame is not this arena.
const SCALE_SPREAD = [0.85, 1.18] as const
const SHIFT_SPREAD = 0.35
const PLACEMENT_FLOOR = 0.45

const LAYOUT = new Layout(POINTY, { x: 1, y: 1 }, { x: 0, y: 0 })

const toReference = (q: Point): Point => {
  const u = Math.cos(CAMERA.psi) * q.x - Math.sin(CAMERA.psi) * q.y
  const v = Math.sin(CAMERA.psi) * q.x + Math.cos(CAMERA.psi) * q.y
  const d = 1 + CAMERA.p * v
  return { x: CAMERA.cx + (CAMERA.sx * u) / d, y: CAMERA.cy + (CAMERA.sy * v) / d }
}

const toFrame = (placement: ReplayPlacement, p: Point): Point => ({
  x: placement.x + placement.scale * p.x,
  y: placement.y + placement.scale * p.y,
})

export const replayHexCentre = (placement: ReplayPlacement, hex: Hex): Point =>
  toFrame(placement, toReference(LAYOUT.hexToPixel(hex)))

export const replayHexCorners = (placement: ReplayPlacement, hex: Hex): Point[] =>
  LAYOUT.polygonCorners(hex).map((c) => toFrame(placement, toReference(c)))

// ---------- placement ----------

const grey = (img: RgbaImage, width: number, height: number): GreyImage => {
  const small = cropResize(img, { x: 0, y: 0, w: img.width, h: img.height }, width, height)
  const data = new Float32Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const p = i * 4
    data[i] = 0.299 * small.data[p]! + 0.587 * small.data[p + 1]! + 0.114 * small.data[p + 2]!
  }
  return { width, height, data }
}

const shrink = (g: GreyImage, factor: number): GreyImage => {
  const width = Math.round(g.width / factor)
  const height = Math.round(g.height / factor)
  const data = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const sx = x * factor + dx
          const sy = y * factor + dy
          if (sx >= g.width || sy >= g.height) continue
          sum += g.data[sy * g.width + sx]!
          n++
        }
      }
      data[y * width + x] = n ? sum / n : 0
    }
  }
  return { width, height, data }
}

// The arena at the picture's quarter size and a further quarter, for the
// coarse search; prepared once with the references.
export const prepareArena = (img: RgbaImage): ArenaRef => {
  const fine = grey(img, img.width, img.height)
  return { fine, coarse: shrink(fine, 4) }
}

/* How well the arena matches the frame when reference pixel p sits at frame
 * pixel scale * p + shift: normalised cross-correlation over the arena pixels
 * that land in the frame (every `stride`th). The frame copy is `unit` frame
 * pixels per pixel, the arena copy `refUnit` reference pixels per pixel. Half
 * the arena must land in the frame. */
function score(
  arena: GreyImage,
  refUnit: number,
  frame: GreyImage,
  unit: number,
  scale: number,
  shiftX: number,
  shiftY: number,
  stride: number,
): number {
  let n = 0
  let sa = 0
  let sb = 0
  let saa = 0
  let sbb = 0
  let sab = 0
  for (let y = 0; y < arena.height; y += stride) {
    const fy = Math.round((scale * (y + 0.5) * refUnit + shiftY) / unit - 0.5)
    if (fy < 0 || fy >= frame.height) continue
    for (let x = 0; x < arena.width; x += stride) {
      const fx = Math.round((scale * (x + 0.5) * refUnit + shiftX) / unit - 0.5)
      if (fx < 0 || fx >= frame.width) continue
      const a = arena.data[y * arena.width + x]!
      const b = frame.data[fy * frame.width + fx]!
      n++
      sa += a
      sb += b
      saa += a * a
      sbb += b * b
      sab += a * b
    }
  }
  if (n < (arena.width * arena.height) / (stride * stride) / 2) return -1
  const va = saa - (sa * sa) / n
  const vb = sbb - (sb * sb) / n
  return va > 0 && vb > 0 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : -1
}

/* Coarse to fine: every candidate scale and shift on copies at a sixteenth of
 * the reference's size, then the best neighbourhood at a quarter. */
export function placeReplay(shot: RgbaImage, arena: ArenaRef): ReplayPlacement {
  const guess = shot.width / REPLAY_REFERENCE.width
  // The frame at the arena picture's resolution, as if its scale were the guess.
  const unit = ARENA_FACTOR * guess
  const fine = grey(shot, Math.round(shot.width / unit), Math.round(shot.height / unit))
  const coarse = shrink(fine, 4)

  let best: ReplayPlacement = { scale: guess, x: 0, y: 0, score: -1 }
  const coarseUnit = unit * 4
  const coarseRef = ARENA_FACTOR * 4
  for (let k = SCALE_SPREAD[0]; k <= SCALE_SPREAD[1] + 1e-9; k += 0.015) {
    const scale = guess * k
    const step = coarseUnit
    const x1 = shot.width - scale * REPLAY_REFERENCE.width + SHIFT_SPREAD * shot.width
    const y1 = shot.height - scale * REPLAY_REFERENCE.height + SHIFT_SPREAD * shot.height
    for (let y = -SHIFT_SPREAD * shot.height; y <= y1; y += step) {
      for (let x = -SHIFT_SPREAD * shot.width; x <= x1; x += step) {
        const s = score(arena.coarse, coarseRef, coarse, coarseUnit, scale, x, y, 2)
        if (s > best.score) best = { scale, x, y, score: s }
      }
    }
  }
  // The coarse copies are blurrier and score higher than the fine ones, so the
  // fine search starts from the coarse winner scored at the fine size.
  const centre = best
  best = {
    ...centre,
    score: score(arena.fine, ARENA_FACTOR, fine, unit, centre.scale, centre.x, centre.y, 2),
  }
  for (let ds = -0.015; ds <= 0.015 + 1e-9; ds += 0.003) {
    const scale = centre.scale + ds * guess
    for (let y = centre.y - 6 * unit; y <= centre.y + 6 * unit; y += unit) {
      for (let x = centre.x - 6 * unit; x <= centre.x + 6 * unit; x += unit) {
        const s = score(arena.fine, ARENA_FACTOR, fine, unit, scale, x, y, 2)
        if (s > best.score) best = { scale, x, y, score: s }
      }
    }
  }
  return best
}

// Whether a screenshot is a replay frame of this arena, for sorting a paste.
export const isReplayFrame = (shot: RgbaImage, arena: ArenaRef): boolean =>
  placeReplay(shot, arena).score >= PLACEMENT_FLOOR

// ---------- reading ----------

// The ring is a thin band, so each circle is tried a few pixels either way of
// where the placement and the measured strip put it.
const RING_SLACK = [-8, -4, 0, 4, 8] as const

/* The map whose strip circle carries the green ring, when the strip is in the
 * frame; null otherwise. */
function readMap(shot: RgbaImage, placement: ReplayPlacement): number | null {
  const radius = Math.round(STRIP.radius * placement.scale)
  let best = { index: -1, green: RING_FLOOR }
  for (let index = 0; index < 5; index++) {
    const centre = toFrame(placement, { x: STRIP.x + STRIP.pitch * index, y: STRIP.y })
    for (const dy of RING_SLACK) {
      for (const dx of RING_SLACK) {
        const green = ringGreen(shot, Math.round(centre.x) + dx, Math.round(centre.y) + dy, radius)
        if (green > best.green) best = { index, green }
      }
    }
  }
  return best.index < 0 ? null : best.index
}

export function readReplay(shot: RgbaImage, arena: ArenaRef): ReplayReading {
  const placement = placeReplay(shot, arena)
  const found = placement.score >= PLACEMENT_FLOOR
  const warnings: ImportWarning[] = found ? [] : [{ kind: 'no-arena' }]
  const mapIndex = found ? readMap(shot, placement) : null
  return {
    mapIndex,
    mapCount: mapIndex === null ? null : 5,
    winner: null,
    mapResults: [],
    sides: { [Team.ALLY]: [], [Team.ENEMY]: [] },
    artifacts: { [Team.ALLY]: null, [Team.ENEMY]: null },
    warnings,
    size: { width: shot.width, height: shot.height },
    placement: found ? placement : null,
  }
}
