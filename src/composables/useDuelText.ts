/* The Honor Duel text in a skill-text language, loaded as that language is
 * chosen: the reader's for a hover card or a picker, a popup's own for a
 * popup. */

import { onMounted, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

import { loadHonorDuelText } from '@/lib/hd/catalog'
import type { HonorDuelText } from '@/lib/types/honorDuel'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

// Hands `settle` the language's text, or null where the data pack holds none
// for it, unless the language in use has moved on by the time it arrives.
const loadFor = (
  lang: SkillLocale,
  current: () => SkillLocale | null,
  settle: (text: HonorDuelText | null) => void,
): void => {
  const done = (text: HonorDuelText | null) => {
    if (current() === lang) settle(text)
  }
  loadHonorDuelText(lang).then(done, () => done(null))
}

/** The text in the reader's skill-text language. Read after mount, so a
 * pre-rendered page carries none; null until it arrives and where the data
 * pack holds none for the language. */
export function useDuelText(): ShallowRef<HonorDuelText | null> {
  const i18n = useI18nStore()
  const text = shallowRef<HonorDuelText | null>(null)
  onMounted(() =>
    watch(
      () => i18n.effectiveSkillLocale,
      (lang) =>
        loadFor(
          lang,
          () => i18n.effectiveSkillLocale,
          (loaded) => (text.value = loaded),
        ),
      { immediate: true },
    ),
  )
  return text
}

/** A popup's text, in its own skill-text language (`applied` of
 * useModalSkillLocale). The text trails `applied` by its chunk load, so a
 * switch keeps the previous language's text, named by `lang`, until the next
 * arrives. Null until the first load settles; `text` is null where the data
 * pack holds none for the language. */
export function useModalDuelText(
  applied: Readonly<Ref<SkillLocale | null>>,
): Readonly<ShallowRef<{ lang: SkillLocale; text: HonorDuelText | null } | null>> {
  const loaded = shallowRef<{ lang: SkillLocale; text: HonorDuelText | null } | null>(null)
  watch(
    applied,
    (lang) => {
      if (lang)
        loadFor(
          lang,
          () => applied.value,
          (text) => (loaded.value = { lang, text }),
        )
    },
    { immediate: true },
  )
  return loaded
}
