import { computed, type ComputedRef } from 'vue'

import type { TagPin } from '@/lib/types/skill'
import { loadCharacters } from '@/utils/dataLoader'

interface SkillTagsApi {
  /** Tags attached to a specific (slot, level), or (charm, tier). Empty array if none. */
  perLevel: (pin: TagPin, level: number) => string[]
  /** All distinct tag names on the character (skill-level, charm and character-level). */
  perCharacter: ComputedRef<string[]>
}

export function useSkillTags(slug: string): SkillTagsApi {
  const character = loadCharacters().find((c) => c.name === slug)
  const tagMap = character?.tags ?? {}

  return {
    perLevel(pin, level) {
      const out: string[] = []
      for (const [tagName, attachments] of Object.entries(tagMap)) {
        if (attachments.some((a) => a[pin] === level)) out.push(tagName)
      }
      return out
    },
    perCharacter: computed(() => Object.keys(tagMap)),
  }
}
