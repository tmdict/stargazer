/* The tags and modifiers the hero data uses, read once: the vocabulary behind
 * every tag menu, chip and link. */

import { compareCharacters } from '@/lib/filterOrder'
import { ENERGY_KEY, mechanicKeys, totalEnergy } from '@/lib/mechanics'
import { tagVocabulary, type TagVocabulary } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import { loadCharacters } from './dataLoader'

let vocabulary: TagVocabulary | null = null

export function loadTagVocabulary(): TagVocabulary {
  vocabulary ??= tagVocabulary(loadCharacters())
  return vocabulary
}

/** A modifier naming a hero marks synergy with that hero. */
export function isHeroModifier(mod: string): boolean {
  return loadCharacters().some((c) => !c.placeholder && c.name === mod)
}

interface MechanicGroup {
  // A tag, or the energy filter's key.
  key: string
  characters: CharacterType[]
}

/** The heroes under each mechanic: a tag's carriers, and under the energy
 * filter every hero with starting energy. Mechanics in menu order, heroes in
 * the order every hero list uses. */
export function loadMechanicGroups(): MechanicGroup[] {
  const characters = [...loadCharacters()].sort(compareCharacters)
  return mechanicKeys(loadTagVocabulary()).map((key) => ({
    key,
    characters: characters.filter((c) =>
      key === ENERGY_KEY ? totalEnergy(c) > 0 : Object.hasOwn(c.tags, key),
    ),
  }))
}
