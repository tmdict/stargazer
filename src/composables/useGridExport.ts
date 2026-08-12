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
  showPerspective: boolean
  perspectiveCompression?: number
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

export function useGridExport() {
  const { copyImage, downloadImage } = useImageExportActions()

  /**
   * Captures the grid as a PNG data URL, with optional perspective cropping
   */
  const captureGrid = async (options: ExportOptions): Promise<string> => {
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

    const toPngOptions = {
      quality: 1.0,
      pixelRatio: 2,
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

      if (options.showPerspective) {
        return cropPerspectiveImage(dataUrl, options.perspectiveCompression ?? 0.55)
      }

      return dataUrl
    } finally {
      restoreBoards()
    }
  }

  /**
   * Crops image to remove empty space when in perspective mode
   */
  const cropPerspectiveImage = async (
    dataUrl: string,
    compressionRatio: number,
  ): Promise<string> => {
    const img = await loadImage(dataUrl)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Calculate crop dimensions
    // In perspective mode, content is compressed to compressionRatio height and centered
    const cropRatio = (1 - compressionRatio) / 2
    const cropTop = Math.max(0, Math.floor(img.height * cropRatio) - 100) // Reduce top crop by 100px for character profiles
    const cropHeight = Math.min(
      img.height - cropTop,
      Math.floor(img.height * compressionRatio) + 100,
    ) // Adjust height accordingly

    canvas.width = img.width
    canvas.height = cropHeight

    ctx.drawImage(
      img,
      0,
      cropTop, // Source x, y
      img.width,
      cropHeight, // Source width, height
      0,
      0, // Destination x, y
      img.width,
      cropHeight, // Destination width, height
    )

    return canvas.toDataURL('image/png', 1.0)
  }

  const copyToClipboard = (options: ExportOptions): Promise<void> =>
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
    captureGrid,
    copyToClipboard,
    downloadAsImage,
  }
}
