import { useGridStore } from '@/stores/grid'
import { loadImage } from '@/utils/image'
import { useImageExportActions } from './useImageExportActions'

// True WebKit only: Safari on any platform, plus every iOS/iPadOS browser
// (all WKWebView). Blink UAs also claim "AppleWebKit", so Chrome-likes must
// be excluded; iPadOS reports a Mac platform, hence the touch-points check.
function isWebKit(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)) ||
    (/AppleWebKit/.test(navigator.userAgent) && !/Chrom|Edg|OPR/.test(navigator.userAgent))
  )
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => (await fetch(dataUrl)).blob()

// Export-only style overrides: html-to-image styles its clone from each node's
// computed style, so overrides are set inline (always reflected by
// getComputedStyle); the returned restore puts the previous inline values back.
function overrideForCapture(
  root: HTMLElement,
  selector: string,
  overrides: Record<string, string>,
): () => void {
  const restores = Array.from(root.querySelectorAll<HTMLElement>(selector)).map((el) => {
    const style = el.style as CSSStyleDeclaration & Record<string, string>
    const prev: Record<string, string> = {}
    for (const [key, value] of Object.entries(overrides)) {
      prev[key] = style[key]
      style[key] = value
    }
    return () => Object.assign(style, prev)
  })
  return () => restores.forEach((restore) => restore())
}

interface ExportOptions {
  // Element to capture; defaults to the single grid's perspective container.
  // 5 v 5 passes the boards row to capture all five at once.
  target?: string
  // Download filename prefix (timestamped); unused by copyToClipboard.
  filePrefix?: string
}

// On-screen chrome marked with this class (per-board action buttons, the Team
// Power panel) is dropped from every image export.
const excludeMarkedChrome = (node: HTMLElement): boolean =>
  !node.classList?.contains('capture-exclude')

// Room kept around the drawn content when a capture is trimmed, in CSS pixels on
// a full-size board; it scales with the board, so every screen saves the same.
const CROP_MARGIN = 8

// Image pixels per CSS pixel on a full-size board: hero portraits are 180px-wide
// sources shown 54px wide there, so this keeps their full detail. A smaller
// board (a phone) scales up to match, so every screen saves the same image.
const FULL_DETAIL_RATIO = 180 / 54
// The largest canvas iOS Safari draws is 4096 x 4096; a capture stays under it.
const MAX_EXPORT_PIXELS = 16_000_000

export function useGridExport() {
  const { copyImage, downloadImage } = useImageExportActions()
  const gridStore = useGridStore()

  /**
   * Captures the grid as a PNG data URL, trimmed to what it draws
   */
  const captureGrid = async (options: ExportOptions = {}): Promise<string> => {
    const { toPng } = await import('html-to-image')

    // Get the capture target (default: the single grid's perspective container).
    const selector = options.target ?? '.perspective-container'
    const containerElement = document.querySelector<HTMLElement>(selector)
    if (!containerElement) {
      throw new Error(`Capture target not found: ${selector}`)
    }

    // Hide the 5 v 5 active-board ring / hover tint; transition: none keeps it
    // instant so the border isn't captured mid-fade.
    const restoreBoards = overrideForCapture(containerElement, '.grid-board', {
      transition: 'none',
      borderColor: 'transparent',
      background: 'transparent',
    })

    const box = containerElement.getBoundingClientRect()
    const pixelRatio = Math.min(
      FULL_DETAIL_RATIO / gridStore.getHexScale(),
      Math.sqrt(MAX_EXPORT_PIXELS / (box.width * box.height)),
    )
    const toPngOptions = {
      quality: 1.0,
      pixelRatio,
      backgroundColor: 'transparent',
      filter: excludeMarkedChrome,
    }

    // WebKit rasterizes the foreignObject snapshot before its embedded images
    // finish decoding (WebKit bug 99677) and drops the slowest — the remote
    // artifact WebP; a throwaway pass primes the image cache for the kept pass.
    const capture = async (element: HTMLElement): Promise<string> => {
      if (isWebKit()) await toPng(element, toPngOptions)
      return toPng(element, toPngOptions)
    }

    try {
      const dataUrl = await capture(containerElement)
      // A whole-pixel margin keeps the trim from resampling, and so blurring, the image.
      const margin = Math.round(CROP_MARGIN * gridStore.getHexScale() * pixelRatio)
      return await cropToDrawn(dataUrl, margin)
    } finally {
      restoreBoards()
    }
  }

  /**
   * Crops the empty space around what the capture draws: the room the perspective
   * squash leaves, the space of excluded chrome, and the width of the board's area
   * beyond the board. The capture's background is transparent, so the outermost
   * rows and columns holding any pixel bound everything drawn: tiles, the portraits
   * standing above the far row, and arrows reaching over them.
   */
  const cropToDrawn = async (dataUrl: string, margin: number): Promise<string> => {
    const img = await loadImage(dataUrl)

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }
    ctx.drawImage(img, 0, 0)

    const { data } = ctx.getImageData(0, 0, img.width, img.height)
    const drawn = (y: number): boolean => {
      for (let x = 0; x < img.width; x++) {
        if (data[(y * img.width + x) * 4 + 3]) return true
      }
      return false
    }
    let top = 0
    while (top < img.height && !drawn(top)) top++
    if (top === img.height) return dataUrl
    let bottom = img.height
    while (!drawn(bottom - 1)) bottom--

    const drawnColumn = (x: number): boolean => {
      for (let y = top; y < bottom; y++) {
        if (data[(y * img.width + x) * 4 + 3]) return true
      }
      return false
    }
    let left = 0
    while (!drawnColumn(left)) left++
    let right = img.width
    while (!drawnColumn(right - 1)) right--

    const cropTop = Math.max(0, top - margin)
    const cropBottom = Math.min(img.height, bottom + margin)
    const cropLeft = Math.max(0, left - margin)
    const cropRight = Math.min(img.width, right + margin)
    canvas.width = cropRight - cropLeft
    canvas.height = cropBottom - cropTop
    ctx.drawImage(img, -cropLeft, -cropTop)

    return canvas.toDataURL('image/png', 1.0)
  }

  const copyToClipboard = (options: ExportOptions = {}): Promise<void> =>
    copyImage(captureGrid(options).then(dataUrlToBlob))

  // Downloads go through a Blob: iPadOS Safari silently drops <a download>
  // clicks on multi-MB data: URLs.
  const downloadAsImage = (options: ExportOptions): Promise<void> =>
    downloadImage(
      captureGrid(options).then(dataUrlToBlob),
      options.filePrefix ?? 'stargazer',
      'app.grid-downloaded',
    )

  return {
    copyToClipboard,
    downloadAsImage,
  }
}
