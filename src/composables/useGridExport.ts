import { useI18nStore } from '@/stores/i18n'
import { copyImageBlob } from '@/utils/clipboard'
import { downloadBlob, timestampedName } from '@/utils/download'
import { useToast } from './useToast'

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
  // Optional element captured flat and stacked below the grid image (the Team Power
  // panel), so the grid's perspective crop never clips it. Skipped when absent.
  appendTarget?: string
  // html-to-image node filter (return false to drop a node from the capture).
  filter?: (node: HTMLElement) => boolean
  // Download filename prefix (timestamped); unused by copyToClipboard.
  filePrefix?: string
}

export function useGridExport() {
  const { success, error } = useToast()
  const i18n = useI18nStore()

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
      filter: options.filter,
    }

    // WebKit rasterizes the foreignObject snapshot before its embedded images
    // finish decoding (WebKit bug 99677) and drops the slowest — the remote
    // artifact WebP; a throwaway pass primes the image cache for the kept pass.
    const capture = async (element: HTMLElement): Promise<string> => {
      if (isWebKit()) await toPng(element, toPngOptions)
      return toPng(element, toPngOptions)
    }

    try {
      let dataUrl = await capture(containerElement)

      // If in perspective mode, crop the image to remove empty space
      if (options.showPerspective) {
        dataUrl = await cropPerspectiveImage(dataUrl, options.perspectiveCompression ?? 0.55)
      }

      // Stack an extra element (the Team Power panel) below the grid. Captured flat
      // and appended after the crop so the perspective math never touches it.
      if (options.appendTarget) {
        const appendElement = document.querySelector<HTMLElement>(options.appendTarget)
        if (appendElement) {
          const appendUrl = await capture(appendElement)
          dataUrl = await stackImagesVertically(dataUrl, appendUrl)
        }
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

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    const img = new Image()
    img.src = src
    return new Promise((resolve) => {
      img.onload = () => resolve(img)
    })
  }

  // Stack two PNG data URLs into one image, the second centered below the first.
  const stackImagesVertically = async (topUrl: string, bottomUrl: string): Promise<string> => {
    const [top, bottom] = await Promise.all([loadImage(topUrl), loadImage(bottomUrl)])
    const gap = 24
    const width = Math.max(top.width, bottom.width)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = top.height + gap + bottom.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return topUrl
    ctx.drawImage(top, Math.round((width - top.width) / 2), 0)
    ctx.drawImage(bottom, Math.round((width - bottom.width) / 2), top.height + gap)
    return canvas.toDataURL('image/png', 1.0)
  }

  /**
   * Copies the grid image to clipboard
   */
  const copyToClipboard = async (options: ExportOptions): Promise<void> => {
    try {
      // The pending capture is handed to the clipboard un-awaited: Safari
      // treats an awaited gap as the end of the user activation and denies
      // the write, so the browser must await the blob itself.
      await copyImageBlob(captureGrid(options).then(dataUrlToBlob))
      success(i18n.t('app.copied-clipboard'))
    } catch (err) {
      console.error('Failed to copy grid image:', err)
      error(i18n.t('app.copy-image-failed'))
    }
  }

  /**
   * Downloads the grid image as a PNG file
   */
  const downloadAsImage = async (options: ExportOptions): Promise<void> => {
    try {
      const dataUrl = await captureGrid(options)
      // iPadOS Safari silently drops <a download> clicks on multi-MB data: URLs.
      const blob = await dataUrlToBlob(dataUrl)
      downloadBlob(blob, timestampedName(options.filePrefix ?? 'stargazer', 'png'))
      success(i18n.t('app.grid-downloaded'))
    } catch (err) {
      console.error('Failed to export grid:', err)
      error(i18n.t('app.download-failed'))
    }
  }

  return {
    captureGrid,
    copyToClipboard,
    downloadAsImage,
  }
}
