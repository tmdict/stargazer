<script setup lang="ts">
defineProps<{
  heading?: string
  slotTags?: { name: string; label: string }[]
}>()
</script>

<template>
  <header v-if="heading || slotTags?.length" class="skill-section-header">
    <h2 v-if="heading" class="skill-section-heading">{{ heading }}</h2>
    <span v-if="slotTags?.length" class="skill-section-chips">
      <RouterLink
        v-for="tag in slotTags"
        :key="tag.name"
        class="skill-level-chip"
        :to="{ path: '/skills', query: { tag: tag.name } }"
        >{{ tag.label }}</RouterLink
      >
    </span>
  </header>
</template>

<style scoped>
/* Border lives on the wrapper (not the h2) so it spans full section width. */
.skill-section-header {
  display: flex;
  align-items: baseline;
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
  font-size: 18px;
  font-weight: 600;
}

.skill-section-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.skill-level-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
  text-decoration: none;
  transition: background-color 0.15s;
}

/* Override content.css's global `.content a:hover` (red + underline) so the
   chip just lifts its background and keeps its teal text. */
.skill-level-chip:hover {
  background: color-mix(in srgb, var(--color-accent) 28%, transparent);
  color: var(--color-accent);
  text-decoration: none;
}
</style>
