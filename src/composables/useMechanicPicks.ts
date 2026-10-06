import { computed, readonly, ref } from 'vue'

import { useEnergyValue } from '@/composables/useEnergyValue'
import {
  ENERGY_KEY,
  isEnergyPick,
  matchesMechanic,
  mechanicKeys,
  type MechanicPick,
} from '@/lib/mechanics'
import { tagPick, type TagVocabulary } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'

interface PickState {
  // The tag itself was picked, apart from any modifier.
  whole: boolean
  mods: readonly string[]
}

/* The Mechanics guide's selection: the tags picked, the modifiers picked under
 * each, and whether the energy filter is on. A hero has to satisfy every pick.
 * One instance per page, shared by its cards and strip. */
export function useMechanicPicks(vocabulary: TagVocabulary) {
  const state = ref<Record<string, PickState>>({})
  const energyPicked = ref(false)
  const energyValue = useEnergyValue()

  const picks = computed<MechanicPick[]>(() =>
    mechanicKeys(vocabulary).flatMap((key): MechanicPick[] => {
      if (key === ENERGY_KEY) return energyPicked.value ? [{ energyAbove: energyValue.value }] : []
      const picked = state.value[key]
      if (!picked) return []
      return [picked.mods.length > 0 ? { tag: key, mods: picked.mods } : tagPick(key, vocabulary)]
    }),
  )

  const set = (tag: string, next: PickState | null): void => {
    const rest = { ...state.value }
    delete rest[tag]
    state.value = next ? { ...rest, [tag]: next } : rest
  }

  function toggle(key: string): void {
    if (key === ENERGY_KEY) {
      energyPicked.value = !energyPicked.value
      return
    }
    const current = state.value[key]
    set(key, current?.whole && current.mods.length === 0 ? null : { whole: true, mods: [] })
  }

  // Switching the last modifier off returns the tag to how it was before any
  // was on: still picked if its title was, unpicked otherwise.
  function toggleModifier(tag: string, mod: string): void {
    const { whole, mods } = state.value[tag] ?? { whole: false, mods: [] }
    const next = mods.includes(mod) ? mods.filter((m) => m !== mod) : [...mods, mod].sort()
    set(tag, whole || next.length > 0 ? { whole, mods: next } : null)
  }

  /** A new energy value picks the filter, as a modifier picks its tag. */
  function setEnergy(value: number): void {
    energyValue.value = value
    energyPicked.value = true
  }

  function remove(key: string): void {
    if (key === ENERGY_KEY) energyPicked.value = false
    else set(key, null)
  }

  const clear = (): void => {
    state.value = {}
    energyPicked.value = false
  }

  /** A link's pick, replacing the selection. */
  function open(pick: MechanicPick): void {
    clear()
    if (isEnergyPick(pick)) {
      setEnergy(pick.energyAbove)
      return
    }
    const plain = pick.mods.length === 0 || !!vocabulary.get(pick.tag)?.solo
    state.value = {
      [pick.tag]: plain ? { whole: true, mods: [] } : { whole: false, mods: pick.mods },
    }
  }

  const matches = (hero: Pick<CharacterType, 'tags' | 'energy'>): boolean =>
    picks.value.every((pick) => matchesMechanic(hero, pick))

  return {
    picks,
    energyValue: readonly(energyValue),
    toggle,
    toggleModifier,
    setEnergy,
    remove,
    clear,
    open,
    matches,
  }
}
