import { nextTick, ref } from 'vue'

import { sanitizeTeamName } from '@/lib/teams/savedTeam'

/* Inline team-rename edit state shared by the boards title and the saved-team
 * cards: one input at a time, focused and pre-selected on entry; Enter/blur
 * commit, Esc cancels. `key` distinguishes sibling targets sharing an instance
 * (e.g. one per card); a single-target caller passes any constant. */
export function useInlineRename(options: {
  // Returns the persisted name: an unchanged name skips the write, so a blur
  // with no edit costs no storage round-trip.
  currentName: (key: string) => string | null | undefined
  rename: (key: string, name: string) => void
}) {
  const editingKey = ref<string | null>(null)
  const editingName = ref('')

  // Function ref: a string ref inside v-for binds as an array, which would
  // make focus/select silent no-ops. Only one rename input exists at a time;
  // the unmounting input's null call is ignored because its order against the
  // next input's mount call isn't guaranteed (a stale element is harmless).
  const input = ref<HTMLInputElement | null>(null)
  const setInput = (el: unknown): void => {
    if (el) input.value = el as HTMLInputElement
  }

  const start = async (key: string, name: string): Promise<void> => {
    editingKey.value = key
    editingName.value = name
    await nextTick()
    input.value?.focus()
    input.value?.select()
  }

  // Clearing the key first swallows the blur that follows an Enter or Esc,
  // so a rename never fires twice.
  const commit = (): void => {
    const key = editingKey.value
    editingKey.value = null
    if (key === null) return
    if (sanitizeTeamName(editingName.value) === options.currentName(key)) return
    options.rename(key, editingName.value)
  }

  const cancel = (): void => {
    editingKey.value = null
  }

  return { editingKey, editingName, setInput, start, commit, cancel }
}
