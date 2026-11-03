/* The placement engine's lookups over Stargazer's own data files. */

import { toBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { getCharmForHero, loadArtifacts, loadCharacters, loadPhantimals } from '@/utils/dataLoader'
import type { PlacementLookups } from './types'

const heroById = new Map(loadCharacters().map((hero) => [hero.id, hero]))
const artifactById = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact]))
const phantimals = new Map(loadPhantimals().map((phantimal) => [phantimal.id, phantimal]))
const phantimalOf = (unitId: number) => phantimals.get(toLocalPhantimalId(unitId))

export const PLACEMENT_LOOKUPS: PlacementLookups = {
  factionOf: (id) =>
    inPhantimalBand(id) ? phantimalOf(id)?.faction : heroById.get(toBaseHeroId(id))?.faction,
  classOf: (id) =>
    inPhantimalBand(id) ? phantimalOf(id)?.class : heroById.get(toBaseHeroId(id))?.class,
  seasonalTargeting: (id) => inPhantimalBand(id) && phantimalOf(id)?.targeting === true,
  rulesOf: (id) =>
    (inPhantimalBand(id) ? phantimalOf(id)?.rules : heroById.get(toBaseHeroId(id))?.rules) ?? [],
  charmOf: (id) => {
    const hero = heroById.get(id)
    const charm = hero && getCharmForHero(hero.name)
    return charm ? { id: charm.id, rules: charm.rules ?? [] } : undefined
  },
  artifactOf: (id) => {
    const artifact = artifactById.get(id)
    return artifact && { name: artifact.name, rules: artifact.rules ?? [] }
  },
}
