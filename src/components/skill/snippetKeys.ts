import type { ComputedRef, InjectionKey, Ref } from 'vue'

import type { SlotKey } from '@/lib/types/skill'

// Teleport targets per slot. <SkillSnippets> reads this to route named slots
// into the matching <SkillSection>.
export const SkillSnippetAnchorsKey: InjectionKey<Record<SlotKey, Ref<HTMLElement | null>>> =
  Symbol('SkillSnippetAnchors')

// Computed so modal locale toggles propagate to descendant <SkillSnippet>s.
export const SkillLangKey: InjectionKey<ComputedRef<'en' | 'zh'>> = Symbol('SkillLang')
