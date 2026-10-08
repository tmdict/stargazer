import { ref, watch, type Ref, type WatchSource } from 'vue'

import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadSkillLocale } from '@/utils/dataLoader'

/**
 * Modal-local skill-text locale. Seeds from the saved preference (falling
 * back to the app locale) each time the modal opens. `applied` trails
 * `selected` by the chunk load, so the modal only ever renders warm data:
 * during a switch it keeps the previous language's text instead of flashing
 * an empty or not-found state. `failed` is set when there is no text to
 * keep and none could be fetched. Persistence is not this composable's
 * concern; the globe menu persists explicit picks itself.
 */
export function useModalSkillLocale(show: WatchSource<boolean>): {
  selected: Ref<SkillLocale>
  applied: Ref<SkillLocale | null>
  failed: Ref<boolean>
  apply: (locale: SkillLocale) => void
} {
  const i18n = useI18nStore()
  const selected = ref<SkillLocale>(i18n.effectiveSkillLocale)
  const applied = ref<SkillLocale | null>(null)
  const failed = ref(false)

  // Counts picks, so a load that resolves after a newer pick is ignored even
  // when both asked for the same language.
  let latest = 0

  const apply = (locale: SkillLocale) => {
    const pick = ++latest
    selected.value = locale
    failed.value = false
    const settle = (shown: SkillLocale) => {
      if (pick !== latest) return
      selected.value = shown
      applied.value = shown
    }
    loadSkillLocale(locale)
      .then(() => settle(locale))
      // Chunk fetch failed: English stands in if its own chunk can be had.
      .catch(() => loadSkillLocale('en').then(() => settle('en')))
      .catch(() => {
        if (pick !== latest) return
        if (applied.value) selected.value = applied.value
        else failed.value = true
      })
  }

  watch(show, (isOpen) => {
    if (isOpen) apply(i18n.effectiveSkillLocale)
  })

  return { selected, applied, failed, apply }
}
