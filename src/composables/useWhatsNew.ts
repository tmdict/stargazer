/* What's New: whether this browser has opened the edition on show. The stored
   value is the date of the last edition opened, so a new edition brings the
   tab's dot back. Read after mount, so the first render matches the
   pre-rendered page, which has no dot. */

import { onMounted, readonly, ref } from 'vue'

import { readStorage, writeStorage } from '@/utils/storage'

// The day the edition on show went up; a new edition gets a new date.
const WHATS_NEW_EDITION = '2026-11-06'

const SEEN_KEY = 'stargazer.whatsNewSeen'

export function useWhatsNew() {
  const unseen = ref(false)

  onMounted(() => {
    unseen.value = readStorage(SEEN_KEY) !== WHATS_NEW_EDITION
  })

  const markSeen = (): void => {
    unseen.value = false
    writeStorage(SEEN_KEY, WHATS_NEW_EDITION)
  }

  return { unseen: readonly(unseen), markSeen }
}
