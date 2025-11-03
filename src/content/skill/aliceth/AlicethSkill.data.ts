import alicethImage from '@/assets/images/character/aliceth.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

export const gridStyles = {
  main: {
    numericLabel: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      10: 10,
      12: 12,
      13: 13,
      16: 16,
    },
    highlight: [10],
    highlight2: [8],
    character: {
      aliceth: 9,
    },
  },
  rowScan: {
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
    imaginaryHexes: [
      {
        relativeToHex: 1,
        direction: 'west' as const,
        label: 18,
      },
    ],
  },
}

export const images = {
  aliceth: alicethImage,
}
