import satranaImage from '@/assets/images/character/satrana.png?format=webp&quality=80&w=100&h=135&fit=cover&position=bottom'

// Labels are the hex distance from Satrana: 1 for the adjacent ring, 2 for the
// circle around it.
export const gridStyles = {
  main: {
    numericLabel: {
      1: 1,
      2: 2,
      3: 1,
      4: 1,
      7: 2,
      8: 1,
      9: 1,
      11: 2,
      12: 1,
      13: 2,
      15: 2,
      16: 2,
      19: 2,
    },
    highlight: [1, 13],
    highlight2: [5],
    character: {
      satrana: 6,
    },
  },
}

export const images = {
  satrana: satranaImage,
}
