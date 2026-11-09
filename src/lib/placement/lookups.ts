/* The placement engine's lookups over Stargazer's own data files. */

import { toBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { getCharmForHero, loadArtifacts, loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import type { PlacementLookups } from './types'

const heroById = new Map(loadCharacters().map((hero) => [hero.id, hero]))
const heroes = [...heroById.values()].filter((hero) => !hero.placeholder)
const artifactById = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact]))
const phantimals = new Map(loadPhantimals().map((phantimal) => [phantimal.id, phantimal]))
const phantimalOf = (unitId: number) => phantimals.get(toLocalPhantimalId(unitId))
const dataOf = (unitId: number) =>
  inPhantimalBand(unitId) ? phantimalOf(unitId) : heroById.get(toBaseHeroId(unitId))

export const PLACEMENT_LOOKUPS: PlacementLookups = {
  factionOf: (id) => dataOf(id)?.faction,
  classOf: (id) => dataOf(id)?.class,
  seasonalTargeting: (id) => inPhantimalBand(id) && phantimalOf(id)?.targeting === true,
  rulesOf: (id) => dataOf(id)?.rules ?? [],
  charmOf: (id) => {
    const hero = heroById.get(id)
    const charm = hero && getCharmForHero(hero.name)
    return charm ? { id: charm.id, rules: charm.rules ?? [] } : undefined
  },
  artifactOf: (id) => {
    const artifact = artifactById.get(id)
    return artifact && { name: artifact.name, rules: artifact.rules ?? [] }
  },
  nameOf: (id) => dataOf(id)?.name,
  rangeOf: (id) => dataOf(id)?.range,
  heroesMatching: ({ class: classes, range, damage }) =>
    heroes
      .filter(
        (hero) =>
          (!classes || classes.includes(hero.class)) &&
          (!range || (range === 'melee') === (hero.range === 1)) &&
          (!damage || hero.damage === damage),
      )
      .map((hero) => hero.id),
}
