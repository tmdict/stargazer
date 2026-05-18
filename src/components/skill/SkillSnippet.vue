<script setup lang="ts">
import { computed, inject } from 'vue'

import { loadAppLocales } from '@/utils/dataLoader'
import { SkillLangKey } from './snippetKeys'

// Callout wrapper inside a hero's snippet file. `titleKey` / `bodyKey` resolve
// against `src/locales/app/<key>.json` using the lang injected by
// <SkillSections>; use them for reusable boilerplate ("how-it-works",
// "tile-positional-buff") so shared copy lives in one place.

const props = defineProps<{
  title?: string
  titleKey?: string
  bodyKey?: string
}>()

const lang = inject(
  SkillLangKey,
  computed(() => 'en' as const),
)

const resolvedTitle = computed(() => {
  if (props.titleKey) {
    return loadAppLocales()[props.titleKey]?.[lang.value] ?? props.titleKey
  }
  return props.title ?? ''
})

const resolvedBody = computed(() => {
  if (!props.bodyKey) return ''
  return loadAppLocales()[props.bodyKey]?.[lang.value] ?? props.bodyKey
})
</script>

<template>
  <section class="skill-snippet">
    <h3 v-if="resolvedTitle" class="skill-snippet-title">{{ resolvedTitle }}</h3>
    <div class="skill-snippet-body">
      <slot />
      <p v-if="resolvedBody">{{ resolvedBody }}</p>
    </div>
  </section>
</template>

<style scoped>
.skill-snippet {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid rgba(95, 196, 187, 0.4);
  background: rgba(140, 185, 180, 0.04);
  border-radius: 0 4px 4px 0;
}

.skill-snippet-title {
  margin: 0 0 var(--spacing-xs);
  padding: 0;
  border-bottom: none;
  font-size: 13px;
  font-weight: 600;
  color: #5fc4bb;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Body text matches `.skill-level-desc` default so it reads as a peer to
   the surrounding skill description text. */
.skill-snippet-body :deep(p) {
  margin: 0;
  line-height: 1.55;
}

.skill-snippet-body :deep(p + p) {
  margin-top: var(--spacing-xs);
}
</style>
