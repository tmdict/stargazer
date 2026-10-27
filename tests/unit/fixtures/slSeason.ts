/**
 * Made-up Supreme League seasons for the generator's tests: five maps, two
 * groups, and one evidence rule every team with a decided game passes.
 */

import type { SlData, SlGame, SlTeam } from '@/lib/pvp/sl/data/types'

export type MadeUpTeam = Pick<SlTeam, 'map' | 'family' | 'heroes' | 'artifacts'>

export const seededRandom = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

export function madeUpData(teams: MadeUpTeam[], games: SlGame[]): SlData {
  const perMap = () => Array.from({ length: 5 }, (): [number, number, number] => [1, 1, 0])
  return {
    season: 8,
    exportedAt: '2026-10-01',
    sample: { matches: games.length / 2, games: games.length / 2, players: 1 },
    maps: Array.from({ length: 5 }, (_, i) => ({
      key: `map-${i}`,
      grid: { ally: [], enemy: [], blocked: [], breakable: [] },
    })),
    prior: 2,
    alpha: 0.5,
    evidence: [{ groupGames: 0, players: 0, games: 1, oneOffs: true }],
    flex: { heroes: 2, options: 2 },
    prices: { paragon: { f: [0, 10, 20, 30, 40] }, refinement: [0, 5, 10, 15, 20] },
    order: [...new Set(teams.flatMap((t) => t.heroes))].sort((a, b) => a - b),
    games,
    teams: teams.map((t, i) => {
      const own = games.flatMap(([team], k) => (team === i ? [k] : []))
      return {
        ...t,
        rank: i,
        players: 1,
        games: own,
        placements: [
          { games: own, use: 1, players: 1, setups: 1, agree: 1, order: 0, c: [], s: [] },
        ],
      }
    }),
    families: [0, 1].map(() => ({ name: {}, core: [], swaps: [], perMap: perMap() })),
  }
}
