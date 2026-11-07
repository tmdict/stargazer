/* What's New: the edition on show, whose date is in the popup's title, and
   whether this browser has opened it. The stored value is the date of the last
   edition opened, so a new edition brings the tab's dot back. Read after mount,
   so the first render matches the pre-rendered page, which has no dot. */

import { onMounted, readonly, ref } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'
import { readStorage, writeStorage } from '@/utils/storage'

const WHATS_NEW_EDITION = '2026-11-06'

const SEEN_KEY = 'stargazer.whatsNewSeen'

/** The edition's date as the popup's title shows it. */
export function whatsNewEditionDate(locale: AppLocale): string {
  // The plain date parses as midnight UTC, so a local time zone west of UTC
  // would show the day before.
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(WHATS_NEW_EDITION),
  )
}

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
