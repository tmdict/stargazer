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
    // Directions: 0 to 5
    const directions = [
      new Hex(1, -1, 0),
      new Hex(1, 0, -1),
      new Hex(0, 1, -1),
      new Hex(-1, 1, 0),
      new Hex(-1, 0, 1),
      new Hex(0, -1, 1),
    ]
    return this.add(directions[direction % 6])
  }

  static fromAxial(q: number, r: number): Hex {
    return new Hex(q, r, -q - r)
  }
}
