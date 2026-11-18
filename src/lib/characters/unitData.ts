/* A unit's data file, and the traits skills read from it, by unit id. */

import { loadCharacters, loadCreatures, loadPhantimals } from '../dataLoader'
import type { SkillLookups } from '../skills/skill'
import type { CharacterType } from '../types/character'
import type { PhantimalType } from '../types/phantimal'
import { toBaseHeroId } from './character'
import { inPhantimalBand, toLocalPhantimalId } from './phantimal'

let files:
  { heroes: Map<number, CharacterType>; phantimals: Map<number, PhantimalType> } | undefined
const data = () =>
  (files ??= {
    heroes: new Map([...loadCharacters(), ...loadCreatures()].map((unit) => [unit.id, unit])),
    phantimals: new Map(loadPhantimals().map((phantimal) => [phantimal.id, phantimal])),
  })

const phantimalData = (unitId: number) => data().phantimals.get(toLocalPhantimalId(unitId))

// A companion, a synergy copy or a Trial copy answers with its base hero's
// file, a Trial copy of a creature with the creature's, and a phantimal's
// companion with its phantimal's.
export const unitData = (unitId: number): CharacterType | PhantimalType | undefined =>
  inPhantimalBand(unitId) ? phantimalData(unitId) : data().heroes.get(toBaseHeroId(unitId))

export const UNIT_LOOKUPS: SkillLookups = {
  factionOf: (id) => unitData(id)?.faction,
  classOf: (id) => unitData(id)?.class,
  seasonalTargeting: (id) => inPhantimalBand(id) && phantimalData(id)?.targeting === true,
}
