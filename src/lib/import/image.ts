/* Pixel primitives for the screenshot readers: crop-and-resize with box
 * sampling, HSV, per-channel normalised descriptors, and alpha-masked
 * normalised cross-correlation. The only file that touches pixel data. */

import type { Rect, RgbaImage } from './types'

export const createImage = (width: number, height: number): RgbaImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
})

/* Resample `rect` of `src` onto a w × h image. Each target pixel averages the
 * source pixels its footprint covers, so downscaling is a box filter and
 * upscaling is nearest-neighbour; pixels outside the source read as opaque
 * black, which only ever happens for a crop hanging off an edge. */
export function cropResize(src: RgbaImage, rect: Rect, w: number, h: number): RgbaImage {
  const out = createImage(w, h)
  const sx = rect.w / w
  const sy = rect.h / h
  for (let ty = 0; ty < h; ty++) {
    const y0 = Math.floor(rect.y + ty * sy)
    const y1 = Math.max(y0 + 1, Math.ceil(rect.y + (ty + 1) * sy))
    for (let tx = 0; tx < w; tx++) {
      const x0 = Math.floor(rect.x + tx * sx)
      const x1 = Math.max(x0 + 1, Math.ceil(rect.x + (tx + 1) * sx))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        if (y < 0 || y >= src.height) continue
        for (let x = x0; x < x1; x++) {
          if (x < 0 || x >= src.width) continue
          const i = (y * src.width + x) * 4
          r += src.data[i]!
          g += src.data[i + 1]!
          b += src.data[i + 2]!
          a += src.data[i + 3]!
          n++
        }
      }
      const o = (ty * w + tx) * 4
      if (n === 0) {
        out.data[o + 3] = 255
        continue
      }
      out.data[o] = r / n
      out.data[o + 1] = g / n
      out.data[o + 2] = b / n
      out.data[o + 3] = a / n
    }
  }
  return out
}

export const resizeImage = (src: RgbaImage, w: number, h: number): RgbaImage =>
  cropResize(src, { x: 0, y: 0, w: src.width, h: src.height }, w, h)

/* Composite transparent art onto a flat colour. The game draws portraits on
 * a light card, so references are flattened onto a matching cream. */
export function flatten(src: RgbaImage, bg: readonly [number, number, number]): RgbaImage {
  const out = createImage(src.width, src.height)
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i + 3]! / 255
    out.data[i] = src.data[i]! * a + bg[0] * (1 - a)
    out.data[i + 1] = src.data[i + 1]! * a + bg[1] * (1 - a)
    out.data[i + 2] = src.data[i + 2]! * a + bg[2] * (1 - a)
    out.data[i + 3] = 255
  }
  return out
}

export const PORTRAIT_BACKGROUND: readonly [number, number, number] = [236, 229, 216]

/* Hue in degrees, saturation and value in 0..1. */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h = (h * 60 + 360) % 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

export const hsvAt = (img: RgbaImage, x: number, y: number): [number, number, number] => {
  const i = (y * img.width + x) * 4
  return rgbToHsv(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)
}

/* Per-channel zero-mean, unit-norm RGB vector (channels concatenated), scaled
 * so a dot product of two vectors is the mean of the three per-channel
 * correlations. Normalising each channel separately removes the warm tint the
 * frame casts over the art, which pooled normalisation would keep. */
export function normalizedVector(img: RgbaImage): Float32Array {
  const n = img.width * img.height
  const v = new Float32Array(n * 3)
  for (let c = 0; c < 3; c++) {
    let mean = 0
    for (let p = 0; p < n; p++) mean += img.data[p * 4 + c]!
    mean /= n
    let norm = 0
    for (let p = 0; p < n; p++) {
      const d = img.data[p * 4 + c]! - mean
      v[c * n + p] = d
      norm += d * d
    }
    const k = norm === 0 ? 0 : Math.sqrt(1 / 3) / Math.sqrt(norm)
    for (let p = 0; p < n; p++) v[c * n + p]! *= k
  }
  return v
}

/* A masked variant: only pixels where `mask[p]` is true enter the vector, in
 * order, so masked vectors of equal masks are comparable. */
export function normalizedVectorMasked(img: RgbaImage, mask: readonly boolean[]): Float32Array {
  const idx: number[] = []
  for (let p = 0; p < img.width * img.height; p++) if (mask[p]) idx.push(p)
  const n = idx.length
  const v = new Float32Array(n * 3)
  for (let c = 0; c < 3; c++) {
    let mean = 0
    for (let k = 0; k < n; k++) mean += img.data[idx[k]! * 4 + c]!
    mean /= n || 1
    let norm = 0
    for (let k = 0; k < n; k++) {
      const d = img.data[idx[k]! * 4 + c]! - mean
      v[c * n + k] = d
      norm += d * d
    }
    const s = norm === 0 ? 0 : Math.sqrt(1 / 3) / Math.sqrt(norm)
    for (let k = 0; k < n; k++) v[c * n + k]! *= s
  }
  return v
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

/* Normalised cross-correlation of an RGBA template against the shot at
 * (ox, oy), over the template's opaque pixels only, sampled every `step`
 * pixels in each direction. Channels are pooled (the frame's shape matters
 * more than its tint). -1 when fewer than 100 samples overlap the shot. */
export function maskedNcc(
  shot: RgbaImage,
  template: RgbaImage,
  ox: number,
  oy: number,
  step = 2,
): number {
  let n = 0
  let sa = 0
  let sb = 0
  let saa = 0
  let sbb = 0
  let sab = 0
  for (let y = 0; y < template.height; y += step) {
    const sy = oy + y
    if (sy < 0 || sy >= shot.height) continue
    for (let x = 0; x < template.width; x += step) {
      const ti = (y * template.width + x) * 4
      if (template.data[ti + 3]! < 200) continue
      const sx = ox + x
      if (sx < 0 || sx >= shot.width) continue
      const si = (sy * shot.width + sx) * 4
      for (let c = 0; c < 3; c++) {
        const a = template.data[ti + c]!
        const b = shot.data[si + c]!
        n++
        sa += a
        sb += b
        saa += a * a
        sbb += b * b
        sab += a * b
      }
    }
  }
  if (n < 100) return -1
  const cov = sab - (sa * sb) / n
  const va = saa - (sa * sa) / n
  const vb = sbb - (sb * sb) / n
  const denom = Math.sqrt(va * vb)
  return denom === 0 ? 0 : cov / denom
}

export const clampRect = (r: Rect, img: RgbaImage): Rect => {
  const x = Math.max(0, r.x)
  const y = Math.max(0, r.y)
  return {
    x,
    y,
    w: Math.max(0, Math.min(img.width, r.x + r.w) - x),
    h: Math.max(0, Math.min(img.height, r.y + r.h) - y),
  }
}
