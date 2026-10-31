export const gridStyles = {
  main: {
    numericLabel: {
      1: 8,
      2: 9,
      3: 10,
      4: 1,
      5: 11,
      6: 2,
      7: 3,
      8: 12,
      10: 13,
      12: 4,
      13: 5,
      15: 14,
      16: 6,
      17: 15,
      19: 16,
      20: 17,
      23: 18,
    },
    highlight2: [4, 6, 7, 12, 13, 16],
    highlight3: [1, 2, 3, 5, 8, 10, 15, 17, 19, 20, 23],
    character: {
      cassadee: 9,
    },
    imaginaryHexes: [
      {
        relativeToHex: 1,
        direction: 5 as const,
        label: 7,
      },
    ],
  },
}
