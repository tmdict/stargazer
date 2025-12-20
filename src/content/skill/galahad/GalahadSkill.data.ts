import galahadImage from '@/assets/images/character/galahad.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

export const gridStyles = {
  main: {
    numericLabel: {
      1: 7,
      2: 8,
      3: 9,
      4: 1,
      5: 10,
      6: 2,
      7: 3,
      8: 11,
      10: 12,
      12: 4,
      13: 5,
      15: 13,
      16: 6,
      17: 14,
      19: 15,
      20: 16,
      23: 17,
    },
    highlight: [9],
    highlight2: [4, 6, 7, 12, 13, 16],
    highlight3: [1, 2, 3, 4, 5, 8, 10, 15, 17, 19, 20, 23],
    character: {
      galahad: 9,
    },
    imaginaryHexes: [
      {
        relativeToHex: 1,
        direction: 5 as const,
        label: 0,
      },
    ],
  },
}

export const images = {
  galahad: galahadImage,
}
