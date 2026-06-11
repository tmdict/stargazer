import { ref, watch, type Ref, type WatchSource } from 'vue'

import type { Locale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

/**
 * Modal-local locale: starts from the global locale and resets to it every
 * time the modal opens, letting the modal switch language without mutating
 * the global preference.
 */
export function useModalLocale(show: WatchSource<boolean>): Ref<Locale> {
  const i18n = useI18nStore()
  const displayLocale = ref<Locale>(i18n.currentLocale)

  watch(show, (isOpen) => {
    if (isOpen) displayLocale.value = i18n.currentLocale
  })

  return displayLocale
}
