import { computed, onUnmounted, ref } from 'vue'

export type StitchDirection = 'vertical' | 'horizontal'
export type StitchFit = 'scale' | 'original'

export interface StitchSettings {
  direction: StitchDirection
  gap: number
  background: string
  fit: StitchFit
}

export interface StitchImage {
  id: string
  name: string
  src: string
  bitmap: ImageBitmap
  width: number
  height: number
}

// Browsers cap canvas dimensions (~16k px on most engines) and total area;
// past this a canvas silently renders blank, so we refuse instead.
const MAX_CANVAS_EDGE = 16384

/** Ordered image list + reactive canvas stitching for the /teams page. */
export function useImageStitch() {
  const images = ref<StitchImage[]>([])

  const settings = ref<StitchSettings>({
    direction: 'vertical',
    gap: 0,
    background: 'transparent',
    fit: 'scale',
  })

  let nextId = 0

  const decodeFile = async (file: File): Promise<StitchImage | null> => {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        id: `img-${nextId++}`,
        name: file.name,
        src: URL.createObjectURL(file),
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
      }
    } catch {
      return null
    }
  }

  // Append files in their given order, ignoring non-images and undecodable ones.
  const addFiles = async (files: File[]): Promise<number> => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    const decoded = (await Promise.all(imageFiles.map(decodeFile))).filter(
      (img): img is StitchImage => img !== null,
    )
    images.value = [...images.value, ...decoded]
    return decoded.length
  }

  const release = (img: StitchImage) => {
    URL.revokeObjectURL(img.src)
    img.bitmap.close()
  }

  const removeImage = (id: string) => {
    const img = images.value.find((i) => i.id === id)
    if (img) release(img)
    images.value = images.value.filter((i) => i.id !== id)
  }

  const reorder = (from: number, to: number) => {
    const list = [...images.value]
    const [moved] = list.splice(from, 1)
    if (!moved) return
    list.splice(to, 0, moved)
    images.value = list
  }

  const clear = () => {
    images.value.forEach(release)
    images.value = []
  }

  // Cross-axis target: the largest extent so nothing is upscaled past the
  // sharpest source (in 'scale' mode every image matches this; in 'original'
  // mode it's the canvas size and smaller images are centered/letterboxed).
  const crossTarget = (list: StitchImage[], direction: StitchDirection): number =>
    direction === 'vertical'
      ? Math.max(...list.map((i) => i.width))
      : Math.max(...list.map((i) => i.height))

  // Each image's drawn size given the cross-axis target and fit mode.
  const drawnSize = (
    img: StitchImage,
    direction: StitchDirection,
    fit: StitchFit,
    cross: number,
  ): { w: number; h: number } => {
    if (fit === 'original') return { w: img.width, h: img.height }
    return direction === 'vertical'
      ? { w: cross, h: Math.round((img.height * cross) / img.width) }
      : { w: Math.round((img.width * cross) / img.height), h: cross }
  }

  // Full-resolution stitched output, or null when there are no images.
  const dimensions = computed<{ width: number; height: number } | null>(() => {
    const list = images.value
    if (list.length === 0) return null

    const { direction, gap, fit } = settings.value
    const cross = crossTarget(list, direction)
    const sizes = list.map((img) => drawnSize(img, direction, fit, cross))
    const totalGap = gap * (list.length - 1)

    if (direction === 'vertical') {
      return {
        width: fit === 'original' ? Math.max(...sizes.map((s) => s.w)) : cross,
        height: sizes.reduce((sum, s) => sum + s.h, 0) + totalGap,
      }
    }
    return {
      width: sizes.reduce((sum, s) => sum + s.w, 0) + totalGap,
      height: fit === 'original' ? Math.max(...sizes.map((s) => s.h)) : cross,
    }
  })

  const exceedsCanvasLimit = computed(
    () =>
      dimensions.value !== null &&
      (dimensions.value.width > MAX_CANVAS_EDGE || dimensions.value.height > MAX_CANVAS_EDGE),
  )

  // Render the current list+settings to a fresh canvas. Returns null when empty
  // or when the result would exceed the canvas limit.
  const render = (): HTMLCanvasElement | null => {
    const dim = dimensions.value
    if (!dim || exceedsCanvasLimit.value) return null

    const canvas = document.createElement('canvas')
    canvas.width = dim.width
    canvas.height = dim.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const { direction, gap, background, fit } = settings.value
    if (background !== 'transparent') {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const cross = crossTarget(images.value, direction)
    let offset = 0
    for (const img of images.value) {
      const { w, h } = drawnSize(img, direction, fit, cross)
      // Center on the cross-axis (only visible when 'original' leaves slack).
      const x = direction === 'vertical' ? Math.round((canvas.width - w) / 2) : offset
      const y = direction === 'vertical' ? offset : Math.round((canvas.height - h) / 2)
      ctx.drawImage(img.bitmap, x, y, w, h)
      offset += (direction === 'vertical' ? h : w) + gap
    }

    return canvas
  }

  onUnmounted(clear)

  return {
    images,
    settings,
    dimensions,
    exceedsCanvasLimit,
    addFiles,
    removeImage,
    reorder,
    clear,
    render,
  }
}
