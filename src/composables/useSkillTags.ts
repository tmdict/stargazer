import { computed, type ComputedRef } from 'vue'

import type { SlotKey } from '@/lib/types/skill'
import { loadCharacters } from '@/utils/dataLoader'

interface SkillTagsApi {
  /** Tags attached to a specific (slot, level). Empty array if none. */
  perLevel: (slotKey: SlotKey, level: number) => string[]
  /** All distinct tag names on the character (skill-level + character-level). */
  perCharacter: ComputedRef<string[]>
}

export function useSkillTags(slug: string): SkillTagsApi {
  const character = loadCharacters().find((c) => c.name === slug)
  const tagMap = character?.tags ?? {}

  return {
    perLevel(slotKey, level) {
      const out: string[] = []
      for (const [tagName, attachments] of Object.entries(tagMap)) {
        if (attachments.some((a) => a[slotKey] === level)) out.push(tagName)
      }
      return out
    },
    perCharacter: computed(() => Object.keys(tagMap)),
  }
}
