// Grid preset interface and configurations
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

export const FULL_GRID_FLAT: GridPreset = {
  hex: [
    [44, 41],
    [45, 42, 39, 36, 32],
    [43, 40, 37, 33, 29, 25],
    [38, 34, 30, 26, 22, 18],
    [35, 31, 27, 23, 19, 15, 11],
    [28, 24, 20, 16, 12, 8],
    [21, 17, 13, 9, 6, 3],
    [14, 10, 7, 4, 1],
    [5, 2],
  ],
  qOffset: [1, -1, -2, -2, -3, -3, -3, -3, -2],
}
