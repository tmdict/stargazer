import niruImage from '@/assets/images/character/niru.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

export const gridStyles = {
  main: {
    numericLabel: {
      1: 8,
      2: 7,
      3: 10,
      4: 1,
      5: 9,
      6: 3,
      7: 2,
      8: 12,
      10: 11,
      12: 5,
      13: 4,
      15: 14,
      16: 6,
      17: 13,
      19: 16,
      20: 15,
      23: 17,
    },
    highlight: [9],
    highlight2: [4, 6, 7, 12, 13, 16],
    highlight3: [1, 2, 3, 5, 8, 10, 15, 17, 19, 20, 23],
    character: {
      niru: 9,
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
  niru: niruImage,
}
