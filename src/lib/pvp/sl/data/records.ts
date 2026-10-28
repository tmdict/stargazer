/* The records Who Would Win? shows beside its reasons, counted from this
 * season's decided games. Each side of a game counts on its own, so a hero
 * on both teams of a game has a win and a loss from it. */

import { lineupKey, type Game, type Side } from './games.ts'

export interface WinLoss {
  wins: number
  losses: number
}

interface SeasonRecords {
  hero(id: number): WinLoss
  heroAgainst(id: number, kind: number): WinLoss
  artifact(id: number): WinLoss
  artifactOn(id: number, kind: number): WinLoss
  lineup(heroes: readonly number[]): WinLoss
  // The first lineup's wins and losses against the second.
  headToHead(heroes: readonly number[], against: readonly number[]): WinLoss
}

export const gamesIn = (record: WinLoss): number => record.wins + record.losses

export function seasonRecords(games: readonly Game[]): SeasonRecords {
  const tallies = new Map<string, WinLoss>()
  const add = (key: string, won: boolean): void => {
    const tally = tallies.get(key) ?? { wins: 0, losses: 0 }
    if (won) tally.wins++
    else tally.losses++
    tallies.set(key, tally)
  }
  const count = (side: Side, other: Side, won: boolean): void => {
    for (const h of side.heroes) {
      add(`h${h}`, won)
      if (other.kind !== null) add(`c${h}:${other.kind}`, won)
    }
    if (side.artifact !== null) {
      add(`a${side.artifact}`, won)
      if (side.kind !== null) add(`k${side.artifact}:${side.kind}`, won)
    }
    add(`l${lineupKey(side.heroes)}`, won)
    add(`m${lineupKey(side.heroes)}|${lineupKey(other.heroes)}`, won)
  }
  for (const g of games) {
    count(g.a, g.b, g.aWon)
    count(g.b, g.a, !g.aWon)
  }
  const get = (key: string): WinLoss => ({ wins: 0, losses: 0, ...tallies.get(key) })

  return {
    hero: (id) => get(`h${id}`),
    heroAgainst: (id, kind) => get(`c${id}:${kind}`),
    artifact: (id) => get(`a${id}`),
    artifactOn: (id, kind) => get(`k${id}:${kind}`),
    lineup: (heroes) => get(`l${lineupKey(heroes)}`),
    headToHead: (heroes, against) => get(`m${lineupKey(heroes)}|${lineupKey(against)}`),
  }
}
