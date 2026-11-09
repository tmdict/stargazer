import type { SkillLookups } from '../skills/skill'
import type { Rule } from '../types/rule'

// The heroes an every entry names: those whose hero file matches each field
// given.
export interface HeroFilter {
  class?: string[]
  range?: 'melee' | 'ranged'
  damage?: 'physical' | 'magic'
}

// A list a rule names: heroes by id, best first, where an entry can bring in
// another list's heroes at that point. Below a line order stops mattering, and
// an every entry, which stands only there, adds every hero its filter matches.
export type ListEntry = number | { list: string } | { line: true } | { every: HeroFilter }

// What the engine is tuned with. Weights are named by the rules that use them,
// beside buff (a hero on a buff tile), lean (a hero standing where it leans)
// and margin (how far below the best a placement still counts as equally good).
export interface PlacementData {
  lists: Record<string, ListEntry[]>
  leans: { front: number[]; back: number[] }
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
  rangeOf: (unitId: number) => number | undefined
  heroesMatching: (filter: HeroFilter) => number[]
}

// The team to place: five hero ids, and the phantimal's unit id.
export interface PlacementTeam {
  heroes: number[]
  phantimal?: number
  artifact?: number
}
