/* The placement engine's lookups over Stargazer's own data files. */

import { toBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { getCharmForHero, loadArtifacts, loadCharacters, loadPhantimals } from '@/lib/dataLoader'
import { matchesFilter } from './lists'
import type { PlacementLookups } from './types'

const heroById = new Map(loadCharacters().map((hero) => [hero.id, hero]))
const heroes = [...heroById.values()].filter((hero) => !hero.placeholder)
const artifactById = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact]))
const phantimals = new Map(loadPhantimals().map((phantimal) => [phantimal.id, phantimal]))
const phantimalOf = (unitId: number) => phantimals.get(toLocalPhantimalId(unitId))
// A hero's or phantimal's data file, by unit id.
export const unitData = (unitId: number) =>
  inPhantimalBand(unitId) ? phantimalOf(unitId) : heroById.get(toBaseHeroId(unitId))

export const PLACEMENT_LOOKUPS: PlacementLookups = {
  factionOf: (id) => unitData(id)?.faction,
  classOf: (id) => unitData(id)?.class,
  seasonalTargeting: (id) => inPhantimalBand(id) && phantimalOf(id)?.targeting === true,
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
