/* The Honor Duel text in the skill-text language, for a hover card or a
 * picker. Read after mount, so a pre-rendered page carries none; null until it
 * arrives and where the data pack holds none for the language. */

import { onMounted, shallowRef, watch, type ShallowRef } from 'vue'

import { loadHonorDuelText } from '@/lib/hd/catalog'
import type { HonorDuelText } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'

export function useDuelText(): ShallowRef<HonorDuelText | null> {
  const i18n = useI18nStore()
  const text = shallowRef<HonorDuelText | null>(null)
  onMounted(() =>
    watch(
      () => i18n.effectiveSkillLocale,
      (lang) => {
        const settle = (loaded: HonorDuelText | null) => {
          if (i18n.effectiveSkillLocale === lang) text.value = loaded
        }
        loadHonorDuelText(lang).then(settle, () => settle(null))
      },
      { immediate: true },
    ),
  )
  return text
}
