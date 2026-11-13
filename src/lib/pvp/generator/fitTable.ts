/* Makes the fit table (pvp/fits.bin in the data pack) for npm run fits
 * (scripts/fits.ts), which loads this module through Vite. A row is one
 * lineup of the data file's rows of every map, placed on every preset map by
 * a fit store of its own (fit.ts), so the table holds what a visit's store
 * would come to hold.
 *
 * A row is made again only when what it was made from changes: the code and
 * the maps, which the command reads itself, and `rowInputs`. That rests on a
 * row reading no hero's or phantimal's data file but its own units', except
 * through an every entry of a list it reads. */

import { unitData } from '@/lib/characters/unitData'
import { MAPS } from '@/lib/maps'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { teamLeans } from '@/lib/placement/score'
import type { SlData, SlEveryMapTeam, SlFitSet, SlFitTable } from '../data/types'
import { slFit, teamOf } from './fit'
import { slBoards } from './setType'

export { decodeSlData, decodeSlFits, encodeSlFits } from '../data/codec'

// Every preset, one per column of a row.
const fitMaps = (): string[] => Object.keys(MAPS)

// A lineup's row of one set: its points on each map, null where it is never
// placed, and the maps, by column, whose placement breaks a hard rule.
export interface FitRow {
  points: (number | null)[]
  refused: number[]
}

// The lists and weights of the data file a row's placements read, by name.
export interface FitReads {
  lists: string[]
  weights: string[]
}

// `record`, with each name read from it added to `read`.
function noting<T extends object>(record: T, read: Set<string>): T {
  const note = (name: string | symbol): void => {
    if (typeof name === 'string') read.add(name)
  }
  return new Proxy(record, {
    get(target, name, receiver) {
      note(name)
      return Reflect.get(target, name, receiver)
    },
    has(target, name) {
      note(name)
      return Reflect.has(target, name)
    },
    getOwnPropertyDescriptor(target, name) {
      note(name)
      return Reflect.getOwnPropertyDescriptor(target, name)
    },
    ownKeys(target) {
      const names = Reflect.ownKeys(target)
      names.forEach(note)
      return names
    },
  })
}

export function fitRow(
  data: SlData,
  heroes: number[],
  plain: boolean,
): { row: FitRow; reads: FitReads } {
  const lists = new Set<string>()
  const weights = new Set<string>()
  const { placement } = data
  const fit = slFit(
    {
      ...data,
      placement: {
        ...placement,
        lists: noting(placement.lists, lists),
        weights: noting(placement.weights, weights),
      },
    },
    plain,
  )
  const maps = fitMaps()
  for (const board of slBoards(data, maps))
    if (fit.stands(board, heroes)) fit.measure(board, heroes)
  const placed = maps.map((map) => fit.placed(map, heroes))
  return {
    row: {
      points: placed.map((at) => at?.points ?? null),
      refused: placed.flatMap((at, column) => (at && !at.keeps ? [column] : [])),
    },
    reads: { lists: [...lists].sort(), weights: [...weights].sort() },
  }
}

/* What a lineup's row is made from, beside the code and the maps: its main
 * map, its units' data files, its heroes' leans, and each list and weight in
 * `reads` as the data file holds it, an every entry with the heroes it brings
 * in. Anything else the data file tunes the engine with counts whole. */
export function rowInputs(
  data: SlData,
  { heroes, home }: SlEveryMapTeam,
  plain: boolean,
  reads: FitReads,
): unknown {
  const { lists, leans, weights, ...rest } = data.placement
  const { phantimal } = teamOf(data, heroes, plain)
  return {
    home: data.maps[home]!.key,
    units: (phantimal === undefined ? heroes : [...heroes, phantimal]).map(unitData),
    leans: teamLeans(leans, heroes),
    lists: reads.lists.map((name) => [
      name,
      lists[name]?.map((entry) =>
        typeof entry === 'object' && 'every' in entry
          ? { ...entry, heroes: PLACEMENT_LOOKUPS.heroesMatching(entry.every) }
          : entry,
      ) ?? null,
    ]),
    weights: reads.weights.map((name) => [name, weights[name] ?? null]),
    rest,
  }
}

const setOf = (rows: readonly FitRow[]): SlFitSet => ({
  points: rows.map((row) => row.points),
  refused: rows.flatMap((row, index) =>
    row.refused.map((column): [number, number] => [index, column]),
  ),
})

// The table of each set's rows, in the order of the data file's lineups.
export const fitTable = (
  stamp: string,
  seasonal: readonly FitRow[],
  plain: readonly FitRow[],
): SlFitTable => ({ stamp, maps: fitMaps(), seasonal: setOf(seasonal), plain: setOf(plain) })
