import { useGrids } from '@/stores/grids'
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

type StyleValues = Record<string, string>
type CaptureElement = HTMLElement | SVGElement

// Export-only style overrides: html-to-image styles its clone from each node's
// computed style, so overrides are set inline (always reflected by
// getComputedStyle); the returned restore puts the previous inline values back.
function overrideForCapture(
  root: HTMLElement,
  selector: string,
  overrides: StyleValues | ((el: CaptureElement) => StyleValues),
): () => void {
  const restores = Array.from(root.querySelectorAll<CaptureElement>(selector)).map((el) => {
    const style = el.style as CSSStyleDeclaration & StyleValues
    const prev: StyleValues = {}
    const values = typeof overrides === 'function' ? overrides(el) : overrides
    for (const [key, value] of Object.entries(values)) {
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

// html-to-image clones an <svg> whole and styles only its root, and the clone
// draws without the page's stylesheets, so a shape keeps only what it carries
// itself. These are the properties the stylesheets set that change a drawing.
const SVG_PAINT = ['display', 'fill', 'opacity', 'stroke'] as const

// The library's filter stops at an <svg>, so a marked shape stays in the clone.
// Left out here, it keeps its transparent attributes.
const SVG_SHAPES = 'svg *:not(.capture-exclude, .capture-exclude *)'

// A value already inline survives the clone, and a render during the capture may
// rewrite it, so only the rest is copied.
const stylesheetPaint = (shape: CaptureElement): StyleValues => {
  const computed = getComputedStyle(shape)
  return Object.fromEntries(
    SVG_PAINT.filter((prop) => !shape.style[prop]).map((prop) => [prop, computed[prop]]),
  )
}

// WebKit writes a clone's radii and corner shapes as one `corner` shorthand that
// it cannot read back, which squares every rounded box. Without the shapes, which
// the site does not use, the radii stay in their own properties.
const copiedStyleProperties = (): string[] =>
  Array.from(getComputedStyle(document.documentElement)).filter(
    (name) => !name.startsWith('corner-'),
  )

// WebKit misplaces a spread shadow when the clone is scaled up, leaving a dark
// chunk beside each portrait. An outline draws the same disc.
const PORTRAIT_DISC_OUTLINE = {
  boxShadow: 'none',
  outline: 'var(--character-border-width, 3px) solid var(--disc)',
}

// Room kept around the drawn content when a capture is trimmed, in CSS pixels on
// a full-size board; it scales with the board, so every screen saves the same.
const CROP_MARGIN = 8
// Room kept between rows of boards (the Teams page's wrap layout), in the same
// units. On screen the space under a row also holds the hero cards and buttons
// the image leaves out, so the trim closes it up to this.
const ROW_GAP = 68

// Image pixels per CSS pixel on a full-size board: portraits are drawn from their
// 100px-wide display images (imageAssets.ts) at 48px inside their borders, so this
// keeps every portrait pixel. A smaller board (a phone) scales up to match, so
// every screen saves the same image.
const FULL_DETAIL_RATIO = 100 / 48
// The largest canvas iOS Safari draws is 4096 x 4096; a capture stays under it.
const MAX_EXPORT_PIXELS = 16_000_000

export function useGridExport() {
  const { copyImage, downloadImage } = useImageExportActions()
  const grids = useGrids()

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

    const restores = [
      // Hide the 5 v 5 active-board ring / hover tint; transition: none keeps it
      // instant so the border isn't captured mid-fade.
      overrideForCapture(containerElement, '.grid-board', {
        transition: 'none',
        borderColor: 'transparent',
        background: 'transparent',
      }),
      overrideForCapture(containerElement, SVG_SHAPES, stylesheetPaint),
      ...(isWebKit()
        ? [overrideForCapture(containerElement, '.character-image', PORTRAIT_DISC_OUTLINE)]
        : []),
    ]

    const box = containerElement.getBoundingClientRect()
    const pixelRatio = Math.min(
      FULL_DETAIL_RATIO / grids.getHexScale(),
      Math.sqrt(MAX_EXPORT_PIXELS / (box.width * box.height)),
    )
    const toPngOptions = {
      quality: 1.0,
      pixelRatio,
      backgroundColor: 'transparent',
      filter: excludeMarkedChrome,
      includeStyleProperties: copiedStyleProperties(),
    }

    // WebKit rasterizes the foreignObject snapshot before its embedded images
    // finish decoding (WebKit bug 99677) and can drop the slowest; a throwaway
    // pass primes the image cache for the kept pass.
    const capture = async (element: HTMLElement): Promise<string> => {
      if (isWebKit()) await toPng(element, toPngOptions)
      return toPng(element, toPngOptions)
    }

    try {
      const dataUrl = await capture(containerElement)
      // Whole-pixel spacing keeps the trim from resampling, and so blurring, the image.
      const toImagePixels = (cssPixels: number): number =>
        Math.round(cssPixels * grids.getHexScale() * pixelRatio)
      return await cropToDrawn(dataUrl, toImagePixels(CROP_MARGIN), toImagePixels(ROW_GAP))
    } finally {
      restores.forEach((restore) => restore())
    }
  }

  /**
   * Crops the empty space around what the capture draws: the room the perspective
   * squash leaves, the space of excluded chrome, and the width of the board's area
   * beyond the board. The capture's background is transparent, so the outermost
   * rows and columns holding any pixel bound everything drawn: tiles, the portraits
   * standing above the far row, and arrows reaching over them. A board draws
   * without a break from top to bottom, so an empty band across the image lies
   * between rows of boards, where the upper row's excluded chrome left its space;
   * the crop keeps `rowGap` of it.
   */
  const cropToDrawn = async (dataUrl: string, margin: number, rowGap: number): Promise<string> => {
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
    const drawnRows = Array.from({ length: img.height }, (_, y) => drawn(y))
    const top = drawnRows.indexOf(true)
    if (top === -1) return dataUrl
    const bottom = drawnRows.lastIndexOf(true) + 1

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

    const spans: [number, number][] = []
    let from = Math.max(0, top - margin)
    for (let y = top; y < bottom; y++) {
      if (drawnRows[y]) continue
      const gapStart = y
      while (!drawnRows[y]) y++
      if (y - gapStart > rowGap) {
        spans.push([from, gapStart + rowGap])
        from = y
      }
    }
    spans.push([from, Math.min(img.height, bottom + margin)])

    const cropLeft = Math.max(0, left - margin)
    const cropRight = Math.min(img.width, right + margin)
    canvas.width = cropRight - cropLeft
    canvas.height = spans.reduce((height, [start, end]) => height + end - start, 0)
    let offset = 0
    for (const [start, end] of spans) {
      const rows = end - start
      ctx.drawImage(img, cropLeft, start, canvas.width, rows, 0, offset, canvas.width, rows)
      offset += rows
    }

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
