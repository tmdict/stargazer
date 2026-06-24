import { useI18nStore } from '@/stores/i18n'
import { copyImageBlob } from '@/utils/clipboard'
import { downloadUrl, timestampedName } from '@/utils/download'
import { useToast } from './useToast'

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

    // Hide the 5 v 5 active-board ring / hover tint in the export. html-to-image styles
    // its clone from each node's computed style, so set the override inline (always
    // reflected by getComputedStyle); transition: none keeps it instant so the border
    // isn't captured mid-fade. Restored in finally.
    const boards = Array.from(containerElement.querySelectorAll<HTMLElement>('.grid-board'))
    const restoreBoards = boards.map((el) => {
      const prev = {
        transition: el.style.transition,
        borderColor: el.style.borderColor,
        background: el.style.background,
      }
      el.style.transition = 'none'
      el.style.borderColor = 'transparent'
      el.style.background = 'transparent'
      return () => {
        el.style.transition = prev.transition
        el.style.borderColor = prev.borderColor
        el.style.background = prev.background
      }
    })

    try {
      // Generate PNG from the target (includes all transforms)
      let dataUrl = await toPng(containerElement, {
        quality: 1.0,
        pixelRatio: 2, // Higher quality export
        backgroundColor: 'transparent', // Transparent background
        filter: options.filter,
      })

      // If in perspective mode, crop the image to remove empty space
      if (options.showPerspective) {
        dataUrl = await cropPerspectiveImage(dataUrl, options.perspectiveCompression ?? 0.55)
      }

      // Stack an extra element (the Team Power panel) below the grid. Captured flat
      // and appended after the crop so the perspective math never touches it.
      if (options.appendTarget) {
        const appendElement = document.querySelector<HTMLElement>(options.appendTarget)
        if (appendElement) {
          const appendUrl = await toPng(appendElement, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: 'transparent',
            filter: options.filter,
          })
          dataUrl = await stackImagesVertically(dataUrl, appendUrl)
        }
      }

      return dataUrl
    } finally {
      restoreBoards.forEach((restore) => restore())
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
      const dataUrl = await captureGrid(options)
      const blob = await (await fetch(dataUrl)).blob()
      await copyImageBlob(blob)
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
      downloadUrl(dataUrl, timestampedName(options.filePrefix ?? 'stargazer', 'png'))
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
