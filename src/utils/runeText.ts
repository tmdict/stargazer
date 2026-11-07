/* Rune shapes for the What's New pictures: one solid shape per letter, so a
   picture reads the same in every site language. Each shape sits in a box 10
   units high and is inset 0.4 units, so the stroke that softens its corners
   stays inside the box. */

export type RuneGlyph = readonly [width: number, path: string]

const SHAPES = {
  up: [10, 'M5 0.4 L9.6 9.6 L0.4 9.6 Z'],
  down: [10, 'M0.4 0.4 L9.6 0.4 L5 9.6 Z'],
  right: [8.4, 'M0.4 0.4 L8 5 L0.4 9.6 Z'],
  left: [8.4, 'M8 0.4 L0.4 5 L8 9.6 Z'],
  diamond: [10, 'M5 0.4 L9.6 5 L5 9.6 L0.4 5 Z'],
  square: [9.2, 'M0.4 0.4 H8.8 V9.6 H0.4 Z'],
  circle: [9.6, 'M4.8 0.4 A4.6 4.6 0 1 1 4.8 9.6 A4.6 4.6 0 1 1 4.8 0.4 Z'],
  thorn: [8, 'M0.4 0.4 H2.6 V9.6 H0.4 Z M2.6 2 L7.6 5 L2.6 8 Z'],
  bowtie: [10, 'M0.4 0.4 L5 5 L0.4 9.6 Z M9.6 0.4 L5 5 L9.6 9.6 Z'],
  hourglass: [9.2, 'M0.4 0.4 H8.8 L4.6 5 Z M0.4 9.6 H8.8 L4.6 5 Z'],
  arrowUp: [9.2, 'M4.6 0.4 L8.8 5.2 H5.8 V9.6 H3.4 V5.2 H0.4 Z'],
  arrowDown: [9.2, 'M4.6 9.6 L8.8 4.8 H5.8 V0.4 H3.4 V4.8 H0.4 Z'],
  berkana: [7.6, 'M0.4 0.4 H2.4 V9.6 H0.4 Z M2.4 0.4 L7.2 2.7 L2.4 5 Z M2.4 5 L7.2 7.3 L2.4 9.6 Z'],
  chevronLeft: [8.4, 'M8 0.4 V3.3 L4.4 5 L8 6.7 V9.6 L0.4 5 Z'],
  chevronRight: [8.4, 'M0.4 0.4 V3.3 L4 5 L0.4 6.7 V9.6 L8 5 Z'],
  othala: [9.6, 'M4.8 0.4 L8.8 4.4 L6.2 7 L8.8 9.6 H6.4 L4.8 8 L3.2 9.6 H0.8 L3.4 7 L0.8 4.4 Z'],
  fork: [10, 'M0.4 0.4 H3 L5 3.4 L7 0.4 H9.6 L6.2 5.4 V9.6 H3.8 V5.4 Z'],
  cross: [10, 'M0.4 0.4 H3 L5 3.2 L7 0.4 H9.6 L6.4 5 L9.6 9.6 H7 L5 6.8 L3 9.6 H0.4 L3.6 5 Z'],
  halfCircle: [7.4, 'M0.4 0.4 H2.4 A4.6 4.6 0 0 1 2.4 9.6 H0.4 Z'],
  notchSquare: [9.2, 'M0.4 0.4 H3.2 L4.6 3 L6 0.4 H8.8 V9.6 H0.4 Z'],
  house: [9.2, 'M4.6 0.4 L8.8 3.8 V9.6 H0.4 V3.8 Z'],
  stave: [3, 'M0.4 0.4 H2.6 V9.6 H0.4 Z'],
  flag: [7.6, 'M0.4 0.4 H2.4 V9.6 H0.4 Z M2.4 0.4 L7.2 3 L2.4 5.6 Z'],
  bolt: [8, 'M2.6 0.4 H7.6 L4.8 4.2 H7.6 L1.2 9.6 L3.2 5.6 H0.4 Z'],
  splitDiamond: [10, 'M5 0.4 L9.2 4.3 H0.8 Z M0.8 5.7 H9.2 L5 9.6 Z'],
  ring: [
    9.6,
    'M4.8 0.4 A4.6 4.6 0 1 1 4.8 9.6 A4.6 4.6 0 1 1 4.8 0.4 Z M4.8 3.1 A1.9 1.9 0 1 0 4.8 6.9 A1.9 1.9 0 1 0 4.8 3.1 Z',
  ],
} as const satisfies Record<string, RuneGlyph>

const LETTER_SHAPES: Record<string, keyof typeof SHAPES> = {
  a: 'right',
  b: 'berkana',
  c: 'chevronLeft',
  d: 'bowtie',
  e: 'up',
  f: 'thorn',
  g: 'cross',
  h: 'square',
  i: 'stave',
  j: 'splitDiamond',
  k: 'chevronRight',
  l: 'left',
  m: 'hourglass',
  n: 'down',
  o: 'othala',
  p: 'notchSquare',
  q: 'ring',
  r: 'halfCircle',
  s: 'bolt',
  t: 'arrowUp',
  u: 'house',
  v: 'diamond',
  w: 'flag',
  x: 'circle',
  y: 'arrowDown',
  z: 'fork',
}

const LETTERS = Object.keys(LETTER_SHAPES)

const glyphOf = (letter: string): RuneGlyph => {
  const lower = letter.toLowerCase()
  const key = LETTER_SHAPES[lower] ? lower : LETTERS[letter.codePointAt(0)! % LETTERS.length]!
  return SHAPES[LETTER_SHAPES[key]!]
}

const LETTER = /\p{L}/u
const DIGIT = /\d/

/* A text as runs to keep and words to draw. A word is its shapes, with any
   punctuation inside it kept as text; a word holding a digit (1v1, R4) stays
   as it is, so modes, levels and counts still read. */
export type RuneRun = string | readonly (RuneGlyph | string)[]

export function runeRuns(text: string): RuneRun[] {
  return text
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) =>
      LETTER.test(part) && !DIGIT.test(part)
        ? [...part].map((char) => (LETTER.test(char) ? glyphOf(char) : char))
        : part,
    )
}
