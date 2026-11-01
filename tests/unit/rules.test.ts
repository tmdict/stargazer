// Placement rule data integrity: every rule in the hero, artifact, phantimal
// and charm files keeps the rule contract's fields and words, and sits on a
// unit whose skill says where its effect lands, or for a charm, which Stargazer
// does not draw, names the tile. The placement engine reads these files with
// no checks of its own.
import { describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import { artifactTargetArrows } from '@/lib/skills/artifact'
import { hasSkill } from '@/lib/skills/skill'
import type { Rule } from '@/lib/types/rule'
import type { CharmData } from '@/lib/types/skill'
import { Team } from '@/lib/types/team'
import { loadArtifacts, loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import { placeOnTile } from './fixtures/skills'

const charmFiles = import.meta.glob<CharmData>('@/data/seasonal/charm/*.json', {
  eager: true,
  import: 'default',
})

const FIELDS = new Set(['team', 'goal', 'tile', 'weight', 'note'])
const LIST_GOALS = new Set(['target', 'avoid', 'include'])
const COUNT_GOALS = new Set(['atMost', 'exactly'])
const MOST_KINDS = new Set(['walls'])

function goalProblem(goal: unknown): string | null {
  if (goal === 'most' || goal === 'none') return null
  if (typeof goal !== 'object' || goal === null) return `the goal ${JSON.stringify(goal)}`
  const { sameFaction, nonHero, ...words } = goal as Record<string, unknown>
  const entries = Object.entries(words)
  if (entries.length !== 1) return 'a goal of more than one word'
  const [word, value] = entries[0]!
  if (sameFaction !== undefined && (word !== 'exactly' || sameFaction !== true))
    return 'sameFaction off an exactly goal'
  if (
    nonHero !== undefined &&
    (word !== 'exactly' || typeof nonHero !== 'number' || !(nonHero >= 0 && nonHero < 1))
  )
    return 'nonHero off an exactly goal, or not a share below 1'
  if (LIST_GOALS.has(word))
    return typeof value === 'string' && value !== '' ? null : `${word} names no list`
  if (COUNT_GOALS.has(word))
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? null
      : `${word} has no count`
  if (word === 'most') return MOST_KINDS.has(value as string) ? null : `most counts ${value}`
  return `the goal word ${word}`
}

function shapeProblems(rules: readonly Rule[], charm: boolean): string[] {
  const problems: string[] = []
  // One effect can have two aims, each its own rule, but never two of one goal
  // word for one team.
  const aims = new Set<string>()
  for (const rule of rules) {
    for (const field of Object.keys(rule))
      if (!FIELDS.has(field)) problems.push(`the field ${field}`)
    if (rule.team !== 'ally' && rule.team !== 'enemy') problems.push(`the team ${rule.team}`)
    const word = typeof rule.goal === 'string' ? rule.goal : Object.keys(rule.goal)[0]
    const aim = `${rule.team} ${word}`
    if (aims.has(aim)) problems.push(`two ${aim} rules`)
    aims.add(aim)
    const goal = goalProblem(rule.goal)
    if (goal) problems.push(goal)
    if (charm !== (rule.tile !== undefined)) problems.push(charm ? 'no tile word' : 'a tile word')
    if (rule.tile !== undefined && rule.tile !== 'behind' && rule.tile !== 'front') {
      problems.push(`the tile word ${rule.tile}`)
    }
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

const units = [
  ...loadCharacters().map((hero) => ({
    name: hero.name,
    rules: hero.rules,
    lands: hasSkill(hero.id),
  })),
  ...loadArtifacts().map((artifact) => ({
    name: artifact.name,
    rules: artifact.rules,
    lands: artifactLands(artifact.name),
  })),
  ...loadPhantimals().map((phantimal) => ({
    name: phantimal.name,
    rules: phantimal.rules,
    lands: hasSkill(toPhantimalId(phantimal.id)),
  })),
].filter((unit) => unit.rules)

describe('placement rules', () => {
  it('keep the contract on every hero, artifact and phantimal, each on a unit Stargazer places', () => {
    for (const unit of units) {
      expect(shapeProblems(unit.rules!, false), `${unit.name}'s rules`).toEqual([])
      expect(unit.lands, `${unit.name} has rules but no skill that says where it lands`).toBe(true)
    }
  })

  it('keep the contract on every charm, each naming its tile', () => {
    for (const charm of Object.values(charmFiles)) {
      expect(shapeProblems(charm.rules ?? [], true), `${charm.id}'s rules`).toEqual([])
    }
  })
})
