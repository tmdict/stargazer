import evieImage from '@/assets/images/character/evie.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

export const gridStyles = {
  allyTarget: {
    numericLabel: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9,
      10: 10,
      12: 12,
      13: 13,
      30: 30,
      33: 33,
      34: 34,
      36: 36,
      37: 37,
      38: 38,
      39: 39,
      40: 40,
      41: 41,
      42: 42,
      43: 43,
      44: 44,
      45: 45,
    },
    highlight: [1],
    highlight2: [2, 3, 7],
    character: {
      evie: 16,
    },
  },
  enemyTarget1: {
    numericLabel: {},
    highlight: [37],
    highlight2: [30, 33, 34, 39, 40, 42],
    character: {
      evie: 9,
    },
  },
  enemyTarget2: {
    numericLabel: {},
    highlight: [41],
    highlight2: [36, 39, 44],
    character: {
      evie: 3,
    },
  },
}

export const images = {
  evie: evieImage,
}
