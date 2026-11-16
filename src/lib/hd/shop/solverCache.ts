// What a shop visit keeps from one press to the next.
//
// The tables and the search answer for a goal's model: its useful kinds, their
// prices and results, and what each source makes of them. Neither depends on
// the cards entered, the badges held or how many targets are still needed, so
// a later press whose model is the same number for number picks them up and
// fills only the rows it lacks. Two wanted items with the same model share them
// within one press as well.

import type { GoalModel } from './moves'
import { createSearch, type Search } from './search'
import { createTables, type Tables } from './tables'

export interface Solver {
  tables: Tables
  search: Search
}

export interface SolverCache {
  /** The solver for a model, its tables filled for `model.need` targets and `badges`. */
  solver: (model: GoalModel, badges: number) => Solver
  /** An estimate of the size in memory of everything kept. */
  readonly bytes: number
}

export interface SolverCacheOptions {
  /** How close to the true chance a searched answer has to be. */
  tolerance?: number
  maxSolvers?: number
  maxBytes?: number
}

/** Everything of a model the tables and the search read. */
const modelKey = (model: GoalModel): string =>
  JSON.stringify([
    model.reroll,
    model.kinds.map((kind) => [kind.good.price, kind.certain, kind.outcomes]),
    model.sources,
  ])

export function createSolverCache({
  tolerance = 1e-6,
  maxSolvers = 32,
  maxBytes = 100e6,
}: SolverCacheOptions = {}): SolverCache {
  // In order of last use, the least recent first.
  const solvers = new Map<string, Solver>()

  const bytes = () => {
    let sum = 0
    for (const { tables, search } of solvers.values()) sum += tables.bytes + search.bytes
    return sum
  }

  return {
    solver(model, badges) {
      const key = modelKey(model)
      let solver = solvers.get(key)
      if (solver) {
        solvers.delete(key)
      } else {
        const tables = createTables(model)
        solver = { tables, search: createSearch(model, tables, tolerance) }
      }
      solvers.set(key, solver)
      solver.tables.cover(model.need, badges)
      // A solver dropped here still serves the press that holds it.
      for (const oldest of solvers.keys()) {
        if (solvers.size <= maxSolvers && bytes() <= maxBytes) break
        solvers.delete(oldest)
      }
      return solver
    },
    get bytes() {
      return bytes()
    },
  }
}
