// How the shop calculator and the shop probability guide write a number.

/** A chance as a percent: two decimals under 1%, one above, and none once it rounds to 100%. */
export const percentText = (chance: number): string => {
  const value = chance * 100
  if (value >= 99.95) return '100%'
  // From 0.995 a value rounds to 1 at two decimals.
  return `${value.toFixed(value < 0.995 ? 2 : 1)}%`
}

/** A chance as the calculator writes one, or a dash for none. */
export const percent = (chance: number): string => (chance > 0 ? percentText(chance) : '–')

/** A worked-out number to at most one decimal. */
export const amount = (value: number): string => String(Number(value.toFixed(1)))
