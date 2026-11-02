/* Pixel primitives for the screenshot readers: crop-and-resize with box
 * sampling, area-weighted resampling, HSV, per-channel normalised
 * descriptors, and alpha-masked normalised cross-correlation. */

import type { Rect, RgbaImage } from './types'

const createImage = (width: number, height: number): RgbaImage => ({
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
  const { data, width, height } = src
  const sx = rect.w / w
  const sy = rect.h / h
  const colFrom = new Int32Array(w)
  const colTo = new Int32Array(w)
  for (let tx = 0; tx < w; tx++) {
    const x0 = Math.floor(rect.x + tx * sx)
    colFrom[tx] = Math.max(0, x0)
    colTo[tx] = Math.min(width, Math.max(x0 + 1, Math.ceil(rect.x + (tx + 1) * sx)))
  }
  let o = 0
  for (let ty = 0; ty < h; ty++) {
    const y0 = Math.floor(rect.y + ty * sy)
    const rowFrom = Math.max(0, y0)
    const rowTo = Math.min(height, Math.max(y0 + 1, Math.ceil(rect.y + (ty + 1) * sy)))
    for (let tx = 0; tx < w; tx++, o += 4) {
      const from = colFrom[tx]!
      const to = colTo[tx]!
      const n = Math.max(0, rowTo - rowFrom) * Math.max(0, to - from)
      if (n === 0) {
        out.data[o + 3] = 255
        continue
      }
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let y = rowFrom; y < rowTo; y++) {
        const end = (y * width + to) * 4
        for (let i = (y * width + from) * 4; i < end; i += 4) {
          r += data[i]!
          g += data[i + 1]!
          b += data[i + 2]!
          a += data[i + 3]!
        }
      }
      out.data[o] = r / n
      out.data[o + 1] = g / n
      out.data[o + 2] = b / n
      out.data[o + 3] = a / n
    }
  }
  return out
}

// One axis of a resample: for each target pixel, the source pixels its
// footprint overlaps and how much of it each covers.
interface Taps {
  index: Int32Array[]
  weight: Float32Array[]
}

const axisTaps = (start: number, span: number, count: number, size: number): Taps => {
  const step = span / count
  const index: Int32Array[] = []
  const weight: Float32Array[] = []
  for (let t = 0; t < count; t++) {
    const a = start + t * step
    const b = a + step
    const is: number[] = []
    const ws: number[] = []
    for (let p = Math.floor(a); p < b; p++) {
      const w = Math.min(b, p + 1) - Math.max(a, p)
      if (w <= 0 || p < 0 || p >= size) continue
      is.push(p)
      ws.push(w)
    }
    const total = ws.reduce((sum, w) => sum + w, 0)
    index.push(Int32Array.from(is))
    weight.push(Float32Array.from(ws, (w) => w / total))
  }
  return { index, weight }
}

/* Resample `rect` of `src` onto a w × h image, each target pixel the
 * area-weighted mean of the source it covers: at a scale near 1 a pixel
 * stays a pixel instead of blending with its neighbour, as cropResize's
 * whole-pixel footprints do. Outside the source reads as opaque black. */
export function resample(src: RgbaImage, rect: Rect, w: number, h: number): RgbaImage {
  const out = createImage(w, h)
  const xs = axisTaps(rect.x, rect.w, w, src.width)
  const ys = axisTaps(rect.y, rect.h, h, src.height)
  const px = new Float32Array(4)
  for (let ty = 0; ty < h; ty++) {
    const rows = ys.index[ty]!
    const rowWeights = ys.weight[ty]!
    for (let tx = 0; tx < w; tx++) {
      const o = (ty * w + tx) * 4
      const cols = xs.index[tx]!
      const colWeights = xs.weight[tx]!
      if (rows.length === 0 || cols.length === 0) {
        out.data[o + 3] = 255
        continue
      }
      px.fill(0)
      for (let j = 0; j < rows.length; j++) {
        const rowStart = rows[j]! * src.width
        for (let i = 0; i < cols.length; i++) {
          const weight = rowWeights[j]! * colWeights[i]!
          const p = (rowStart + cols[i]!) * 4
          px[0] += src.data[p]! * weight
          px[1] += src.data[p + 1]! * weight
          px[2] += src.data[p + 2]! * weight
          px[3] += src.data[p + 3]! * weight
        }
      }
      out.data[o] = px[0]!
      out.data[o + 1] = px[1]!
      out.data[o + 2] = px[2]!
      out.data[o + 3] = px[3]!
    }
  }
  return out
}

/* Composite transparent art onto a flat colour. The game draws portraits on
 * a light card and over a formation board's mauve, so references are
 * flattened onto the colour they are matched against. */
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
// What a formation board shows inside a portrait's ring where the art is
// see-through, alike on every map.
export const BOARD_BACKDROP: readonly [number, number, number] = [153, 118, 123]

/* Hue in degrees, saturation and value in 0..1. */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
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

// Math.hypot guards against overflow that pixel distances cannot reach, and is
// the slowest part of a per-pixel loop.
export const pixelDistance = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy)

// A template less visible than this at a crop edge is not scored: a sliver
// fits any frame.
const NCC_MIN_COVERAGE = 0.25

// A template's opaque pixels at one sampling step.
interface OpaqueSamples {
  xs: Int32Array
  ys: Int32Array
  rgb: Uint8Array
}

// Kept per template, since a frame match tries each one at hundreds of offsets;
// a template's pixels must not change once it has been matched.
const opaqueSamples = new WeakMap<RgbaImage, Map<number, OpaqueSamples>>()

const samplesOf = (template: RgbaImage, step: number): OpaqueSamples => {
  let byStep = opaqueSamples.get(template)
  if (!byStep) opaqueSamples.set(template, (byStep = new Map()))
  const known = byStep.get(step)
  if (known) return known
  const { data, width, height } = template
  const xs: number[] = []
  const ys: number[] = []
  const rgb: number[] = []
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (data[i + 3]! < 200) continue
      xs.push(x)
      ys.push(y)
      rgb.push(data[i]!, data[i + 1]!, data[i + 2]!)
    }
  }
  const samples = {
    xs: Int32Array.from(xs),
    ys: Int32Array.from(ys),
    rgb: Uint8Array.from(rgb),
  }
  byStep.set(step, samples)
  return samples
}

/* Normalised cross-correlation of an RGBA template against the shot at
 * (ox, oy), over the template's opaque pixels only, sampled every `step`
 * pixels in each direction. Channels are pooled (the frame's shape matters
 * more than its tint), which lets a flat patch correlate by tint alone, so a
 * patch with no variation within its channels scores 0 instead. -1 when too
 * little of the template lies inside the shot. */
export function maskedNcc(
  shot: RgbaImage,
  template: RgbaImage,
  ox: number,
  oy: number,
  step = 2,
): number {
  const { xs, ys, rgb } = samplesOf(template, step)
  const { data, width, height } = shot
  let inside = 0
  let sa = 0
  let saa = 0
  let sab = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sqR = 0
  let sqG = 0
  let sqB = 0
  for (let k = 0; k < xs.length; k++) {
    const sx = ox + xs[k]!
    const sy = oy + ys[k]!
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
    inside++
    const si = (sy * width + sx) * 4
    const ar = rgb[k * 3]!
    const ag = rgb[k * 3 + 1]!
    const ab = rgb[k * 3 + 2]!
    const br = data[si]!
    const bg = data[si + 1]!
    const bb = data[si + 2]!
    sa += ar + ag + ab
    saa += ar * ar + ag * ag + ab * ab
    sab += ar * br + ag * bg + ab * bb
    sumR += br
    sumG += bg
    sumB += bb
    sqR += br * br
    sqG += bg * bg
    sqB += bb * bb
  }
  if (inside === 0 || inside < xs.length * NCC_MIN_COVERAGE) return -1
  const within =
    sqR - (sumR * sumR) / inside + sqG - (sumG * sumG) / inside + sqB - (sumB * sumB) / inside
  if (within < 1) return 0
  const n = inside * 3
  const sb = sumR + sumG + sumB
  const sbb = sqR + sqG + sqB
  const cov = sab - (sa * sb) / n
  const va = saa - (sa * sa) / n
  const vb = sbb - (sb * sb) / n
  const denom = Math.sqrt(va * vb)
  return denom === 0 ? 0 : cov / denom
}
