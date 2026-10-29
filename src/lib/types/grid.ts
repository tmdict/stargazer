// Grid preset interface and configurations
import grid from '@/data/grid.json'
import { Hex } from '../hex'

export interface GridPreset {
  hex: number[][]
  qOffset: number[]
}

// The board every map shares, as rows of tile numbers from one back edge to
// the other with each row's shift. The layout is in src/data/grid.json, which
// the external report generator also reads.
export const FULL_GRID: GridPreset = grid

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
