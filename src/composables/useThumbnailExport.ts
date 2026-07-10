import { canvasToBlob, loadImage } from '@/utils/image'
import { useImageExportActions } from './useImageExportActions'

/* Exports a saved-team card's thumbnail as a PNG. The preview is a row of
 * self-contained BoardThumbnail SVGs (presentation attributes only, internal
 * clipPaths), so each board is serialized and rasterized through an <img>,
 * then drawn onto one canvas at the preview's own layout positions. A DOM
 * snapshot (useGridExport's html-to-image path) is deliberately avoided here:
 * WebKit fails to rasterize SVG content inside a foreignObject snapshot. */

// The on-screen thumbnail is small; the scale brings a card export up to
// full-grid resolution (the SVGs upscale losslessly).
const CAPTURE_SCALE = 6

// An SVG loaded through an <img> cannot reference external resources at all,
// so portrait hrefs must become data: URLs before serialization. Portraits
// repeat across boards and cards; each URL is fetched once.
const dataUrlCache = new Map<string, Promise<string>>()

function toDataUrl(url: string): Promise<string> {
  const cached = dataUrlCache.get(url)
  if (cached) return cached
  const pending = fetch(url)
    .then((response) => {
      // fetch resolves on HTTP errors; without this check a 404 page would be
      // inlined (and cached) as the portrait.
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
      return response.blob()
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        }),
    )
  pending.catch(() => dataUrlCache.delete(url))
  dataUrlCache.set(url, pending)
  return pending
}

// Explicit width/height go on the clone because Safari rasterizes an SVG
// image at its intrinsic size: drawing a viewBox-only SVG upscaled onto the
// canvas comes out blurry there.
async function rasterizeSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', `${width}`)
  clone.setAttribute('height', `${height}`)
  await Promise.all(
    Array.from(clone.querySelectorAll('image')).map(async (image) => {
      const href = image.getAttribute('href')
      if (href && !href.startsWith('data:')) image.setAttribute('href', await toDataUrl(href))
    }),
  )
  const markup = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The preview's on-screen backdrop is a translucent wash over ancestor
// backgrounds, so the export composites the ancestor colors down to the first
// opaque one; the result matches the page (and follows the theme).
function backgroundLayers(el: HTMLElement): string[] {
  const layers: string[] = []
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    const alpha = color.startsWith('rgba') ? Number(color.slice(5, -1).split(',')[3]) : 1
    if (alpha === 0) continue
    layers.unshift(color)
    if (alpha >= 1) break
  }
  return layers
}

async function captureBoards(container: HTMLElement | undefined): Promise<Blob> {
  if (!container) throw new Error('Capture target missing')
  const svgs = Array.from(container.querySelectorAll('svg'))
  if (svgs.length === 0) throw new Error('No boards to capture')

  const bounds = container.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bounds.width * CAPTURE_SCALE)
  canvas.height = Math.round(bounds.height * CAPTURE_SCALE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')

  for (const layer of backgroundLayers(container)) {
    context.fillStyle = layer
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  const boards = await Promise.all(
    svgs.map(async (svg) => {
      const rect = svg.getBoundingClientRect()
      return {
        image: await rasterizeSvg(
          svg,
          Math.round(rect.width * CAPTURE_SCALE),
          Math.round(rect.height * CAPTURE_SCALE),
        ),
        x: Math.round((rect.left - bounds.left) * CAPTURE_SCALE),
        y: Math.round((rect.top - bounds.top) * CAPTURE_SCALE),
      }
    }),
  )
  for (const board of boards) {
    context.drawImage(board.image, board.x, board.y)
  }

  return canvasToBlob(canvas)
}

export function useThumbnailExport() {
  const { copyImage, downloadImage } = useImageExportActions()

  const copyToClipboard = (container: HTMLElement | undefined): Promise<void> =>
    copyImage(captureBoards(container))

  const downloadAsImage = (container: HTMLElement | undefined, filePrefix: string): Promise<void> =>
    downloadImage(captureBoards(container), filePrefix)

  return { copyToClipboard, downloadAsImage }
}
