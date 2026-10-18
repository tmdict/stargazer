// Grid preset interface and configurations
import { Hex } from '../hex'

export interface GridPreset {
  hex: number[][]
  qOffset: number[]
}

export const FULL_GRID: GridPreset = {
  hex: [
    [43, 45],
    [35, 38, 40, 42, 44],
    [28, 31, 34, 37, 39, 41],
    [21, 24, 27, 30, 33, 36],
    [14, 17, 20, 23, 26, 29, 32],
    [10, 13, 16, 19, 22, 25],
    [5, 7, 9, 12, 15, 18],
    [2, 4, 6, 8, 11],
    [1, 3],
  ],
  qOffset: [2, 0, -1, -2, -3, -3, -4, -4, -3],
}

// A preset's hexes: rows centred on the middle row, q from each row's offset.
export function presetHexes(preset: GridPreset): Hex[] {
  const centerRowIndex = Math.floor(preset.hex.length / 2)
  const hexes: Hex[] = []

  for (let rowIndex = 0; rowIndex < preset.hex.length; rowIndex++) {
    const row = preset.hex[rowIndex]
    const offset = preset.qOffset[rowIndex]

    if (!row || offset === undefined) {
      console.warn('grid: Skipping invalid row/offset in presetHexes', {
        rowIndex,
        rowExists: !!row,
        offset,
      })
      continue
    }

    const r = rowIndex - centerRowIndex

    for (let i = 0; i < row.length; i++) {
      const q = offset + i
      const s = -q - r
      const id = row[i]
      hexes.push(new Hex(q, r, s, id))
    }
  }

  return hexes
}
