import { describe, expect, it } from 'vitest'

import { fit, sigmoid, type Row } from '@/lib/pvp/sl/model/fit'
import { MODELS } from '@/lib/pvp/sl/model/models'
import { REASONS, type Game, type Matchup, type Side } from '@/lib/pvp/sl/model/types'

const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

// A season of 400 games among 14 heroes, three kinds of team and four
// artifacts, where hero 1, artifact 2 and the upgrade gap help a side win.
const madeUpSeason = (): Game[] => {
  const next = random(7)
  const side = (): Side => {
    const heroes = new Set<number>()
    while (heroes.size < 5) heroes.add(1 + Math.floor(next() * 14))
    const kind = Math.floor(next() * 4)
    return {
      heroes: [...heroes],
      kind: kind === 3 ? null : kind,
      artifact: 1 + Math.floor(next() * 4),
    }
  }
  const strength = (s: Side) => (s.heroes.includes(1) ? 1 : 0) + (s.artifact === 2 ? 0.5 : 0)
  return Array.from({ length: 400 }, () => {
    const a = side()
    const b = side()
    const gap = Math.round((next() - 0.5) * 400)
    const p = sigmoid(strength(a) - strength(b) + gap / 200)
    return { a, b, gap, aWon: next() < p }
  })
}

const games = madeUpSeason()
const matchups: Matchup[] = games.slice(0, 40).map(({ a, b, gap }) => ({ a, b, gap }))

describe.each(MODELS.map((kind) => [kind.id, kind] as const))('the %s model', (_, kind) => {
  const model = kind.learn(games)

  it('gives the other team 100% minus the chance when the teams swap', () => {
    for (const m of matchups) {
      const swapped = sigmoid(model.edge({ a: m.b, b: m.a, gap: -m.gap }))
      expect(swapped).toBeCloseTo(1 - sigmoid(model.edge(m)), 12)
    }
  })

  it('counts no artifact, or one the season never saw, as a typical artifact', () => {
    const sides = games.flatMap((g) => [g.a, g.b])
    const effect = (side: Side) =>
      model.againstTypical(side, 0) - model.againstTypical({ ...side, artifact: null }, 0)
    expect(sides.reduce((sum, side) => sum + effect(side), 0) / sides.length).toBeCloseTo(0, 12)
    const unseen = { ...sides[0]!, artifact: 99 }
    expect(model.againstTypical(unseen, 0)).toBe(
      model.againstTypical({ ...unseen, artifact: null }, 0),
    )
  })

  it('splits the edge into reasons that add up to it', () => {
    for (const m of matchups) {
      const { parts } = model.explain(m)
      const sum = REASONS.reduce((total, reason) => total + parts[reason], 0)
      expect(sum).toBeCloseTo(model.edge(m), 12)
    }
  })
})

describe('fit', () => {
  it('finds the numbers no small change explains the games better than', () => {
    const next = random(11)
    const lambdas = [0.01, 1, 3, 5, 10, 20]
    const truth = [0.8, -0.5, 0.3, 1.2, -1, 0.1]
    const rows: Row[] = Array.from({ length: 300 }, () =>
      lambdas.flatMap((_, j): Row => (next() < 0.5 ? [[j, next() < 0.5 ? 1 : -1]] : [])),
    )
    const won = rows.map((row) => next() < sigmoid(row.reduce((z, [j, v]) => z + truth[j]! * v, 0)))
    const loss = (w: number[]) =>
      rows.reduce((sum, row, i) => {
        const p = sigmoid(row.reduce((z, [j, v]) => z + w[j]! * v, 0))
        return sum - Math.log(won[i] ? p : 1 - p)
      }, 0) + lambdas.reduce((sum, lambda, j) => sum + 0.5 * lambda * w[j]! ** 2, 0)

    const w = [...fit(rows, won, lambdas)]
    const best = loss(w)
    for (let j = 0; j < w.length; j++) {
      for (const step of [-1e-3, 1e-3]) {
        expect(loss(w.map((v, k) => (k === j ? v + step : v)))).toBeGreaterThan(best)
      }
    }
  })
})
