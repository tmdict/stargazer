/* The pixels every screenshot reader works on. Each buffer is an RGBA
 * `RgbaImage` (the shape of a canvas ImageData), so nothing under lib/import
 * depends on the DOM. */

export interface RgbaImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
