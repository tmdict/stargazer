/* The tags and modifiers the hero data uses, read once: the vocabulary behind
 * every tag menu, chip and link. */

import { compareCharacters } from '@/lib/filterOrder'
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

interface TagGroup {
  tag: string
  characters: CharacterType[]
}

/** The heroes carrying each tag: tags in vocabulary order, heroes in the order
 * every hero list uses. */
export function loadTagGroups(): TagGroup[] {
  const characters = [...loadCharacters()].sort(compareCharacters)
  return [...loadTagVocabulary().keys()].map((tag) => ({
    tag,
    characters: characters.filter((c) => Object.hasOwn(c.tags, tag)),
  }))
}
