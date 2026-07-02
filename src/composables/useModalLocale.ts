import { ref, watch, type Ref, type WatchSource } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

/**
 * Modal-local locale for en/zh-only content (artifact/phantimal modals):
 * starts from the global locale and resets to it every time the modal opens,
 * letting the modal switch language without mutating the global preference.
 * The skill modal uses useModalSkillLocale instead (16-locale content).
 */
export function useModalLocale(show: WatchSource<boolean>): Ref<AppLocale> {
  const i18n = useI18nStore()
  const displayLocale = ref<AppLocale>(i18n.currentLocale)

  watch(show, (isOpen) => {
    if (isOpen) displayLocale.value = i18n.currentLocale
  })

  return displayLocale
}
