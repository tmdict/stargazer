import { h, render } from 'vue'

import TeamPreview from '@/components/teams/TeamPreview.vue'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { canvasToBlob, loadImage } from '@/utils/image'
import { useImageExportActions } from './useImageExportActions'

/* Exports a saved team as a PNG drawn the way the preview popup shows it: the
 * popup's TeamPreview is rendered off-screen for each capture, so the image
 * follows the popup's look. Its boards are BoardThumbnail SVGs with internal
 * clipPaths, so each board is serialized and rasterized through an <img>,
 * then drawn onto one canvas at its layout position. A DOM snapshot
 * (useGridExport's html-to-image path) is deliberately avoided here: WebKit
 * fails to rasterize SVG content inside a foreignObject snapshot. */

// The popup's content width at its full 1000px, so the boards wrap as they do
// there on a desktop window, whatever the device. The image crops to the
// boards plus the margin.
const FRAME_WIDTH = 934
const MARGIN = 24
// The popup panel's colour, opaque: the panel itself is translucent over the
// page.
const BACKGROUND = 'rgb(20, 20, 20)'
// Keeps the portraits close to their source resolution.
const CAPTURE_SCALE = 3
const PAINTED = 'circle, line, path, polygon, rect, text'

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
  // An SVG drawn through an <img> sees none of the page's styles, and its
  // colours are tokens that differ between the light and dark looks, so each
  // shape takes the fill and stroke the page resolved for it.
  const sources = svg.querySelectorAll<SVGElement>(PAINTED)
  clone.querySelectorAll<SVGElement>(PAINTED).forEach((el, index) => {
    const resolved = getComputedStyle(sources[index]!)
    el.style.fill = resolved.fill
    el.style.stroke = resolved.stroke
  })
  clone.setAttribute('width', `${width}`)
  clone.setAttribute('height', `${height}`)
  // Non-scaling strokes are sized in screen pixels, so the enlarged image
  // would draw them thinner than the popup does.
  for (const el of clone.querySelectorAll('[vector-effect="non-scaling-stroke"]')) {
    const stroke = Number(el.getAttribute('stroke-width') ?? 1)
    el.setAttribute('stroke-width', `${stroke * CAPTURE_SCALE}`)
  }
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

async function captureBoards(container: HTMLElement): Promise<Blob> {
  const svgs = Array.from(container.querySelectorAll('svg'))
  if (svgs.length === 0) throw new Error('No boards to capture')

  const rects = svgs.map((svg) => svg.getBoundingClientRect())
  const left = Math.min(...rects.map((rect) => rect.left)) - MARGIN
  const top = Math.min(...rects.map((rect) => rect.top)) - MARGIN
  const right = Math.max(...rects.map((rect) => rect.right)) + MARGIN
  const bottom = Math.max(...rects.map((rect) => rect.bottom)) + MARGIN
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((right - left) * CAPTURE_SCALE)
  canvas.height = Math.round((bottom - top) * CAPTURE_SCALE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')

  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)

  const boards = await Promise.all(
    svgs.map(async (svg, index) => {
      const rect = rects[index]!
      return {
        image: await rasterizeSvg(
          svg,
          Math.round(rect.width * CAPTURE_SCALE),
          Math.round(rect.height * CAPTURE_SCALE),
        ),
        x: Math.round((rect.left - left) * CAPTURE_SCALE),
        y: Math.round((rect.top - top) * CAPTURE_SCALE),
      }
    }),
  )
  for (const board of boards) {
    context.drawImage(board.image, board.x, board.y)
  }

  return canvasToBlob(canvas)
}

async function captureTeam(team: SavedTeam): Promise<Blob> {
  const host = document.createElement('div')
  host.style.cssText = `position: fixed; top: 0; left: -10000px; width: ${FRAME_WIDTH}px;`
  document.body.append(host)
  render(h(TeamPreview, { team, large: true }), host)
  try {
    return await captureBoards(host)
  } finally {
    render(null, host)
    host.remove()
  }
}

export function useThumbnailExport() {
  const { copyImage, downloadImage } = useImageExportActions()

  const copyToClipboard = (team: SavedTeam): Promise<void> => copyImage(captureTeam(team))

  const downloadAsImage = (team: SavedTeam): Promise<void> =>
    downloadImage(captureTeam(team), team.name)

  return { copyToClipboard, downloadAsImage }
}
