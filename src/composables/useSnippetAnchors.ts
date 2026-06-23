import { provide, shallowRef, type Ref } from 'vue'

import { SkillSnippetAnchorsKey } from '@/components/skill/snippetKeys'
import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'

/**
 * Per-slot teleport targets for a hero's snippet pieces, provided to descendant
 * <SkillSnippets>. Attach each returned ref to the matching rendered section so
 * its note teleports into place; an unset slot is skipped by the snippet.
 */
export function useSnippetAnchors(): Record<SlotKey, Ref<HTMLElement | null>> {
  const anchors = SLOT_ORDER.reduce(
    (acc, key) => {
      acc[key] = shallowRef<HTMLElement | null>(null)
      return acc
    },
    {} as Record<SlotKey, Ref<HTMLElement | null>>,
  )
  provide(SkillSnippetAnchorsKey, anchors)
  return anchors
}
