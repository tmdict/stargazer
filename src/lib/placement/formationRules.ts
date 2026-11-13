/* The Formation engine rules page's model: each unit with placement rules,
 * each rule as its card shows it, and each list the rules read, its heroes
 * grouped by the entry that brought them in. The page words them in the site
 * language. */

import type { Rule, RuleTeam } from '../types/rule'
import { effectVerb, goalList, goalWord, isHardRule } from './goals'
import { expandList, type ListSource } from './lists'
import type { PlacementData, PlacementLookups } from './types'

export type RuleUnitKind = 'hero' | 'phantimal' | 'artifact' | 'charm'

// What a rule wants of its list: our team's first hero on it, with any other
// hero earning a share under first-others; every hero on it the effect
// reaches; or, for an enemy hero, not our first hero on it where its skill lands.
export type ListUse = 'first' | 'first-others' | 'every' | 'avoid'

export interface RuleCard {
  team: RuleTeam
  // The first line: the effect as a board card words it, or where the unit stands.
  effect: { verb: 'gives' | 'reaches'; key: string } | 'back' | null
  note: string
  list?: string
  use?: ListUse
  // Which of our units an enemy hero's skill lands on.
  targets?: string
  tile?: Rule['tile']
  distance?: number
  // A weight other than a skill's main effect's.
  weight?: 'more' | 'less'
  hard?: true
}

export interface RuleUnit {
  // The name of its data file (a charm's id), which is also its address on the page.
  id: string
  kind: RuleUnitKind
  cards: RuleCard[]
}

const kebab = (word: string): string => word.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

// The words of a rule's note and of an enemy rule's targets, by the file the
// rule sits in, with -companion for the effect a unit's other body gives.
const noteKey = (file: string, rule: Rule): string =>
  `placement-note-${file}${rule.from === 'companion' ? '-companion' : ''}-${rule.team}-${kebab(goalWord(rule.goal))}`

const targetsKey = (file: string): string => `placement-targets-${file}`

function ruleCard(file: string, rule: Rule, weights: PlacementData['weights']): RuleCard {
  const { goal, team } = rule
  const ally = team === 'ally'
  const card: RuleCard = { team, effect: null, note: noteKey(file, rule) }
  const verb = ally ? effectVerb(goal) : undefined
  if (goal === 'back') card.effect = 'back'
  else if (verb) {
    const effectFile = rule.from === 'companion' ? `${file}-companion` : file
    card.effect = { verb, key: `placement-${verb}-${effectFile}` }
  }
  const list = goalList(goal)
  if (list !== undefined && typeof goal === 'object') {
    card.list = list
    if ('target' in goal) card.use = goal.others ? 'first-others' : 'first'
    else if ('include' in goal) card.use = 'every'
    else {
      card.use = 'avoid'
      card.targets = targetsKey(file)
    }
  }
  if (ally && rule.tile) card.tile = rule.tile
  if (ally && rule.distance) card.distance = rule.distance
  const weight = rule.weight === undefined ? undefined : weights[rule.weight]
  if (ally && weight !== undefined && weight !== weights.aim) {
    card.weight = weight > weights.aim! ? 'more' : 'less'
  }
  if (isHardRule(rule)) card.hard = true
  return card
}

// The rules for our team first, as a unit's page shows them.
export const ruleCards = (
  kind: RuleUnitKind,
  id: string,
  rules: readonly Rule[],
  weights: PlacementData['weights'],
): RuleUnit => ({
  id,
  kind,
  cards: rules
    .map((rule) => ruleCard(id, rule, weights))
    .sort((a, b) => Number(a.team === 'enemy') - Number(b.team === 'enemy')),
})

// A run of a list's heroes brought in by one entry.
export interface ListGroup {
  source: ListSource
  heroes: number[]
}

export interface RuleList {
  ranked: ListGroup[]
  equal: ListGroup[]
  // The units whose rules name it, enemy for a rule for an enemy hero.
  readers: { unit: string; enemy: boolean }[]
  broughtInto: string[]
}

function grouped(heroes: number[], from: Map<number, ListSource>): ListGroup[] {
  const groups: ListGroup[] = []
  for (const hero of heroes) {
    const source = from.get(hero) ?? null
    const last = groups.at(-1)
    if (last && JSON.stringify(last.source) === JSON.stringify(source)) last.heroes.push(hero)
    else groups.push({ source, heroes: [hero] })
  }
  return groups
}

// A list that brings itself in has no heroes to show and is left out; the
// engine refuses it as well.
export function ruleLists(
  lists: PlacementData['lists'],
  units: readonly RuleUnit[],
  lookups: Pick<PlacementLookups, 'heroesMatching'>,
): Record<string, RuleList> {
  const result: Record<string, RuleList> = {}
  for (const name of Object.keys(lists)) {
    const heroes = expandList(lists, name, lookups)
    if (!heroes) continue
    result[name] = {
      ranked: grouped(heroes.ranked, heroes.from),
      equal: grouped(heroes.equal, heroes.from),
      readers: units.flatMap((unit) =>
        unit.cards
          .filter((card) => card.list === name)
          .map((card) => ({ unit: unit.id, enemy: card.team === 'enemy' })),
      ),
      broughtInto: Object.keys(lists).filter((other) =>
        lists[other]!.some(
          (entry) => typeof entry === 'object' && 'list' in entry && entry.list === name,
        ),
      ),
    }
  }
  return result
}
