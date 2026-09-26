import type { CharacterType } from '@/lib/types/character'
import { SLOT_ORDER, type SlotKey, type TagPin } from '@/lib/types/skill'
import { loadCharacters } from '@/utils/dataLoader'

export interface GuideTagGroup {
  tag: string
  characters: CharacterType[]
}

export function guideTagGroups(): GuideTagGroup[] {
  const characters = loadCharacters()
  const tags = new Set<string>()
  for (const c of characters) for (const t of Object.keys(c.tags)) tags.add(t)
  return [...tags].sort().map((tag) => ({
    tag,
    characters: characters.filter((c) => tag in c.tags),
  }))
}

export interface TaggedSlot {
  slotKey: SlotKey
  levels: number[]
}

function pinnedLevels(character: CharacterType, tag: string, pin: TagPin): number[] {
  const levels = new Set<number>()
  for (const att of character.tags[tag] ?? []) {
    const level = att[pin]
    if (level !== undefined) levels.add(level)
  }
  return [...levels].sort((a, b) => a - b)
}

// The (slot, level) pins a tag attaches to on a character, grouped by slot in
// render order. Empty for character-level tags (e.g. initial-energy-300), whose
// attachment list carries no slot.
export function taggedSlots(character: CharacterType, tag: string): TaggedSlot[] {
  return SLOT_ORDER.map((slotKey) => ({
    slotKey,
    levels: pinnedLevels(character, tag, slotKey),
  })).filter((s) => s.levels.length > 0)
}

// The charm tiers (1-4) a tag attaches to; empty when the hero's skills carry
// the tag and its charm does not.
export function taggedCharmTiers(character: CharacterType, tag: string): number[] {
  return pinnedLevels(character, tag, 'charm')
}
