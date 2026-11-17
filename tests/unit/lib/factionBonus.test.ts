import { describe, expect, it } from 'vitest'

import { teamFactionBonus } from '@/lib/factionBonus'

const team = (parts: Record<string, number>): string[] =>
  Object.entries(parts).flatMap(([faction, count]) => Array<string>(count).fill(faction))

describe('teamFactionBonus', () => {
  it.each([
    [{ wilder: 3 }, 10],
    [{ wilder: 3, mauler: 2 }, 14],
    [{ wilder: 4, mauler: 1 }, 18],
    [{ wilder: 5 }, 22],
    [{ wilder: 2, mauler: 2, celestial: 1 }, 15],
    [{ wilder: 3, hypogean: 1, celestial: 1 }, 24],
    [{ celestial: 1, hypogean: 1 }, 2],
    [{ wilder: 2, mauler: 2 }, 0],
    [{}, 0],
  ])('%j is +%i%%', (parts, percent) => {
    expect(teamFactionBonus(team(parts)).percent).toBe(percent)
  })

  it('lists the heroes by faction, the largest group first', () => {
    expect(teamFactionBonus(team({ mauler: 2, wilder: 3 })).counts).toEqual([
      { faction: 'wilder', count: 3 },
      { faction: 'mauler', count: 2 },
    ])
  })

  // The slow way: every stand-in tries every faction, and the best step any of
  // those teams reaches by plain counting is the team's.
  it('agrees with trying every faction for every stand-in, on every team of up to five', () => {
    const plain = ['a', 'b', 'c']
    const kinds = [...plain, 'celestial', 'hypogean']
    const stepOf = (counts: number[]): number => {
      const [first = 0, second = 0] = [...counts].sort((x, y) => y - x)
      if (first >= 5) return 22
      if (first >= 4) return 18
      if (first >= 3 && second >= 2) return 14
      return first >= 3 ? 10 : 0
    }
    const slow = (heroes: readonly string[]): number => {
      const wild = heroes.filter((kind) => !plain.includes(kind)).length
      const base = plain.map((kind) => heroes.filter((one) => one === kind).length)
      let best = 0
      const assign = (left: number, counts: number[]): void => {
        if (left === 0) {
          best = Math.max(best, stepOf(counts))
          return
        }
        counts.forEach((_, i) =>
          assign(
            left - 1,
            counts.map((count, j) => (j === i ? count + 1 : count)),
          ),
        )
      }
      // A fourth faction, for stand-ins that take one no hero of the team has.
      assign(wild, [...base, 0])
      return best + wild
    }

    const teams: string[][] = [[]]
    for (let size = 1; size <= 5; size++) {
      const longest = teams.filter((one) => one.length === size - 1)
      for (const one of longest) for (const kind of kinds) teams.push([...one, kind])
    }
    const wrong = teams
      .filter((heroes) => teamFactionBonus(heroes).percent !== slow(heroes))
      .map((heroes) => heroes.join(' '))
    expect(wrong).toEqual([])
  })
})
