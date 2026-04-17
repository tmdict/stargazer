/**
 * Crop each hero reference PNG to the bounding box of its gold border,
 * then resize to a uniform 170x230. Writes to a sibling `portraits_normalized/`
 * folder — review, then rename/replace `portraits/` when satisfied.
 *
 * Usage: npx tsx src/wandwars/scripts/normalize-references.ts
 * Requires: sharp (already installed)
 */

import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const INPUT_DIR = join(import.meta.dirname!, '../data/raw/portraits')
const OUTPUT_DIR = join(import.meta.dirname!, '../data/raw/portraits_normalized')

const TARGET_W = 170
const TARGET_H = 230

/**
 * Classify a pixel as part of the gold border. Uses hue + saturation
 * thresholds in HSV — orange-yellow with enough vibrance to exclude skin
 * tones and background beige.
 */
function isGold(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (max < 100) return false
  if (delta < 40) return false
  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return hue >= 25 && hue <= 55
}

interface BBox {
  left: number
  top: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}

async function findGoldBoundingBox(inputPath: string): Promise<BBox | null> {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      const r = data[idx]!
      const g = data[idx + 1]!
      const b = data[idx + 2]!
      const a = channels >= 4 ? data[idx + 3]! : 255
      if (a < 128) continue
      if (!isGold(r, g, b)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) return null
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    sourceWidth: width,
    sourceHeight: height,
  }
}

interface ProcessResult {
  file: string
  skipped?: boolean
  error?: string
  source?: string
  crop?: string
  offset?: string
}

async function processFile(file: string): Promise<ProcessResult> {
  const input = join(INPUT_DIR, file)
  const output = join(OUTPUT_DIR, file)

  const bbox = await findGoldBoundingBox(input)
  if (!bbox) {
    console.warn(`  ${file}: no gold pixels detected — skipped`)
    return { file, skipped: true }
  }

  await sharp(input)
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .resize(TARGET_W, TARGET_H, { kernel: 'lanczos3' })
    .flatten({ background: '#808080' })
    .png()
    .toFile(output)

  return {
    file,
    source: `${bbox.sourceWidth}x${bbox.sourceHeight}`,
    crop: `${bbox.width}x${bbox.height}`,
    offset: `(${bbox.left},${bbox.top})`,
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const files = (await readdir(INPUT_DIR)).filter((f) => f.toLowerCase().endsWith('.png'))
  console.log(`Processing ${files.length} images → ${OUTPUT_DIR}\n`)

  const results: ProcessResult[] = []
  for (const file of files) {
    try {
      const r = await processFile(file)
      results.push(r)
      if (!r.skipped) {
        console.log(`  ${file.padEnd(28)} ${r.source} → crop ${r.crop} @ ${r.offset}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ${file}: ${msg}`)
      results.push({ file, error: msg })
    }
  }

  const ok = results.filter((r) => !r.skipped && !r.error).length
  const skipped = results.filter((r) => r.skipped).length
  const failed = results.filter((r) => r.error).length
  console.log(`\nDone: ${ok} normalized, ${skipped} skipped (no gold), ${failed} failed`)

  const cropped = results.filter((r) => !r.skipped && !r.error && r.crop)
  if (cropped.length > 0) {
    const widths = cropped.map((r) => parseInt(r.crop!.split('x')[0]!, 10))
    const heights = cropped.map((r) => parseInt(r.crop!.split('x')[1]!, 10))
    const median = (arr: number[]) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)]!
    const mw = median(widths)
    const mh = median(heights)
    const outliers = cropped.filter((r) => {
      const [w, h] = r.crop!.split('x').map((n) => parseInt(n, 10))
      return Math.abs(w! - mw) > 8 || Math.abs(h! - mh) > 12
    })
    if (outliers.length > 0) {
      console.log(`\nOutliers (crop size far from median ${mw}x${mh}):`)
      for (const o of outliers) {
        console.log(`  ${o.file.padEnd(28)} crop ${o.crop}`)
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
