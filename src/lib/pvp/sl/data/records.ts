/* The records Who Would Win? shows beside its reasons: the wins and losses
 * the data file keeps on each row of the model. */

import { lineupKey } from './sides'
import type { SlModel } from './types'

export interface WinLoss {
  wins: number
  losses: number
}

export interface SeasonRecords {
  hero(id: number): WinLoss
  heroAgainst(id: number, kind: number): WinLoss
  artifact(id: number): WinLoss
  artifactOn(id: number, kind: number): WinLoss
  lineup(heroes: readonly number[]): WinLoss
}

export const gamesIn = (record: WinLoss): number => record.wins + record.losses

const tally = (row: readonly number[] | undefined): WinLoss => ({
  wins: row?.[1] ?? 0,
  losses: row?.[2] ?? 0,
})

export const seasonRecords = (m: SlModel): SeasonRecords => ({
  hero: (id) => tally(m.heroes[id]),
  heroAgainst: (id, kind) => tally(m.counters[`${id}:${kind}`]),
  artifact: (id) => tally(m.artifacts[id]),
  artifactOn: (id, kind) => tally(m.artifactsOnKind[`${id}:${kind}`]),
  lineup: (heroes) => tally(m.lineups[lineupKey(heroes)]),
})
