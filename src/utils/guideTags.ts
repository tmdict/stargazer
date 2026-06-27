import type { CharacterType } from '@/lib/types/character'
import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
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

// The (slot, level) pins a tag attaches to on a character, grouped by slot in
// render order. Empty for character-level tags (e.g. initial-energy-300), whose
// attachment list carries no slot.
export function taggedSlots(character: CharacterType, tag: string): TaggedSlot[] {
  const bySlot = new Map<SlotKey, Set<number>>()
  for (const att of character.tags[tag] ?? []) {
    for (const [slot, level] of Object.entries(att)) {
      const set = bySlot.get(slot as SlotKey) ?? new Set<number>()
      set.add(level)
      bySlot.set(slot as SlotKey, set)
    }
  }
  return SLOT_ORDER.filter((s) => bySlot.has(s)).map((slotKey) => ({
    slotKey,
    levels: [...bySlot.get(slotKey)!].sort((a, b) => a - b),
  }))
}
