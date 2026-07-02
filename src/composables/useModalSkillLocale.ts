import { ref, watch, type Ref, type WatchSource } from 'vue'

import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadSkillLocale } from '@/utils/dataLoader'

/**
 * Modal-local skill-text locale. Seeds from the saved preference (falling
 * back to the app locale) each time the modal opens. `applied` trails
 * `selected` by the chunk load, so the modal only ever renders warm data:
 * during a switch it keeps the previous language's text instead of flashing
 * an empty or not-found state. Persistence is not this composable's concern;
 * the globe menu persists explicit picks itself.
 */
export function useModalSkillLocale(show: WatchSource<boolean>): {
  selected: Ref<SkillLocale>
  applied: Ref<SkillLocale | null>
  apply: (locale: SkillLocale) => void
} {
  const i18n = useI18nStore()
  const selected = ref<SkillLocale>(i18n.effectiveSkillLocale)
  const applied = ref<SkillLocale | null>(null)

  const apply = (locale: SkillLocale) => {
    selected.value = locale
    loadSkillLocale(locale)
      .then(() => {
        // Ignore resolutions that lost a race against a newer pick.
        if (selected.value === locale) applied.value = locale
      })
      .catch(() => {
        // Chunk fetch failed: fall back to the always-warm en corpus.
        if (selected.value === locale) {
          selected.value = 'en'
          applied.value = 'en'
        }
      })
  }

  watch(show, (isOpen) => {
    if (isOpen) apply(i18n.effectiveSkillLocale)
  })

  return { selected, applied, apply }
}
