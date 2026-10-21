<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  heading?: string
  slotTags?: string[]
}>()

// Tag labels are in the app locale, whatever language the heading is in.
const i18n = useI18nStore()
</script>

<template>
  <header v-if="heading || slotTags?.length" class="skill-section-header">
    <h2 v-if="heading" class="skill-section-heading">{{ heading }}</h2>
    <span v-if="slotTags?.length" class="skill-section-tags" :lang="i18n.currentLocale">
      <span v-for="label in slotTags" :key="label" class="skill-section-tag">{{ label }}</span>
    </span>
  </header>
</template>

<style scoped>
.skill-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
}

.skill-section-heading {
  margin: 0;
  padding: 0;
  border-bottom: none;
}

/* The heading's capitals sit about half a pixel below the middle of its line
   box, so centered tags read high; 1px of top margin moves them down half a
   pixel, onto the capitals' middle. */
.skill-section-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 1px;
}

.skill-section-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
}
</style>
