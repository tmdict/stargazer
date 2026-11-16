// The odds table: what each of the eight sources makes at each shop level.

import type { OddsTable, ShopFacts, SourceEntry } from './types'

export const SHOP_LEVELS = 5
export const SOURCES = 8

// Percents are written to two decimals, so a source's shares can miss 100 by a
// little without being wrong.
const SUM_TOLERANCE = 0.05

/**
 * Returns the table ready for use, or throws naming the first thing wrong with
 * it. A source may list nothing, which stands for one that only ever shows the
 * product no goal uses. The table returned lists that product for it: the card
 * is on show all the same, and reading the shop has to match it to a source.
 */
export function checkOdds(table: OddsTable, facts: ShopFacts): OddsTable {
  const known = new Set(facts.goods.map((good) => good.name))
  const idle = facts.goods.find((good) => good.kind === 'exp')
  if (table.levels.length !== SHOP_LEVELS) {
    throw new Error(`odds: ${table.levels.length} levels, expected ${SHOP_LEVELS}`)
  }
  const levels = table.levels.map((sources, level) => {
    const at = `odds: level ${level + 1}`
    if (sources.length !== SOURCES) throw new Error(`${at} has ${sources.length} sources`)
    return sources.map((entries, source): SourceEntry[] => {
      if (!entries.length) {
        if (!idle) throw new Error(`${at}, source ${source + 1} lists nothing`)
        return [{ good: idle.name, percent: 100 }]
      }
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
      return entries
    })
  })
  return { ...table, levels }
}

/**
 * Names the first source where two checked tables list different products, or
 * returns null. A shop that can come up under one table can then come up under
 * the other.
 */
export function oddsMismatch(table: OddsTable, other: OddsTable): string | null {
  const made = (entries: readonly SourceEntry[]): string =>
    entries
      .map((entry) => entry.good)
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
