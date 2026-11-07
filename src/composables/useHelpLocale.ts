/* The language Help's pictures draw their labels in, set by the page that
   shows them: Help passes its address language, and What's New passes English,
   which it turns into rune shapes. Pages without a language in the address
   would otherwise draw English labels for every reader. */

import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'

const HelpLocaleKey: InjectionKey<Readonly<Ref<AppLocale>>> = Symbol('HelpLocale')

export function provideHelpLocale(locale: Readonly<Ref<AppLocale>>): void {
  provide(HelpLocaleKey, locale)
}

export function useHelpLocale(): Readonly<Ref<AppLocale>> {
  return inject(HelpLocaleKey, ref('en'))
}
