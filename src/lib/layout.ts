import { Hex } from './hex'

const SQRT3 = Math.sqrt(3)

// Constants for arrow path calculation
const MAX_GRID_HALF_WIDTH = 200 // Approximate half-width of the grid
const BASE_CURVATURE_FACTOR = 0.15 // Base curve amount as fraction of length

// Orientation matrices for hex-to-pixel and pixel-to-hex conversion
export interface Orientation {
  f0: number // forward transform matrix (2x2)
  f1: number
  f2: number
  f3: number
  b0: number // backward transform matrix (2x2)
  b1: number
  b2: number
  b3: number
  startAngle: number // angle offset for corner vertices, multiples of 60deg
}

// Pointy-top orientation
export const POINTY: Orientation = {
  f0: SQRT3,
  f1: SQRT3 / 2,
  f2: 0,
  f3: 3 / 2,
  b0: SQRT3 / 3,
  b1: -1 / 3,
  b2: 0,
  b3: 2 / 3,
  startAngle: 0.5,
}

export interface Point {
  x: number
  y: number
}

export class Layout {
  orientation: Orientation
  size: Point
  origin: Point

  constructor(
    orientation: Orientation, // hex orientation (pointy-top or flat-top)
    size: Point, // size of a hex (radius)
    origin: Point, // pixel origin (center of Hex(0,0,0))
  ) {
    this.orientation = orientation
    this.size = size
    this.origin = origin
  }

  // Convert hex to pixel (center)
  hexToPixel(hex: Hex): Point {
    const M = this.orientation
    const x = (M.f0 * hex.q + M.f1 * hex.r) * this.size.x
    const y = (M.f2 * hex.q + M.f3 * hex.r) * this.size.y
    return {
      x: x + this.origin.x,
      y: y + this.origin.y,
    }
  }

  // Calculate offset used to get corner location relative to center
  hexCornerOffset(corner: number): Point {
    const angle = (2 * Math.PI * (this.orientation.startAngle + corner)) / 6
    return {
      x: this.size.x * Math.cos(angle),
      y: this.size.y * Math.sin(angle),
    }
  }

  // Get the corner points of a hex as an array of Points
  polygonCorners(hex: Hex): Point[] {
    const center = this.hexToPixel(hex)
    const corners: Point[] = []
    for (let i = 0; i < 6; i++) {
      const offset = this.hexCornerOffset(i)
      corners.push({
        x: center.x + offset.x,
        y: center.y + offset.y,
      })
    }
    return corners
  }

  // Convert hex to screen coordinates (includes origin offset)
  hexToScreen(hex: Hex, origin: Point): Point {
    const pixel = this.hexToPixel(hex)
    return {
      x: pixel.x + origin.x,
      y: pixel.y + origin.y,
    }
  }

  // Calculate curved arrow path between two hexes
  getArrowPath(
    startHex: Hex,
    endHex: Hex,
    characterRadius: number = 0,
    invertCurve: boolean = false,
    curveScale: number = 1,
  ): string {
    const startCenter = this.hexToPixel(startHex)
    const endCenter = this.hexToPixel(endHex)

    const dx = endCenter.x - startCenter.x
    const dy = endCenter.y - startCenter.y
    const length = Math.sqrt(dx * dx + dy * dy)

    // Same hex: draw a small self-loop.
    if (length === 0) {
      const offset = characterRadius || 10
      return `M ${startCenter.x} ${startCenter.y - offset} Q ${startCenter.x + offset} ${startCenter.y} ${startCenter.x} ${startCenter.y + offset}`
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

    const start = {
      x: startCenter.x + (dirX * cosA + normX * sinA) * characterRadius,
      y: startCenter.y + (dirY * cosA + normY * sinA) * characterRadius,
    }
    const end = {
      x: endCenter.x + (-dirX * cosA + normX * sinA) * characterRadius,
      y: endCenter.y + (-dirY * cosA + normY * sinA) * characterRadius,
    }

    // Control point offset perpendicular from the chord midpoint.
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2
    const controlX = midX + normX * curvature
    const controlY = midY + normY * curvature

    return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`
  }
}
