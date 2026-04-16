import { computeSignature, signatureDistance } from './imageSignature'
import { loadImage } from './phash'

export interface PoolDetection {
  hero: string | null // null if no confident match
  distance: number
  alternatives: Array<{ hero: string; distance: number }>
  crop: string // data URL of the cropped cell, for preview
  row: number
  col: number
}

export interface CropRect {
  /** Ratios in [0,1] — fractions of the image's natural width/height. */
  x: number
  y: number
  w: number
  h: number
}

/**
 * HSV-bucket test for the distinctive gold card border color.
 */
function isGoldPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (max < 100) return false
  if (delta < 30) return false
  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return hue >= 25 && hue <= 55
}

/**
 * Heuristically locate the 4×5 card grid inside an arbitrary screenshot
 * (which may contain game UI, status bars, buttons, etc.). Uses the density
 * of gold-border pixels along each axis — the grid is the axis range with
 * highest gold density. Falls back to the full image if nothing convincing
 * is found.
 */
export async function suggestGridCrop(source: File | HTMLImageElement): Promise<CropRect> {
  const img = source instanceof File ? await loadFile(source) : source

  // Downscale for speed; the crop is returned as ratios so resolution doesn't matter.
  const MAX_W = 320
  const scale = Math.min(1, MAX_W / img.naturalWidth)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data

  const rowGold = new Array<number>(h).fill(0)
  const colGold = new Array<number>(w).fill(0)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      if (isGoldPixel(data[idx]!, data[idx + 1]!, data[idx + 2]!)) {
        rowGold[y]!++
        colGold[x]!++
      }
    }
  }

  const rowRange = largestDenseRange(rowGold, w)
  const colRange = largestDenseRange(colGold, h)

  if (!rowRange || !colRange) {
    return { x: 0, y: 0, w: 1, h: 1 }
  }

  // Small padding outward so the crop includes the full outer card edge.
  const padX = w * 0.01
  const padY = h * 0.01
  const left = Math.max(0, colRange.start - padX) / w
  const right = Math.min(w, colRange.end + padX) / w
  const top = Math.max(0, rowRange.start - padY) / h
  const bottom = Math.min(h, rowRange.end + padY) / h

  return { x: left, y: top, w: right - left, h: bottom - top }
}

/**
 * Find the longest contiguous range of indices where the smoothed density
 * is above a threshold proportional to the per-index sample width. Tolerates
 * small gaps (e.g., the spacing between cards in a row) via a moving-window
 * smooth.
 */
function largestDenseRange(
  counts: number[],
  perIndexSize: number,
): { start: number; end: number } | null {
  const n = counts.length
  if (n === 0) return null

  const window = Math.max(4, Math.round(n * 0.05))
  const smoothed = new Array<number>(n).fill(0)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += counts[i]!
    if (i >= window) sum -= counts[i - window]!
    smoothed[i] = sum / Math.min(window, i + 1)
  }

  const threshold = 0.02 * perIndexSize
  let bestStart = -1
  let bestEnd = -1
  let curStart = -1
  for (let i = 0; i < n; i++) {
    if (smoothed[i]! > threshold) {
      if (curStart === -1) curStart = i
    } else if (curStart !== -1) {
      if (i - 1 - curStart > bestEnd - bestStart) {
        bestStart = curStart
        bestEnd = i - 1
      }
      curStart = -1
    }
  }
  if (curStart !== -1 && n - 1 - curStart > bestEnd - bestStart) {
    bestStart = curStart
    bestEnd = n - 1
  }
  if (bestStart < 0) return null
  return { start: bestStart, end: bestEnd }
}

export interface DetectPoolOptions {
  rows?: number
  cols?: number
  /**
   * Fraction of the cell to crop inward before hashing. Removes common border
   * overlays (faction frames, class badges) so the match focuses on the
   * portrait core. 0 = use the whole cell, 0.1 = crop 10% from each edge.
   */
  inset?: number
  /**
   * Max accepted match distance (1 - NCC). Above this, the cell is marked
   * unknown and the user is expected to pick from `alternatives` manually.
   */
  acceptThreshold?: number
  /**
   * Optional bounding box of the pool grid within the image (as ratios).
   * When omitted, the full image is used. Essential when the screenshot
   * contains game UI/chrome around the grid.
   */
  crop?: CropRect
  /**
   * Maximum per-cell offset (as a fraction of cell size) to search over
   * when locating the best match. Set 0 to disable the search and use the
   * exact geometric cell position.
   */
  offsetRange?: number
  /**
   * Number of offset samples per axis (odd = includes center). 3 → 3x3=9
   * total positions, 5 → 5x5=25. Higher = more robust to misalignment, slower.
   */
  offsetSteps?: number
}

const DEFAULT_OPTIONS: Required<Omit<DetectPoolOptions, 'crop'>> = {
  rows: 4,
  cols: 5,
  inset: 0.02,
  // 1 - NCC: 0 = identical, ~1 = unrelated. A match above this is rejected.
  acceptThreshold: 0.5,
  // Try offsets up to ±10% of cell size in each direction. Absorbs grid
  // alignment slop without needing a full global template search.
  offsetRange: 0.1,
  offsetSteps: 5,
}

/**
 * Slice the screenshot into a rows×cols grid, hash each cell, and match
 * against pre-computed hero hashes.
 */
export async function detectPool(
  source: File | HTMLImageElement,
  heroSignatures: Record<string, Float32Array>,
  options: DetectPoolOptions = {},
): Promise<PoolDetection[]> {
  const { crop, ...rest } = options
  const opts = { ...DEFAULT_OPTIONS, ...rest }
  const img = source instanceof File ? await loadFile(source) : source

  // Grid bounds in image pixel space
  const gridX = (crop?.x ?? 0) * img.naturalWidth
  const gridY = (crop?.y ?? 0) * img.naturalHeight
  const gridW = (crop?.w ?? 1) * img.naturalWidth
  const gridH = (crop?.h ?? 1) * img.naturalHeight

  const cellW = gridW / opts.cols
  const cellH = gridH / opts.rows
  const insetX = cellW * opts.inset
  const insetY = cellH * opts.inset

  const heroEntries = Object.entries(heroSignatures)

  const detections: PoolDetection[] = []
  const cellCanvas = document.createElement('canvas')
  cellCanvas.width = Math.max(1, Math.round(cellW - insetX * 2))
  cellCanvas.height = Math.max(1, Math.round(cellH - insetY * 2))
  const ctx = cellCanvas.getContext('2d')!

  // Build the offset sample positions. When offsetSteps is 1 or offsetRange
  // is 0, this reduces to a single [0,0] offset (exact geometric position).
  const steps = Math.max(1, opts.offsetSteps)
  const offsets: Array<[number, number]> = []
  if (steps === 1 || opts.offsetRange === 0) {
    offsets.push([0, 0])
  } else {
    for (let iy = 0; iy < steps; iy++) {
      for (let ix = 0; ix < steps; ix++) {
        const dx = (ix / (steps - 1) - 0.5) * 2 * opts.offsetRange
        const dy = (iy / (steps - 1) - 0.5) * 2 * opts.offsetRange
        offsets.push([dx * cellW, dy * cellH])
      }
    }
  }

  for (let row = 0; row < opts.rows; row++) {
    for (let col = 0; col < opts.cols; col++) {
      // For each cell, search over a small grid of positional offsets and
      // keep the (reference, offset) combination with the lowest distance.
      let bestScored: Array<{ hero: string; distance: number }> | null = null
      let bestCropDataUrl = ''
      let bestDistance = Infinity

      for (const [ox, oy] of offsets) {
        const sx = gridX + col * cellW + insetX + ox
        const sy = gridY + row * cellH + insetY + oy
        const sw = cellW - insetX * 2
        const sh = cellH - insetY * 2
        ctx.clearRect(0, 0, cellCanvas.width, cellCanvas.height)
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cellCanvas.width, cellCanvas.height)
        const sig = computeSignature(cellCanvas)

        const scored = heroEntries
          .map(([name, refSig]) => ({
            hero: name,
            distance: signatureDistance(sig, refSig),
          }))
          .sort((a, b) => a.distance - b.distance)

        const top = scored[0]
        if (top && top.distance < bestDistance) {
          bestDistance = top.distance
          bestScored = scored
          bestCropDataUrl = cellCanvas.toDataURL('image/png')
        }
      }

      const best = bestScored?.[0]
      const alternatives = bestScored?.slice(1, 5) ?? []

      detections.push({
        hero: best && best.distance <= opts.acceptThreshold ? best.hero : null,
        distance: best?.distance ?? Infinity,
        alternatives,
        crop: bestCropDataUrl,
        row,
        col,
      })
    }
  }

  // De-dupe: if two cells map to the same hero, keep the closer match and
  // bump the weaker one to its best non-conflicting alternative.
  resolveDuplicates(detections, opts.acceptThreshold)

  return detections
}

function resolveDuplicates(detections: PoolDetection[], threshold: number): void {
  const claimed = new Map<string, PoolDetection>()
  for (const d of detections) {
    if (!d.hero) continue
    const prev = claimed.get(d.hero)
    if (!prev) {
      claimed.set(d.hero, d)
      continue
    }
    // The farther-distance detection loses its top pick; try alternatives
    const loser = d.distance > prev.distance ? d : prev
    const winner = loser === d ? prev : d
    claimed.set(winner.hero!, winner)

    for (const alt of loser.alternatives) {
      if (alt.distance > threshold) break
      if (!claimed.has(alt.hero)) {
        loser.hero = alt.hero
        loser.distance = alt.distance
        claimed.set(alt.hero, loser)
        return resolveDuplicates(detections, threshold)
      }
    }
    loser.hero = null
  }
}

async function loadFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}
