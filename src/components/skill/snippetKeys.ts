import type { ComputedRef, InjectionKey, Ref } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'
import type { SlotKey } from '@/lib/types/skill'

// Teleport targets per slot. <SkillSnippets> reads this to route named slots
// into the matching <SkillSection>.
export const SkillSnippetAnchorsKey: InjectionKey<Record<SlotKey, Ref<HTMLElement | null>>> =
  Symbol('SkillSnippetAnchors')

// Computed so modal locale toggles propagate to descendant <SkillSnippet>s.
// Stays AppLocale: snippets resolve their strings from app locales (en/zh),
// so the provider passes the locale of the snippet file actually rendered.
export const SkillLangKey: InjectionKey<ComputedRef<AppLocale>> = Symbol('SkillLang')
