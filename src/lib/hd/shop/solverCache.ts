// What a shop visit keeps from one press to the next.
//
// The tables and the search answer for a goal's model: its useful kinds, their
// prices and results, and what each source makes of them. Neither depends on
// the cards entered, the badges held or how many targets are still needed, so
// a later press whose model is the same number for number picks them up and
// fills only the rows it lacks. Two wanted items with the same model share them
// within one press as well. The cost tables of fewest badges are made the first
// time a model is asked for them.

import { createCosts, type Costs } from './costs'
import type { GoalModel } from './moves'
import { createSearch, type Search } from './search'
import { createTables, type Tables } from './tables'

export interface Solver {
  tables: Tables
  search: Search
  costs?: Costs
}

export interface SolverCache {
  /** The solver for a model, its tables filled for `model.need` targets and `badges`. */
  solver: (model: GoalModel, badges: number) => Solver
  /** The cost tables for a model, filled for `model.need` targets. */
  costs: (model: GoalModel) => Costs
}

/** How close to the true chance a searched answer has to be. */
const TOLERANCE = 1e-6

/** The most a visit keeps: so many solvers, and an estimate of their size in memory. */
const MAX_SOLVERS = 32
const MAX_BYTES = 100e6

/** Everything of a model the tables and the search read. */
const modelKey = (model: GoalModel): string =>
  JSON.stringify([
    model.reroll,
    model.kinds.map((kind) => [kind.good.price, kind.certain, kind.outcomes]),
    model.sources,
  ])

export function createSolverCache(): SolverCache {
  // In order of last use, the least recent first.
  const solvers = new Map<string, Solver>()

  const bytes = () => {
    let sum = 0
    for (const { tables, search, costs } of solvers.values()) {
      sum += tables.bytes + search.bytes + (costs?.bytes ?? 0)
    }
    return sum
  }

  const recent = (model: GoalModel): Solver => {
    const key = modelKey(model)
    let solver = solvers.get(key)
    if (solver) {
      solvers.delete(key)
    } else {
      const tables = createTables(model)
      solver = { tables, search: createSearch(model, tables, TOLERANCE) }
    }
    solvers.set(key, solver)
    return solver
  }

  // A solver dropped here still serves the press that holds it. The one just
  // used stays whatever its size: the same press asks for it again, and would
  // otherwise build its tables twice.
  const trim = () => {
    for (const oldest of solvers.keys()) {
      if (solvers.size <= 1 || (solvers.size <= MAX_SOLVERS && bytes() <= MAX_BYTES)) break
      solvers.delete(oldest)
    }
  }

  return {
    solver(model, badges) {
      const solver = recent(model)
      solver.tables.cover(model.need, badges)
      trim()
      return solver
    },
    costs(model) {
      const solver = recent(model)
      const costs = (solver.costs ??= createCosts(model, solver.tables.layout))
      costs.cover(model.need)
      trim()
      return costs
    },
  }
}
