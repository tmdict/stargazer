import { useToast } from './useToast'

interface ExportOptions {
  showPerspective: boolean
  perspectiveCompression?: number
}

export function useGridExport() {
  const { success, error } = useToast()

  /**
   * Captures the grid as a PNG data URL, with optional perspective cropping
   */
  const captureGrid = async (options: ExportOptions): Promise<string> => {
    // Import html-to-image dynamically
    const { toPng } = await import('html-to-image')

    // Get the perspective container to capture all transforms
    const containerElement = document.querySelector<HTMLElement>('.perspective-container')
    if (!containerElement) {
      throw new Error('Perspective container not found')
    }

    // Generate PNG from the perspective container (includes all transforms)
    let dataUrl = await toPng(containerElement, {
      quality: 1.0,
      pixelRatio: 2, // Higher quality export
      backgroundColor: 'transparent', // Transparent background
    })

    // If in perspective mode, crop the image to remove empty space
    if (options.showPerspective) {
      dataUrl = await cropPerspectiveImage(dataUrl, options.perspectiveCompression ?? 0.55)
    }

    return dataUrl
  }

  /**
   * Crops image to remove empty space when in perspective mode
   */
  const cropPerspectiveImage = async (
    dataUrl: string,
    compressionRatio: number,
  ): Promise<string> => {
    // Load image into canvas for cropping
    const img = new Image()
    img.src = dataUrl
    await new Promise((resolve) => {
      img.onload = resolve
    })

    // Create canvas for cropping
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

    // Set canvas size to cropped dimensions
    canvas.width = img.width
    canvas.height = cropHeight

    // Draw cropped image
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

    // Get cropped image as data URL
    return canvas.toDataURL('image/png', 1.0)
  }

  /**
   * Copies the grid image to clipboard
   */
  const copyToClipboard = async (options: ExportOptions): Promise<void> => {
    try {
      const dataUrl = await captureGrid(options)

      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Copy to clipboard using Clipboard API
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ])
        success('Copied to clipboard!')
      } else {
        // Fallback: show message for manual copy
        error('Clipboard not supported')
      }
    } catch (err) {
      console.error('Failed to copy grid image:', err)
      error('Failed to copy image')
    }
  }

  /**
   * Downloads the grid image as a PNG file
   */
  const downloadAsImage = async (options: ExportOptions): Promise<void> => {
    try {
      const dataUrl = await captureGrid(options)

      // Create download link
      const now = new Date()
      const dateStr = (now.toISOString().split('T')[0] ?? 'undefined').replace(/-/g, '')
      const timeStr =
        (now.toTimeString().split(' ')[0] ?? 'undefined').replace(/:/g, '') +
        now.getMilliseconds().toString().padStart(3, '0')
      const link = document.createElement('a')
      link.download = `stargazer-${dateStr}-${timeStr}.png`
      link.href = dataUrl

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      success('Grid downloaded!')
    } catch (err) {
      console.error('Failed to export grid:', err)
      error('Download failed')
    }
  }

  return {
    captureGrid,
    copyToClipboard,
    downloadAsImage,
  }
}
