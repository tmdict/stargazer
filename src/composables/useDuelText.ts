/* The Honor Duel text in a skill-text language, loaded as that language is
 * chosen: the reader's for a hover card or a picker, a popup's own for a
 * popup. */

import { onMounted, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

import { loadHonorDuelText } from '@/lib/hd/catalog'
import type { HonorDuelText } from '@/lib/types/honorDuel'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

/** The text in the reader's skill-text language. Read after mount, so a
 * pre-rendered page carries none; null until it arrives and where the data
 * pack holds none for the language. */
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

/** A popup's text, in its own skill-text language (`applied` of
 * useModalSkillLocale). The text trails `applied` by its chunk load, so a
 * switch keeps the previous language's text, named by `lang`, until the next
 * arrives. `loaded` is null until the first load settles, and its `text` is
 * null where the data pack holds none for the language. `failed` is set when
 * the download fails; the popup stays mounted between openings, so each
 * opening asks again for text it does not hold. */
export function useModalDuelText(
  show: () => boolean,
  applied: Readonly<Ref<SkillLocale | null>>,
): {
  loaded: Readonly<ShallowRef<{ lang: SkillLocale; text: HonorDuelText | null } | null>>
  failed: Readonly<Ref<boolean>>
} {
  const loaded = shallowRef<{ lang: SkillLocale; text: HonorDuelText | null } | null>(null)
  const failed = ref(false)
  watch(
    [applied, show],
    ([lang, open]) => {
      if (!lang || !open || loaded.value?.lang === lang) return
      failed.value = false
      loadHonorDuelText(lang).then(
        (text) => {
          if (applied.value === lang) loaded.value = { lang, text }
        },
        () => {
          if (applied.value !== lang) return
          loaded.value = null
          failed.value = true
        },
      )
    },
    { immediate: true },
  )
  return { loaded, failed }
}
