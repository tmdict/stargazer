/* The placement engine's lookups over Stargazer's own data files. */

import { UNIT_LOOKUPS, unitData } from '@/lib/characters/unitData'
import { getCharmForHero, loadArtifacts, loadCharacters } from '@/lib/dataLoader'
import { matchesFilter } from './lists'
import type { PlacementLookups } from './types'

const heroById = new Map(loadCharacters().map((hero) => [hero.id, hero]))
const heroes = [...heroById.values()].filter((hero) => !hero.placeholder)
const artifactById = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact]))

export const PLACEMENT_LOOKUPS: PlacementLookups = {
  ...UNIT_LOOKUPS,
  rulesOf: (id) => unitData(id)?.rules ?? [],
  charmOf: (id) => {
    const hero = heroById.get(id)
    const charm = hero && getCharmForHero(hero.name)
    return charm ? { id: charm.id, rules: charm.rules ?? [] } : undefined
  },
  artifactOf: (id) => {
    const artifact = artifactById.get(id)
    return artifact && { name: artifact.name, rules: artifact.rules ?? [] }
  },
  nameOf: (id) => unitData(id)?.name,
  rangeOf: (id) => unitData(id)?.range,
  heroesMatching: (filter) =>
    heroes.filter((hero) => matchesFilter(hero, filter)).map((hero) => hero.id),
}
