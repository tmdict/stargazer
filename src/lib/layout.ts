import { Hex } from './hex'

const SQRT3 = Math.sqrt(3)

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

// Flat-top orientation
export const FLAT: Orientation = {
  f0: 3 / 2,
  f1: 0,
  f2: SQRT3 / 2,
  f3: SQRT3,
  b0: 2 / 3,
  b1: 0,
  b2: -1 / 3,
  b3: SQRT3 / 3,
  startAngle: 0,
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

  // Convert pixel to hex (fractional)
  pixelToHex(point: Point): Hex {
    const M = this.orientation
    const pt = {
      x: (point.x - this.origin.x) / this.size.x,
      y: (point.y - this.origin.y) / this.size.y,
    }
    const q = M.b0 * pt.x + M.b1 * pt.y
    const r = M.b2 * pt.x + M.b3 * pt.y
    return Hex.fromAxial(q, r)
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
  ): string {
    const startCenter = this.hexToPixel(startHex)
    const endCenter = this.hexToPixel(endHex)

    // Calculate direction vector
    const dx = endCenter.x - startCenter.x
    const dy = endCenter.y - startCenter.y
    const length = Math.sqrt(dx * dx + dy * dy)

    // Normalize direction vector
    const dirX = dx / length
    const dirY = dy / length

    // Add angular offset for inverted arrows to prevent overlap
    // Offset by ~15 degrees (π/12 radians) for enemy-to-ally arrows
    let startDirX = dirX
    let startDirY = dirY
    let endDirX = -dirX
    let endDirY = -dirY

    if (invertCurve) {
      const angleOffset = Math.PI / 12 // 15 degrees

      // Determine which side of the grid we're on based on average X position
      const avgX = (startCenter.x + endCenter.x) / 2
      const gridCenterX = this.origin.x
      const isOnLeftSide = avgX < gridCenterX

      // Choose rotation direction based on grid position
      const rotationMultiplier = isOnLeftSide ? 1 : -1

      const cosOffset = Math.cos(angleOffset)
      const sinOffset = Math.sin(angleOffset)

      // Rotate start direction (swap offset direction for left vs right side)
      startDirX = dirX * cosOffset + dirY * sinOffset * -rotationMultiplier
      startDirY = -dirX * sinOffset * -rotationMultiplier + dirY * cosOffset

      // Rotate end direction (inverted from start)
      endDirX = -dirX * cosOffset - dirY * sinOffset * rotationMultiplier
      endDirY = dirX * sinOffset * rotationMultiplier - dirY * cosOffset
    }

    // Calculate start and end points at edge of circles with offset
    const start = {
      x: startCenter.x + startDirX * characterRadius,
      y: startCenter.y + startDirY * characterRadius,
    }
    const end = {
      x: endCenter.x + endDirX * characterRadius,
      y: endCenter.y + endDirY * characterRadius,
    }

    // Calculate control point for curve (offset perpendicular to line)
    const midX = (start.x + end.x) / 2
    const midY = (start.y + end.y) / 2

    // Determine curve direction based on average X position relative to grid center
    const avgX = (startCenter.x + endCenter.x) / 2
    const gridCenterX = this.origin.x
    const relativeX = avgX - gridCenterX

    // Calculate curve intensity based on distance from center
    // Arrows closer to center have less curve, arrows at edges have more
    const maxDistance = 200 // Approximate half-width of the grid
    const distanceFromCenter = Math.abs(relativeX)
    const curveFactor = Math.min(distanceFromCenter / maxDistance, 1) // 0 to 1
    const baseCurvature = length * 0.15 // Base curve amount

    // Apply different curvature multipliers for enemy arrows (invertCurve = true)
    // Enemy arrows curve 1.5x more than ally arrows to prevent overlap
    const curvatureMultiplier = invertCurve ? 1.5 : 1.0
    const curvature = (baseCurvature + baseCurvature * curveFactor) * curvatureMultiplier // Scale curve by position and type

    // Curve direction: negative for left side, positive for right side
    let curveDirection = relativeX < 0 ? -1 : 1

    // Invert curve direction if requested (for enemy-to-ally arrows)
    if (invertCurve) {
      curveDirection *= -1
    }

    // Perpendicular offset for control point
    const controlX = midX - dirY * curvature * curveDirection
    const controlY = midY + dirX * curvature * curveDirection

    return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`
  }
}
