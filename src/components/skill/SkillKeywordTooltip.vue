<script setup lang="ts">
/* Tooltip host for the glossary keywords in skill text ([[label|key]] tokens,
   rendered by highlightSkillText as `[data-kw]` spans). The spans live in
   v-html output, so per-span bindings are impossible: one host per
   SkillSections delegates on the article container and feeds useInfoTip the
   resolved span. */

import { computed, onUnmounted, watch } from 'vue'

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import type { SkillLocale } from '@/lib/types/i18n'
import { getSkillKeywords } from '@/utils/dataLoader'

const props = defineProps<{
  // Language of the surrounding skill text; the glossary follows the same en
  // fallback SkillSections applies to the text itself.
  lang: SkillLocale
  // The rendered skill content root the [data-kw] spans live under.
  container: HTMLElement | null
}>()

const {
  anchor,
  payload: kwKey,
  hoverOpen,
  hoverClose,
  toggle,
  onTouchStart,
  close,
} = useInfoTip<string>()

const tip = computed(() => {
  if (!kwKey.value) return null
  const glossary = getSkillKeywords(props.lang) ?? getSkillKeywords('en')
  return glossary?.[kwKey.value] ?? null
})

const keywordAt = (e: Event): HTMLElement | null => {
  const target = e.target
  return target instanceof Element ? target.closest<HTMLElement>('[data-kw]') : null
}

const onMouseOver = (e: Event): void => {
  const el = keywordAt(e)
  if (el) hoverOpen(el, el.dataset.kw ?? '')
}

const onClick = (e: Event): void => {
  const el = keywordAt(e)
  if (el) toggle(el, el.dataset.kw ?? '')
}

// The spans are rendered with tabindex + role="button" (highlightSkillText),
// so keyboard users can reach the glossary: focus shows it, Enter/Space
// toggles.
const onFocusIn = (e: Event): void => {
  const el = keywordAt(e)
  if (el) hoverOpen(el, el.dataset.kw ?? '')
}

const onKeyDown = (e: Event): void => {
  const key = (e as KeyboardEvent).key
  if (key !== 'Enter' && key !== ' ') return
  const el = keywordAt(e)
  if (!el) return
  e.preventDefault()
  toggle(el, el.dataset.kw ?? '')
}

const listeners: [string, EventListener, AddEventListenerOptions?][] = [
  ['mouseover', onMouseOver],
  // While a tip is open the pointer is on its span, so any mouseout in the
  // container means the span was left. Touch-opened tips are unaffected: on
  // touch the dismissal is the outside press.
  ['mouseout', hoverClose],
  ['click', onClick],
  ['focusin', onFocusIn],
  ['focusout', hoverClose],
  ['keydown', onKeyDown],
  ['touchstart', onTouchStart, { passive: true }],
]

watch(
  () => props.container,
  (el, prev) => {
    for (const [type, handler, opts] of listeners) {
      prev?.removeEventListener(type, handler, opts)
      el?.addEventListener(type, handler, opts)
    }
    // A swapped container orphans any open tip's anchor.
    close()
  },
  { immediate: true },
)

onUnmounted(() => {
  for (const [type, handler, opts] of listeners) {
    props.container?.removeEventListener(type, handler, opts)
  }
})
</script>

<template>
  <Teleport v-if="anchor && tip" to="body">
    <TooltipPopup :target-element="anchor" variant="detailed" max-width="320px">
      <template #content>
        <div class="keyword-tip">{{ tip }}</div>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.keyword-tip {
  /* Game tooltip strings carry literal newlines. */
  white-space: pre-line;
}
</style>
