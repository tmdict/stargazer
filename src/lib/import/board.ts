/* The board of a formation screenshot. The game draws Stargazer's own 45-hex
 * grid under its formation camera, the camera the perspective view reproduces
 * (PERSPECTIVE: squashed, and tilted so near rows draw larger), so with that
 * shape fixed a fit is only a scale and a position. The evidence is the thin
 * light line around the board: an outline sample scores how far it stands
 * above its neighbours, less the same for points just off the line, so UI
 * that lights up everywhere (the card row) scores low. The search runs on a
 * reduced copy: coarse over every board wholly inside the shot, then finer
 * around the best. */

import type { Hex } from '@/lib/hex'
import { Layout, PERSPECTIVE, POINTY, type Point } from '@/lib/layout'
import { FULL_GRID, presetHexes } from '@/lib/types/grid'
import { cropResize } from './image'
import type { BoardFit, RgbaImage } from './types'

export const BOARD_HEXES: readonly Hex[] = presetHexes(FULL_GRID)

// The board at unit hex radius with the camera's tilt; a fit scales it and
// squashes it vertically by the camera's compression.
const UNIT = new Layout(POINTY, { x: 1, y: 1 }, { x: 0, y: 0 }, false, PERSPECTIVE.tilt)

const toScreen = (fit: Omit<BoardFit, 'support'>, p: Point): Point => ({
  x: fit.x + fit.scale * p.x,
  y: fit.y + fit.scale * PERSPECTIVE.compression * p.y,
})

export const hexCentre = (fit: BoardFit, hex: Hex): Point => toScreen(fit, UNIT.hexToPixel(hex))

export const hexCorners = (fit: BoardFit, hex: Hex): Point[] =>
  UNIT.polygonCorners(hex).map((p) => toScreen(fit, p))

// ---------- the outline ----------

// Points on the board's outline and just off it (either side of each sample
// along the edge normal), in squashed unit coordinates: a fit maps them by a
// scale and a shift alone. The coarse search samples each edge more sparsely.
interface Samples {
  on: Point[]
  off: Point[]
}

const OFF_LINE = 0.3

function outlineSamples(perEdge: number): Samples {
  const edges = new Map<string, [Point, Point] | null>()
  for (const hex of BOARD_HEXES) {
    const c = UNIT.polygonCorners(hex).map((p) => ({ x: p.x, y: p.y * PERSPECTIVE.compression }))
    for (let k = 0; k < 6; k++) {
      const a = c[k]!
      const b = c[(k + 1) % 6]!
      // An edge two hexes share is inside the board.
      const key = `${Math.round((a.x + b.x) * 50)},${Math.round((a.y + b.y) * 50)}`
      edges.set(key, edges.has(key) ? null : [a, b])
    }
  }
  const on: Point[] = []
  const off: Point[] = []
  for (const edge of edges.values()) {
    if (!edge) continue
    const [a, b] = edge
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const nx = (-(b.y - a.y) / len) * OFF_LINE
    const ny = ((b.x - a.x) / len) * OFF_LINE
    for (let i = 0; i < perEdge; i++) {
      const t = (i + 0.5) / perEdge
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      on.push({ x, y })
      off.push({ x: x + nx, y: y + ny }, { x: x - nx, y: y - ny })
    }
  }
  return { on, off }
}

const FINE = outlineSamples(6)
const COARSE = outlineSamples(2)
const EXTENT = (() => {
  const xs = FINE.on.map((p) => p.x)
  const ys = FINE.on.map((p) => p.y)
  return {
    left: -Math.min(...xs),
    right: Math.max(...xs),
    top: -Math.min(...ys),
    bottom: Math.max(...ys),
  }
})()

// ---------- the line map ----------

interface LineMap {
  w: number
  h: number
  r: Float32Array
}

// How far each pixel's luminance stands above the brighter of its two
// neighbours LINE_REACH pixels away, best over four directions: high on a thin
// light line, low on flat areas and broad light regions.
const LINE_REACH = 3

function lineMap(img: RgbaImage): LineMap {
  const { width: w, height: h, data } = img
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!
  }
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= w || y >= h ? 255 : lum[y * w + x]!
  const r = new Float32Array(w * h)
  const D = LINE_REACH
  const dirs = [
    [D, 0],
    [0, D],
    [D, D],
    [D, -D],
  ] as const
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = lum[y * w + x]!
      let best = 0
      for (const [dx, dy] of dirs) {
        best = Math.max(best, c - Math.max(at(x + dx, y + dy), at(x - dx, y - dy)))
      }
      r[y * w + x] = best
    }
  }
  return { w, h, r }
}

// Max-pooled, so a thin line survives the coarse search.
function pool(m: LineMap, f: number): LineMap {
  const w = Math.floor(m.w / f)
  const h = Math.floor(m.h / f)
  const r = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let j = 0; j < f; j++) {
        for (let i = 0; i < f; i++) v = Math.max(v, m.r[(y * f + j) * m.w + x * f + i]!)
      }
      r[y * w + x] = v
    }
  }
  return { w, h, r }
}

// Mean response at the points under a scale and shift, each read as the best
// of a pixel and its four neighbours so rounding never misses the line.
function meanAt(m: LineMap, pts: readonly Point[], s: number, ox: number, oy: number): number {
  let sum = 0
  for (const p of pts) {
    const x = Math.round(ox + s * p.x)
    const y = Math.round(oy + s * p.y)
    if (x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) continue
    const i = y * m.w + x
    sum += Math.max(m.r[i]!, m.r[i - 1]!, m.r[i + 1]!, m.r[i - m.w]!, m.r[i + m.w]!)
  }
  return sum / pts.length
}

const score = (m: LineMap, set: Samples, s: number, ox: number, oy: number): number =>
  meanAt(m, set.on, s, ox, oy) - meanAt(m, set.off, s, ox, oy)

// A sample counts as found on a line this much above its surroundings.
const LINE_FLOOR = 20

function support(m: LineMap, s: number, ox: number, oy: number): number {
  let found = 0
  for (const p of FINE.on) {
    const x = Math.round(ox + s * p.x)
    const y = Math.round(oy + s * p.y)
    if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.r[y * m.w + x]! > LINE_FLOOR) found++
  }
  return found / FINE.on.length
}

// ---------- the search ----------

// The fit runs on a copy this wide (or the shot itself when narrower), pooled
// by POOL for the coarse pass. Boards from MIN_WIDTH of the copy's width up to
// all of it are tried, in SCALE_STEP increments.
export const FIT_WIDTH = 480
const POOL = 4
const MIN_WIDTH = 0.35
const SCALE_STEP = 0.015
// Refinement windows on the copy, widest first: scale (px per hex radius)
// and centre shift ranges with their steps.
const REFINE = [
  { scale: 1.5, scaleStep: 0.25, shift: 6, shiftStep: 1 },
  { scale: 0.3, scaleStep: 0.05, shift: 1, shiftStep: 0.25 },
] as const
// Below this share of the outline on a line there is no board: measured 0.47
// to 0.73 on formation captures (portraits standing on the far rows hide part
// of it), and at most 0.25 on result screens, where the best fit is chance.
const SUPPORT_FLOOR = 0.4

/* The board in the shot, or null when no whole board is found there. */
export function fitBoard(shot: RgbaImage): BoardFit | null {
  const k = Math.min(1, FIT_WIDTH / shot.width)
  const small =
    k === 1
      ? shot
      : cropResize(
          shot,
          { x: 0, y: 0, w: shot.width, h: shot.height },
          Math.round(shot.width * k),
          Math.round(shot.height * k),
        )
  const map = lineMap(small)
  const pooled = pool(map, POOL)

  const boardWidth = EXTENT.left + EXTENT.right
  let best = { score: -Infinity, s: 0, x: 0, y: 0 }
  for (let f = MIN_WIDTH; f <= 1 + 1e-9; f += SCALE_STEP) {
    const s = (f * pooled.w) / boardWidth
    for (let x = Math.ceil(s * EXTENT.left); x <= pooled.w - s * EXTENT.right; x++) {
      for (let y = Math.ceil(s * EXTENT.top); y <= pooled.h - s * EXTENT.bottom; y++) {
        const sc = score(pooled, COARSE, s, x, y)
        if (sc > best.score) best = { score: sc, s, x, y }
      }
    }
  }
  if (best.score === -Infinity) return null

  let cur = { ...best, s: best.s * POOL, x: best.x * POOL, y: best.y * POOL }
  cur.score = score(map, FINE, cur.s, cur.x, cur.y)
  for (const w of REFINE) {
    const base = { ...cur }
    for (let ds = -w.scale; ds <= w.scale + 1e-9; ds += w.scaleStep) {
      for (let dx = -w.shift; dx <= w.shift + 1e-9; dx += w.shiftStep) {
        for (let dy = -w.shift; dy <= w.shift + 1e-9; dy += w.shiftStep) {
          const s = base.s + ds
          const x = base.x + dx
          const y = base.y + dy
          const sc = score(map, FINE, s, x, y)
          if (sc > cur.score) cur = { score: sc, s, x, y }
        }
      }
    }
  }
  const found = support(map, cur.s, cur.x, cur.y)
  if (found < SUPPORT_FLOOR) return null
  return { scale: cur.s / k, x: cur.x / k, y: cur.y / k, support: found }
}
