/* What a rule's goal asks, read alike by the placement cards, the Formation
 * engine rules page and the rules test. */

import type { RuleGoal } from '../types/rule'

// How a unit's own effect reads: given to heroes, or reaching as much as it can
// or its own other body. A goal about enemy heroes explains nothing on our side.
export function effectVerb(goal: RuleGoal): 'gives' | 'reaches' | undefined {
  if (goal === 'most' || goal === 'companion' || (typeof goal === 'object' && 'most' in goal))
    return 'reaches'
  if (typeof goal === 'object' && ('target' in goal || 'include' in goal || 'exactly' in goal))
    return 'gives'
  return undefined
}

// The goal's word, without the shares and filters that tune it. A unit has at
// most one rule of each word for each team from each of its bodies.
export const goalWord = (goal: RuleGoal): string =>
  typeof goal === 'string'
    ? goal
    : Object.keys(goal).find(
        (key) => !['fallback', 'others', 'sameFaction', 'nonHero', 'least'].includes(key),
      )!

export function goalList(goal: RuleGoal): string | undefined {
  if (typeof goal !== 'object') return undefined
  if ('target' in goal) return goal.target
  if ('include' in goal) return goal.include
  return 'avoid' in goal ? goal.avoid : undefined
}
