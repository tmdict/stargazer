import alicethImage from '@/assets/images/character/aliceth.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

export const gridStyles = {
  rowScan1: {
    numericLabel: {
      1: 17,
      2: 16,
      3: 15,
      4: 8,
      5: 14,
      6: 7,
      7: 6,
      8: 2,
      10: 1,
      12: 5,
      13: 4,
      15: 13,
      16: 3,
      17: 12,
      19: 11,
      20: 10,
      23: 9,
    },
    highlight: [8, 9, 10],
    highlight2: [4, 6, 7, 12, 13, 16],
    highlight3: [1, 2, 3, 5, 8, 10, 15, 17, 19, 20, 23],
    character: {
      aliceth: 9,
    },
  },
  rowScan2: {
    numericLabel: {
      9: 1,
      10: 2,
      15: 3,
      12: 4,
      11: 5,
      6: 6,
      3: 7,
      22: 8,
      19: 9,
      18: 10,
      16: 11,
      4: 12,
      1: 13,
    },
    highlight: [8, 9, 10],
    highlight2: [3, 6, 11, 12, 15],
    highlight3: [1, 4, 16, 18, 19, 22],
    character: {
      aliceth: 8,
    },
  },
}

export const images = {
  aliceth: alicethImage,
}
