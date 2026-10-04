import { computed, ref } from 'vue'

import { matchesPick, tagPick, type TagVocabulary } from '@/lib/tags'
import type { CharacterTags, TagPick } from '@/lib/types/skill'

interface PickState {
  // The tag itself was picked, apart from any modifier.
  whole: boolean
  mods: readonly string[]
}

/* The Mechanics guide's selection: the tags picked and the modifiers picked
 * under each. A hero has to satisfy every pick. One instance per page, shared
 * by its cards and strip. */
export function useMechanicPicks(vocabulary: TagVocabulary) {
  const state = ref<Record<string, PickState>>({})

  const picks = computed<TagPick[]>(() =>
    [...vocabulary.keys()]
      .filter((tag) => Object.hasOwn(state.value, tag))
      .map((tag) => {
        const { mods } = state.value[tag]!
        return mods.length > 0 ? { tag, mods } : tagPick(tag, vocabulary)
      }),
  )

  const set = (tag: string, next: PickState | null): void => {
    const rest = { ...state.value }
    delete rest[tag]
    state.value = next ? { ...rest, [tag]: next } : rest
  }

  function toggleTag(tag: string): void {
    const current = state.value[tag]
    set(tag, current?.whole && current.mods.length === 0 ? null : { whole: true, mods: [] })
  }

  // Switching the last modifier off returns the tag to how it was before any
  // was on: still picked if its title was, unpicked otherwise.
  function toggleModifier(tag: string, mod: string): void {
    const { whole, mods } = state.value[tag] ?? { whole: false, mods: [] }
    const next = mods.includes(mod) ? mods.filter((m) => m !== mod) : [...mods, mod].sort()
    set(tag, whole || next.length > 0 ? { whole, mods: next } : null)
  }

  const remove = (tag: string): void => set(tag, null)

  const clear = (): void => {
    state.value = {}
  }

  /** A tag link's pick, replacing the selection. */
  function open(pick: TagPick): void {
    const plain = pick.mods.length === 0 || !!vocabulary.get(pick.tag)?.solo
    state.value = {
      [pick.tag]: plain ? { whole: true, mods: [] } : { whole: false, mods: pick.mods },
    }
  }

  const matches = (tags: CharacterTags): boolean =>
    picks.value.every((pick) => matchesPick(tags, pick))

  return { picks, toggleTag, toggleModifier, remove, clear, open, matches }
}
