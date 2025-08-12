/* Hex and grid implementation based on Hexagonal Grids:
 * https://www.redblobgames.com/grids/hexagons/
 */
export class Hex {
  readonly q: number
  readonly r: number
  readonly s: number
  id: number

  constructor(q: number, r: number, s: number, id: number = -1) {
    if (q + r + s !== 0) {
      throw new Error(`q=${q} + r=${r} + s=${s} must be 0`)
    }
    this.q = q
    this.r = r
    this.s = s
    this.id = id
  }

  setId(id: number): void {
    this.id = id
  }

  getId(): number {
    return this.id
  }

  equals(other: Hex): boolean {
    return this.q === other.q && this.r === other.r && this.s === other.s
  }

  toString(): string {
    return `${this.q},${this.r},${this.s}`
  }

  add(other: Hex): Hex {
    return new Hex(this.q + other.q, this.r + other.r, this.s + other.s)
  }

  subtract(other: Hex): Hex {
    return new Hex(this.q - other.q, this.r - other.r, this.s - other.s)
  }

  scale(k: number): Hex {
    return new Hex(this.q * k, this.r * k, this.s * k)
  }

  distance(other: Hex): number {
    return (
      (Math.abs(this.q - other.q) + Math.abs(this.r - other.r) + Math.abs(this.s - other.s)) / 2
    )
  }

  neighbor(direction: number): Hex {
    // Direction indices 0-5 clockwise from top-right
    const directions = [
      new Hex(1, -1, 0),  // 0: top-right
      new Hex(1, 0, -1),  // 1: right
      new Hex(0, 1, -1),  // 2: bottom-right
      new Hex(-1, 1, 0),  // 3: bottom-left
      new Hex(-1, 0, 1),  // 4: left
      new Hex(0, -1, 1),  // 5: top-left
    ]
    return this.add(directions[direction % 6])
  }

  /**
   * Get all 6 neighbor hexes
   * Order: [top-right, right, bottom-right, bottom-left, left, top-left]
   * Corresponds to direction indices 0-5 clockwise from top-right
   */
  getNeighbors(): Hex[] {
    const neighbors: Hex[] = []
    for (let i = 0; i < 6; i++) {
      neighbors.push(this.neighbor(i))
    }
    return neighbors
  }

  /**
   * Static method to get neighbor coordinates without creating Hex instances
   * Useful for performance-critical operations
   */
  static getNeighborCoordinates(
    q: number,
    r: number,
    s: number,
  ): Array<{ q: number; r: number; s: number }> {
    const directions = [
      { q: 1, r: -1, s: 0 }, // top-right
      { q: 1, r: 0, s: -1 }, // right
      { q: 0, r: 1, s: -1 }, // bottom-right
      { q: -1, r: 1, s: 0 }, // bottom-left
      { q: -1, r: 0, s: 1 }, // left
      { q: 0, r: -1, s: 1 }, // top-left
    ]

    return directions.map((dir) => ({
      q: q + dir.q,
      r: r + dir.r,
      s: s + dir.s,
    }))
  }

  static fromAxial(q: number, r: number): Hex {
    return new Hex(q, r, -q - r)
  }
}
