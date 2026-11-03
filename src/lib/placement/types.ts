import type { SkillLookups } from '../skills/skill'
import type { Rule } from '../types/rule'

// A list a rule names: heroes by id, best first, where an entry can bring in
// another list's heroes at that point.
export type ListEntry = number | { list: string }

// How two heroes, or one hero and the rest, stand, among the five heroes alone.
// Front and back go by tile number, the higher number in front, as frontmost
// and rearmost targeting goes.
type Relation =
  | 'frontmost'
  | 'twoFrontmost'
  | 'rearmost'
  | 'twoRearmost'
  | 'inFrontOf'
  | 'nextTo'
  // The second hero on the tile directly behind the first.
  | 'behind'
  // The second hero the nearest hero on the first's diagonal row.
  | 'nearestOnRow'
  | 'mutualNearestOnRow'

// A rule found in recorded formations: an always rule must hold, a usually rule
// is a light preference.
export interface FormationRule {
  heroes: number[]
  relation: Relation
  holds: 'always' | 'usually'
}

// What the engine is tuned with. Weights are named by the rules that use them,
// beside buff (a hero on a buff tile), lean (a hero standing where it leans,
// and a usually rule holding) and margin (how far below the best a placement
// still counts as equally good).
export interface PlacementData {
  lists: Record<string, ListEntry[]>
  leans: { front: number[]; back: number[] }
  formationRules: FormationRule[]
  weights: Record<string, number>
  // For each map, the share of the Supreme League board sides recorded there
  // that each enemy hero with a rule against us is on, by hero id.
  pickRates: Record<string, Record<string, number>>
}

// Data-store facts the engine needs beyond the skills' own.
export interface PlacementLookups extends SkillLookups {
  // The rules in a hero's or phantimal's data file, by unit id.
  rulesOf: (unitId: number) => readonly Rule[]
  // The charm a hero holds this season.
  charmOf: (heroId: number) => { id: string; rules: readonly Rule[] } | undefined
  artifactOf: (artifactId: number) => { name: string; rules: readonly Rule[] } | undefined
  // The name of a hero's or phantimal's data file, by unit id.
  nameOf: (unitId: number) => string | undefined
}

// The team to place: five hero ids, and the phantimal's unit id.
export interface PlacementTeam {
  heroes: number[]
  phantimal?: number
  artifact?: number
}
