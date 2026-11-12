// Placement rule data integrity: every rule in the hero, artifact, phantimal
// and charm files keeps the rule contract's fields and words, and sits on a
// unit whose skill says where its effect lands, names the tile for an effect
// Stargazer does not draw, as every charm's is, or asks only where its unit
// stands. The placement engine reads these files with no checks of its own.
import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import { ruleUnit } from '@/lib/placement/formationRules'
import { effectVerb } from '@/lib/placement/goals'
import { artifactTargetArrows } from '@/lib/skills/artifact'
import { hasSkill } from '@/lib/skills/skill'
import type { Rule } from '@/lib/types/rule'
import { Team } from '@/lib/types/team'
import {
  loadAppLocales,
  loadArtifacts,
  loadCharacters,
  loadCharms,
  loadPhantimals,
} from '@/utils/dataLoader'
import { placeOnTile } from './fixtures/skills'

const FIELDS = new Set(['team', 'goal', 'tile', 'distance', 'from', 'weight', 'note'])
const LIST_GOALS = new Set(['target', 'avoid', 'include'])
const COUNT_GOALS = new Set(['atMost', 'exactly'])
const MOST_KINDS = new Set(['walls', 'allies'])
const TILE_WORDS = new Set(['behind', 'front', 'around', 'row', 'mirror-around'])

function goalProblem(goal: unknown): string | null {
  if (goal === 'most' || goal === 'none' || goal === 'companion' || goal === 'back') return null
  if (typeof goal !== 'object' || goal === null) return `the goal ${JSON.stringify(goal)}`
  const { sameFaction, nonHero, fallback, others, ...words } = goal as Record<string, unknown>
  const entries = Object.entries(words)
  if (entries.length !== 1) return 'a goal of more than one word'
  const [word, value] = entries[0]!
  const isShare = (share: unknown) => typeof share === 'number' && share >= 0 && share < 1
  if (sameFaction !== undefined && (word !== 'exactly' || sameFaction !== true))
    return 'sameFaction off an exactly goal'
  if (nonHero !== undefined && (word !== 'exactly' || !isShare(nonHero)))
    return 'nonHero off an exactly goal, or not a share below 1'
  if (fallback !== undefined && (word !== 'target' || fallback !== false))
    return 'fallback off a target goal, or not false'
  if (others !== undefined && (word !== 'target' || !isShare(others)))
    return 'others off a target goal, or not a share below 1'
  if (LIST_GOALS.has(word))
    return typeof value === 'string' && value !== '' ? null : `${word} names no list`
  if (COUNT_GOALS.has(word))
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? null
      : `${word} has no count`
  if (word === 'most') return MOST_KINDS.has(value as string) ? null : `most counts ${value}`
  return `the goal word ${word}`
}

// Whether a rule names its tile: a charm's always, an artifact's never, since
// the engine reads an artifact's effect off its arrows alone.
function shapeProblems(rules: readonly Rule[], tile: 'always' | 'never' | 'may'): string[] {
  const problems: string[] = []
  // One effect can have two aims, each its own rule, but never two of one goal
  // word for one team from one body.
  const aims = new Set<string>()
  for (const rule of rules) {
    for (const field of Object.keys(rule))
      if (!FIELDS.has(field)) problems.push(`the field ${field}`)
    if (rule.team !== 'ally' && rule.team !== 'enemy') problems.push(`the team ${rule.team}`)
    const word = typeof rule.goal === 'string' ? rule.goal : Object.keys(rule.goal)[0]
    const aim = `${rule.team} ${word}${rule.from ? ` from ${rule.from}` : ''}`
    if (aims.has(aim)) problems.push(`two ${aim} rules`)
    aims.add(aim)
    const goal = goalProblem(rule.goal)
    if (goal) problems.push(goal)
    if (tile === 'always' && rule.tile === undefined) problems.push('no tile word')
    if (tile === 'never' && rule.tile !== undefined) problems.push('a tile word')
    if (rule.tile !== undefined && !TILE_WORDS.has(rule.tile)) {
      problems.push(`the tile word ${rule.tile}`)
    }
    if (
      rule.goal === 'back' &&
      (rule.team !== 'ally' || rule.tile !== undefined || tile === 'never')
    )
      problems.push('a back goal on an enemy, tile or artifact rule')
    if (
      rule.distance !== undefined &&
      (rule.tile !== 'around' || !Number.isInteger(rule.distance) || rule.distance < 2)
    )
      problems.push('a distance off an around tile rule, or not a whole number above 1')
    if (rule.from !== undefined && rule.from !== 'companion') problems.push(`from ${rule.from}`)
    if ((rule.goal === 'none') === (rule.weight !== undefined)) {
      problems.push(rule.goal === 'none' ? 'a weight on a goal of none' : 'no weight')
    }
    if (typeof rule.note !== 'string' || rule.note === '') problems.push('no note')
  }
  return problems
}

// An artifact's effect lands where Stargazer draws its arrows, so a board with
// one unit on each side shows whether it draws any.
function artifactLands(name: string): boolean {
  const grid = new Grid()
  placeOnTile(grid, 1, 1, Team.ALLY)
  placeOnTile(grid, 45, 2, Team.ENEMY)
  return [Team.ALLY, Team.ENEMY].some((team) => artifactTargetArrows(grid, team, name).length > 0)
}

// A rule that needs no skill: one naming its tile, or asking where its unit stands.
const standsAlone = (rule: Rule): boolean => rule.tile !== undefined || rule.goal === 'back'

const units = [
  ...loadCharacters().map((hero) => ({
    name: hero.name,
    tile: 'may' as const,
    rules: hero.rules,
    lands: hasSkill(hero.id) || !!hero.rules?.every(standsAlone),
  })),
  ...loadArtifacts().map((artifact) => ({
    name: artifact.name,
    tile: 'never' as const,
    rules: artifact.rules,
    lands: artifactLands(artifact.name),
  })),
  ...loadPhantimals().map((phantimal) => ({
    name: phantimal.name,
    tile: 'may' as const,
    rules: phantimal.rules,
    lands: hasSkill(toPhantimalId(phantimal.id)) || !!phantimal.rules?.every(standsAlone),
  })),
].filter((unit) => unit.rules)

// Every file with rules, by the name the words of its rules go by.
const owners = [...units, ...loadCharms().map((charm) => ({ name: charm.id, rules: charm.rules }))]
const words = loadAppLocales()

describe('placement rules', () => {
  it('keep the contract on every hero, artifact and phantimal, each on a unit Stargazer places or naming its tile', () => {
    for (const unit of units) {
      expect(shapeProblems(unit.rules!, unit.tile), `${unit.name}'s rules`).toEqual([])
      expect(unit.lands, `${unit.name} has rules but no skill that says where it lands`).toBe(true)
    }
  })

  it('keep the contract on every charm, each naming its tile', () => {
    for (const charm of loadCharms()) {
      expect(shapeProblems(charm.rules ?? [], 'always'), `${charm.id}'s rules`).toEqual([])
    }
  })

  // A placement card words an effect by the file its rule sits in, with
  // -companion for the effect a unit's other body gives: what a goal for heroes
  // (target, include, exactly) gives and what a hero receives, or what a most or
  // companion goal reaches.
  it('each have the words a placement card names their effect with, and no words outlive one', () => {
    const needed = new Set<string>()
    for (const { name, rules } of owners) {
      for (const rule of rules ?? []) {
        if (rule.team !== 'ally' || rule.weight === undefined) continue
        const verb = effectVerb(rule.goal)
        const kinds = verb === 'gives' ? ['gives', 'receives'] : verb ? [verb] : []
        const file = rule.from === 'companion' ? `${name}-companion` : name
        for (const key of kinds.map((kind) => `placement-${kind}-${file}`)) {
          expect(needed.has(key), `two of ${name}'s rules are worded by ${key}`).toBe(false)
          needed.add(key)
        }
      }
    }
    expect([...needed].filter((key) => !words[key])).toEqual([])
    const named = Object.keys(words).filter((key) =>
      /^placement-(gives|receives|reaches)-/.test(key),
    )
    expect(named.filter((key) => !needed.has(key))).toEqual([])
  })

  // The Formation engine rules page shows each rule's note in the site
  // language, and for a rule against an enemy hero, which of our units its
  // skill lands on.
  it('each have their note words, the English word for word, and no words outlive one', () => {
    const needed = new Set<string>()
    for (const { name, rules } of owners) {
      for (const rule of rules ?? []) {
        const card = ruleUnit('hero', name, [rule], {}).cards[0]!
        expect(needed.has(card.note), `two of ${name}'s rules are noted by ${card.note}`).toBe(
          false,
        )
        needed.add(card.note)
        expect(words[card.note]?.en, `${card.note} in English`).toBe(rule.note)
        if (card.targets) needed.add(card.targets)
      }
    }
    expect([...needed].filter((key) => !words[key])).toEqual([])
    const named = Object.keys(words).filter((key) => /^placement-(note|targets)-/.test(key))
    expect(named.filter((key) => !needed.has(key))).toEqual([])
  })
})
