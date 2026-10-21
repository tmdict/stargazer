import type { RgbaImage } from '@/lib/import/types'

// A blank, fully transparent picture for the import readers to draw on.
export const createImage = (width: number, height: number): RgbaImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
})
