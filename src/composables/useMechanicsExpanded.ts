import { onMounted, readonly, ref } from 'vue'

import { readStorage, writeStorage } from '@/utils/storage'

/* Whether the hero lists show the mechanic filter as a row of chips instead of
 * its dropdown. One value for every list, so they never disagree, kept in
 * `stargazer.tags.expanded`: "1" for the chips, "0" for the dropdown, and the
 * chips while nothing else is stored.
 *
 * The stored value is adopted on mount, once: pre-rendered pages carry the
 * chips, so a read at setup would mismatch, and a re-read on every mount
 * would undo the choice where storage is unavailable. */
const EXPANDED_KEY = 'stargazer.tags.expanded'

const expanded = ref(true)
let adopted = false

export function useMechanicsExpanded() {
  onMounted(() => {
    if (adopted) return
    adopted = true
    expanded.value = readStorage(EXPANDED_KEY) !== '0'
  })

  const setExpanded = (value: boolean): void => {
    expanded.value = value
    writeStorage(EXPANDED_KEY, value ? '1' : '0')
  }
  return { expanded: readonly(expanded), setExpanded }
}
