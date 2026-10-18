import { Hex } from './hex'

const SQRT3 = Math.sqrt(3)

// Constants for arrow path calculation
const MAX_GRID_HALF_WIDTH = 200 // Approximate half-width of the grid
const BASE_CURVATURE_FACTOR = 0.15 // Base curve amount as fraction of length
// In perspective, an arrow's arc height per screen pixel of its length.
const ARC_RISE = 0.3

// The greatest arc height (screen pixels) that keeps the curve's top at or below
// the top of the portrait at its higher end, `radius` above that end's center.
// `dy` is how far the end sits below the start. For a quadratic whose control
// point sits 2h above the chord's middle, the top is (d0 + 2h)^2 / 4h above the
// start (d0 = -dy / 2); solving top <= limit for h gives the larger root below.
function arcHeightLimit(dy: number, radius: number): number {
  const d0 = -dy / 2
  const room = radius - Math.min(0, dy) - d0
  return (room + Math.sqrt(room * room - d0 * d0)) / 2
}

// Orientation matrix for hex-to-pixel conversion
export interface Orientation {
  f0: number // forward transform matrix (2x2)
  f1: number
  f2: number
  f3: number
  startAngle: number // angle offset for corner vertices, multiples of 60deg
}

// Pointy-top orientation
export const POINTY: Orientation = {
  f0: SQRT3,
  f1: SQRT3 / 2,
  f2: 0,
  f3: 3 / 2,
  startAngle: 0.5,
}

export interface Point {
  x: number
  y: number
}

// The game's formation camera, which the perspective view reproduces: how much it
// shortens the board vertically (a CSS squash) and its tilt (the Layout's).
export const PERSPECTIVE = { compression: 0.606, tilt: 0.01 } as const

// A portrait's radius at hex radius 40: sprites are twice this across, and the
// arrows and lines between units end on this ring around each portrait.
export const PORTRAIT_RADIUS = 30

// A token standing on a tile in perspective (a portrait or an artifact icon)
// points at the tile's center with a pointer this tall, in screen pixels.
export const STANDING_POINTER_HEIGHT = 8

export class Layout {
  orientation: Orientation
  size: Point
  origin: Point
  rotated: boolean
  tilt: number
  squash: number

  constructor(
    orientation: Orientation, // hex orientation (pointy-top or flat-top)
    size: Point, // size of a hex (radius)
    origin: Point, // pixel origin (center of Hex(0,0,0))
    // Render the board rotated 180 degrees about the origin (the invert view).
    // Pure view transform: hexes keep their engine ids, only positions reflect,
    // so hit-testing against the same layout stays consistent by construction.
    rotated: boolean = false,
    // The perspective view's lean away from the viewer: an offset from the origin
    // scales by 1 / (1 - tilt * y), y in hex radii below the origin, so lower rows
    // draw larger. Applied after rotation, so the bottom of the screen stays
    // nearest. 0 draws the board flat.
    tilt: number = 0,
    // The vertical scale the board's container applies after the layout (the
    // perspective squash). Ring offsets divide by it, so an arrow's end stays on
    // a portrait's round rim on screen. 1 draws the board flat.
    squash: number = 1,
  ) {
    this.orientation = orientation
    this.size = size
    this.origin = origin
    this.rotated = rotated
    this.tilt = tilt
    this.squash = squash
  }

  // How far above its tile's center a token of this screen radius stands in
  // perspective, in board pixels before the squash, so that its pointer tip lands
  // on the center.
  standingLift(radius: number): number {
    return (radius + STANDING_POINTER_HEIGHT) / this.squash
  }

  // The CSS transform that stands such a token on its tile in perspective: lifted,
  // and scaled against the squash so it stays round.
  standingTransform(radius: number): string {
    return `translateY(${-this.standingLift(radius)}px) scaleY(${1 / this.squash})`
  }

  // Arrow and center-line paths are drawn in the arrow layers, which undo the
  // board's squash (useArrowLayer), so their y comes out times the squash to land
  // where the squashed board shows it.
  private upright(p: Point): string {
    return `${p.x} ${p.y * this.squash}`
  }

  // An offset along (dx, dy) that is `radius` long on screen once the
  // container's squash applies.
  private ringOffset(dx: number, dy: number, radius: number): Point {
    const k = radius / Math.hypot(dx, dy * this.squash)
    return { x: dx * k, y: dy * k }
  }

  // A hex center's offset from the origin before the tilt.
  private centerOffset(hex: Hex): Point {
    const M = this.orientation
    const sign = this.rotated ? -1 : 1
    return {
      x: (M.f0 * hex.q + M.f1 * hex.r) * this.size.x * sign,
      y: (M.f2 * hex.q + M.f3 * hex.r) * this.size.y * sign,
    }
  }

  // An offset from the origin to its drawn pixel, tilt applied.
  private place(offset: Point): Point {
    const depth = 1 - (this.tilt * offset.y) / this.size.y
    return {
      x: this.origin.x + offset.x / depth,
      y: this.origin.y + offset.y / depth,
    }
  }

  // Convert hex to pixel (center)
  hexToPixel(hex: Hex): Point {
    return this.place(this.centerOffset(hex))
  }

  // Rotation negates the offset so corner index i keeps naming the same physical
  // corner of the hex (corner-indexed paths like getCornerLinePath rely on that).
  hexCornerOffset(corner: number): Point {
    const angle = (2 * Math.PI * (this.orientation.startAngle + corner)) / 6
    const sign = this.rotated ? -1 : 1
    return {
      x: this.size.x * Math.cos(angle) * sign,
      y: this.size.y * Math.sin(angle) * sign,
    }
  }

  // Get the corner points of a hex as an array of Points. Each corner is tilted
  // on its own, so a hex lower on the screen is drawn larger.
  polygonCorners(hex: Hex): Point[] {
    const center = this.centerOffset(hex)
    const corners: Point[] = []
    for (let i = 0; i < 6; i++) {
      const offset = this.hexCornerOffset(i)
      corners.push(this.place({ x: center.x + offset.x, y: center.y + offset.y }))
    }
    return corners
  }

  // Curved arrow path between two hexes, in the arrow layers' upright coordinates.
  getArrowPath(
    startHex: Hex,
    endHex: Hex,
    characterRadius: number = 0,
    invertCurve: boolean = false,
    curveScale: number = 1,
    // In perspective, arc up through the air rather than bow sideways.
    arc: boolean = true,
  ): string {
    const startCenter = this.hexToPixel(startHex)
    const endCenter = this.hexToPixel(endHex)

    const dx = endCenter.x - startCenter.x
    const dy = endCenter.y - startCenter.y
    const length = Math.sqrt(dx * dx + dy * dy)

    // Same hex: draw a small self-loop.
    if (length === 0) {
      const offset = characterRadius || 10
      const top = { x: startCenter.x, y: startCenter.y - offset }
      const side = { x: startCenter.x + offset, y: startCenter.y }
      const bottom = { x: startCenter.x, y: startCenter.y + offset }
      return `M ${this.upright(top)} Q ${this.upright(side)} ${this.upright(bottom)}`
    }

    if (arc && this.squash < 1) {
      return this.arcPath(startCenter, endCenter, characterRadius, curveScale)
    }

    const dirX = dx / length
    const dirY = dy / length

    // Curve grows with arrow length and with distance from the grid center, so
    // edge arrows bow outward more than central ones.
    const relativeX = (startCenter.x + endCenter.x) / 2 - this.origin.x
    const curveFactor = Math.min(Math.abs(relativeX) / MAX_GRID_HALF_WIDTH, 1)
    // curveScale lets callers bow some arrows harder than others so overlapping
    // arrows between the same pair stay visually distinct.
    const baseCurvature = length * BASE_CURVATURE_FACTOR
    const curvature = (baseCurvature + baseCurvature * curveFactor) * curveScale

    // Bulge toward the grid's outer edge; inverted arrows bow the other way.
    let curveDirection = relativeX < 0 ? -1 : 1
    if (invertCurve) curveDirection *= -1

    // Unit normal pointing toward the bulge side.
    const normX = -dirY * curveDirection
    const normY = dirX * curveDirection

    // Anchor the endpoints on the icon edge, rotated around each circle toward
    // the bulge side by the curve's tangent angle. The arrow then leaves and
    // enters the icon head-on (radially) rather than slanting off the
    // straight-line point, which reads awkwardly on a curved path. The tangent
    // of a quadratic Bézier at its endpoints aims at the control point, which
    // sits `curvature` off the chord at half its length: atan2(curvature, half).
    const halfChord = Math.max((length - 2 * characterRadius) / 2, 1)
    const tangentAngle = Math.atan2(curvature, halfChord)
    const cosA = Math.cos(tangentAngle)
    const sinA = Math.sin(tangentAngle)

    const startRing = this.ringOffset(
      dirX * cosA + normX * sinA,
      dirY * cosA + normY * sinA,
      characterRadius,
    )
    const endRing = this.ringOffset(
      -dirX * cosA + normX * sinA,
      -dirY * cosA + normY * sinA,
      characterRadius,
    )
    const start = { x: startCenter.x + startRing.x, y: startCenter.y + startRing.y }
    const end = { x: endCenter.x + endRing.x, y: endCenter.y + endRing.y }

    // Control point offset perpendicular from the chord midpoint.
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2
    const controlX = midX + normX * curvature
    const controlY = midY + normY * curvature

    return `M ${this.upright(start)} Q ${this.upright({ x: controlX, y: controlY })} ${this.upright(end)}`
  }

  // In perspective an arrow is an arc in the air from portrait center to portrait
  // center, drawn through the board's camera: its height rises straight up the
  // screen at full size, the way portraits stand, so in board units it is divided
  // by the squash (a quadratic stays exact under that projection). Only the part
  // outside the two portraits is drawn, and cutting a quadratic leaves a quadratic
  // on the same curve, so the arrow leaves and lands along it and keeps the
  // height limit. Portraits close enough to hide the whole curve fall back to
  // ends on each rim toward the control point.
  private arcPath(start: Point, end: Point, radius: number, curveScale: number): string {
    const screenDy = (end.y - start.y) * this.squash
    const length = Math.hypot(end.x - start.x, screenDy)
    const height = Math.min(length * ARC_RISE * curveScale, arcHeightLimit(screenDy, radius))
    const control = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2 - (2 * height) / this.squash,
    }
    const at = (t: number): Point => ({
      x: (1 - t) ** 2 * start.x + 2 * t * (1 - t) * control.x + t ** 2 * end.x,
      y: (1 - t) ** 2 * start.y + 2 * t * (1 - t) * control.y + t ** 2 * end.y,
    })
    // Where the curve crosses the rim around `center`, from `inside` toward `out`.
    const rimCrossing = (center: Point, inside: number, out: number): number => {
      for (let i = 0; i < 24; i++) {
        const mid = (inside + out) / 2
        const p = at(mid)
        if (Math.hypot(p.x - center.x, (p.y - center.y) * this.squash) >= radius) out = mid
        else inside = mid
      }
      return out
    }
    const t0 = rimCrossing(start, 0, 0.5)
    const t1 = rimCrossing(end, 1, 0.5)
    if (t0 >= t1) {
      const s = this.ringOffset(control.x - start.x, control.y - start.y, radius)
      const e = this.ringOffset(control.x - end.x, control.y - end.y, radius)
      const from = { x: start.x + s.x, y: start.y + s.y }
      const to = { x: end.x + e.x, y: end.y + e.y }
      return `M ${this.upright(from)} Q ${this.upright(control)} ${this.upright(to)}`
    }
    const from = at(t0)
    const to = at(t1)
    const mix = (1 - t0) * t1 + t0 * (1 - t1)
    const cx = (1 - t0) * (1 - t1) * start.x + mix * control.x + t0 * t1 * end.x
    const cy = (1 - t0) * (1 - t1) * start.y + mix * control.y + t0 * t1 * end.y
    return `M ${this.upright(from)} Q ${this.upright({ x: cx, y: cy })} ${this.upright(to)}`
  }

  // Straight border-to-border line between two hexes: pulled in by characterRadius
  // at each end, the uncurved/headless counterpart to getArrowPath, in the same
  // upright coordinates.
  getLinePath(startHex: Hex, endHex: Hex, characterRadius: number = 0): string {
    const start = this.hexToPixel(startHex)
    const end = this.hexToPixel(endHex)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length === 0) return ''

    const ring = this.ringOffset(dx, dy, characterRadius)
    const from = { x: start.x + ring.x, y: start.y + ring.y }
    const to = { x: end.x - ring.x, y: end.y - ring.y }
    return `M ${this.upright(from)} L ${this.upright(to)}`
  }

  // Straight line between two specific hex corners, with no border pullback: the
  // exact-edge counterpart to getLinePath (e.g. a wedge/band boundary), in board
  // coordinates, for drawing with the tiles.
  getCornerLinePath(startHex: Hex, startCorner: number, endHex: Hex, endCorner: number): string {
    const start = this.polygonCorners(startHex)[startCorner]
    const end = this.polygonCorners(endHex)[endCorner]
    if (!start || !end) return ''
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }
}
