// The odds table: what each of the eight sources makes at each shop level.

import type { OddsTable, ShopFacts } from './types'

export const SHOP_LEVELS = 5
export const SOURCES = 8

// Percents are written to two decimals, so a source's shares can miss 100 by a
// little without being wrong.
const SUM_TOLERANCE = 0.05

/** Returns the table unchanged, or throws naming the first thing wrong with it. */
export function checkOdds(table: OddsTable, facts: ShopFacts): OddsTable {
  const known = new Set(facts.goods.map((good) => good.name))
  if (table.levels.length !== SHOP_LEVELS) {
    throw new Error(`odds: ${table.levels.length} levels, expected ${SHOP_LEVELS}`)
  }
  table.levels.forEach((sources, level) => {
    const at = `odds: level ${level + 1}`
    if (sources.length !== SOURCES) throw new Error(`${at} has ${sources.length} sources`)
    sources.forEach((entries, source) => {
      // A source with nothing listed makes no product the calculator follows.
      if (!entries.length) return
      let total = 0
      for (const entry of entries) {
        if (!known.has(entry.good)) {
          throw new Error(`${at}, source ${source + 1}: unknown product ${entry.good}`)
        }
        if (!(entry.percent > 0)) {
          throw new Error(`${at}, source ${source + 1}: ${entry.good} has no share`)
        }
        total += entry.percent
      }
      if (Math.abs(total - 100) > SUM_TOLERANCE) {
        throw new Error(`${at}, source ${source + 1} adds up to ${total}`)
      }
    })
  })
  return table
}

/**
 * Names the first source where two tables list different products, or returns
 * null. A source one table leaves empty matches one that makes only a product
 * of no use to any goal.
 */
export function oddsMismatch(table: OddsTable, other: OddsTable, facts: ShopFacts): string | null {
  const idle = new Set(facts.goods.filter((good) => good.kind === 'exp').map((good) => good.name))
  const made = (entries: readonly { good: string }[]): string =>
    entries
      .map((entry) => entry.good)
      .filter((good) => !idle.has(good))
      .sort()
      .join()
  for (let level = 0; level < SHOP_LEVELS; level++) {
    for (let source = 0; source < SOURCES; source++) {
      if (made(table.levels[level]![source]!) !== made(other.levels[level]![source]!)) {
        return `level ${level + 1}, source ${source + 1}`
      }
    }
  }
  return null
}

/** The shop level (1 to 5) of a round. */
export function levelOfRound(round: number, levelRounds: readonly number[]): number {
  let level = 1
  levelRounds.forEach((first, index) => {
    if (round >= first) level = index + 1
  })
  return level
}
