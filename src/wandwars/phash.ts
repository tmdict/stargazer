/**
 * Perceptual image hashing via dHash (difference hash).
 *
 * Resizes the image to 9x8 grayscale, then compares each horizontally adjacent
 * pixel pair to produce 64 bits describing the image's gradient pattern.
 * Tolerant of resizing, compression, and minor color/brightness shifts.
 *
 * Comparison: hamming distance between two 64-bit hashes. Typical thresholds:
 *   < 10  near-identical (high confidence match)
 *   10–16 likely match
 *   > 20  probably different images
 */

const HASH_WIDTH = 9
const HASH_HEIGHT = 8
const WORK_SIZE = 64 // intermediate size where we apply the circular mask

/**
 * Draw an image onto a hidden canvas, downscale to 9x8 grayscale,
 * and compute the 64-bit dHash.
 *
 * By default, applies a circular mask at the intermediate resolution so
 * background pixels outside the portrait's circular art (which vary per
 * screenshot) don't contribute to the hash.
 */
export function hashImage(
  source: HTMLImageElement | HTMLCanvasElement,
  options: { circularMask?: boolean } = {},
): bigint {
  const { circularMask = true } = options

  // Intermediate render: optionally clip to a circle so corners are zeroed.
  const work = document.createElement('canvas')
  work.width = WORK_SIZE
  work.height = WORK_SIZE
  const workCtx = work.getContext('2d', { willReadFrequently: true })!
  if (circularMask) {
    workCtx.save()
    workCtx.beginPath()
    workCtx.arc(WORK_SIZE / 2, WORK_SIZE / 2, WORK_SIZE / 2, 0, Math.PI * 2)
    workCtx.closePath()
    workCtx.clip()
    workCtx.drawImage(source, 0, 0, WORK_SIZE, WORK_SIZE)
    workCtx.restore()
  } else {
    workCtx.drawImage(source, 0, 0, WORK_SIZE, WORK_SIZE)
  }

  // Final downscale for dHash
  const canvas = document.createElement('canvas')
  canvas.width = HASH_WIDTH
  canvas.height = HASH_HEIGHT
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(work, 0, 0, HASH_WIDTH, HASH_HEIGHT)

  const data = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT).data

  // Grayscale luminance values
  const gray = new Array<number>(HASH_WIDTH * HASH_HEIGHT)
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4]!
    const g = data[i * 4 + 1]!
    const b = data[i * 4 + 2]!
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Build 64-bit hash: for each row, compare adjacent pixels
  let hash = 0n
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = gray[y * HASH_WIDTH + x]!
      const right = gray[y * HASH_WIDTH + x + 1]!
      hash = (hash << 1n) | (left > right ? 1n : 0n)
    }
  }
  return hash
}

/**
 * Count the differing bits between two 64-bit hashes (0–64).
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

/**
 * Load an image URL into an HTMLImageElement (awaited decode).
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await img.decode()
  return img
}

/**
 * Pre-compute hashes for a set of hero portraits. Returns a map from hero name
 * to 64-bit hash. Failed loads are silently skipped.
 */
export async function computeHeroHashes(
  characterImages: Record<string, string>,
): Promise<Record<string, bigint>> {
  const entries = await Promise.all(
    Object.entries(characterImages).map(async ([name, src]) => {
      try {
        const img = await loadImage(src)
        return [name, hashImage(img)] as const
      } catch {
        return null
      }
    }),
  )
  const result: Record<string, bigint> = {}
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1]
  }
  return result
}
