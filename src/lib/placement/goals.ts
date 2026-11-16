/* What a rule's goal asks, read alike by the placement cards, the Formation
 * engine rules page and the rules test. */

import type { Rule, RuleGoal } from '../types/rule'

// How a unit's own effect reads: given to heroes, or reaching as much as it can
// or its own other body. A goal about enemy heroes explains nothing on our side.
export function effectVerb(goal: RuleGoal): 'gives' | 'reaches' | undefined {
  if (goal === 'most' || goal === 'companion' || (typeof goal === 'object' && 'most' in goal))
    return 'reaches'
  if (typeof goal === 'object' && ('target' in goal || 'include' in goal || 'exactly' in goal))
    return 'gives'
  return undefined
}

// The goal's word, without the shares and filters that tune it. A most goal's
// word takes in what it counts, so a unit can hold one for each. A unit has at
// most one rule of each word for each team from each of its bodies.
export const goalWord = (goal: RuleGoal): string => {
  if (typeof goal === 'string') return goal
  if ('most' in goal) return `most-${goal.most}`
  return Object.keys(goal).find(
    (key) => !['fallback', 'others', 'sameFaction', 'nonHero', 'least'].includes(key),
  )!
}

// The name a rule's effect is worded by: the file the rule sits in, with
// -companion for the effect a unit's other body gives, then what a most goal
// counts, which words a unit's most goals apart.
export const effectName = (file: string, { from, goal }: Rule): string => {
  const counted = typeof goal === 'object' && 'most' in goal ? `-${goal.most}` : ''
  return `${file}${from === 'companion' ? '-companion' : ''}${counted}`
}

// Hard is for our team's rules on a target or an exactly goal, which the rules
// test holds every data file to.
export const isHardRule = ({ hard, team, goal }: Rule): boolean =>
  hard === true &&
  team === 'ally' &&
  typeof goal === 'object' &&
  ('target' in goal || 'exactly' in goal)

export function goalList(goal: RuleGoal): string | undefined {
  if (typeof goal !== 'object') return undefined
  if ('target' in goal) return goal.target
  if ('include' in goal) return goal.include
  return 'avoid' in goal ? goal.avoid : undefined
}
