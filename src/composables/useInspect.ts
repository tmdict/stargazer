import { computed, nextTick, ref, shallowRef } from 'vue'

import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import type { TagPick } from '@/lib/types/skill'
import { hasSkillLocale } from '@/utils/dataLoader'

/* The inspect gesture's detail popup (long-press, right-click, the lifted
 * unit's Skills button), shared by the boards and every icon that inspects.
 * State is a module-level singleton and InspectModals (mounted once at the
 * app root) renders it, so every surface opens the same modal instance. */

export type InspectTarget =
  // `chips` opens the skill page with those chips on (a hero list's tag filter,
  // the Mechanics guide's picks).
  | { kind: 'hero'; slug: string; chips?: readonly TagPick[] }
  | { kind: 'phantimal'; phantimal: PhantimalType }
  | { kind: 'artifact'; artifact: ArtifactType }

const target = shallowRef<InspectTarget | null>(null)
const open = ref(false)

// A hero has a skill page unless it is a placeholder or has no skill text, and
// without a page there is nothing to inspect.
export const heroInspectTarget = (
  hero: CharacterType,
  chips?: readonly TagPick[],
): InspectTarget | null =>
  !hero.placeholder && hasSkillLocale(hero.name) ? { kind: 'hero', slug: hero.name, chips } : null

export function useInspect() {
  // The target's modal mounts closed and opens a tick later, so its enter
  // transition plays.
  const inspect = async (next: InspectTarget): Promise<void> => {
    open.value = false
    target.value = next
    await nextTick()
    open.value = true
  }

  const close = (): void => {
    open.value = false
  }

  return {
    target: computed(() => target.value),
    open: computed(() => open.value),
    inspect,
    close,
  }
}
