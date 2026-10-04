import { onMounted, readonly, ref } from 'vue'

import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

/* Whether the hero lists show the mechanic filter as a row of chips instead of
 * its dropdown. One value for every list, so they never disagree, kept in
 * `stargazer.tags.expanded`: "1" while expanded, absent otherwise.
 *
 * The stored value is adopted on mount, once: pre-rendered pages carry the
 * dropdown, so a read at setup would mismatch, and a re-read on every mount
 * would undo the choice where storage is unavailable. */
const EXPANDED_KEY = 'stargazer.tags.expanded'

const expanded = ref(false)
let adopted = false

export function useMechanicsExpanded() {
  onMounted(() => {
    if (adopted) return
    adopted = true
    expanded.value = readStorage(EXPANDED_KEY) === '1'
  })

  const setExpanded = (value: boolean): void => {
    expanded.value = value
    if (value) writeStorage(EXPANDED_KEY, '1')
    else removeStorage(EXPANDED_KEY)
  }
  return { expanded: readonly(expanded), setExpanded }
}
