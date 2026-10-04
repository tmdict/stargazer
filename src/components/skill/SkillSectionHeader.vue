<script setup lang="ts">
// A heading chip: its label and the tag link it opens on `/skills`.
export interface SlotChip {
  label: string
  query: { tag: string; mods?: string }
}

defineProps<{
  heading?: string
  slotTags?: SlotChip[]
}>()
</script>

<template>
  <header v-if="heading || slotTags?.length" class="skill-section-header">
    <h2 v-if="heading" class="skill-section-heading">{{ heading }}</h2>
    <span v-if="slotTags?.length" class="skill-section-chips">
      <RouterLink
        v-for="chip in slotTags"
        :key="chip.label"
        class="skill-level-chip"
        :to="{ path: '/skills', query: chip.query }"
        >{{ chip.label }}</RouterLink
      >
    </span>
  </header>
</template>

<style scoped>
/* Border lives on the wrapper (not the h2) so it spans full section width. */
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
   box, so centered chips read high; 1px of top margin moves them down half a
   pixel, onto the capitals' middle. */
.skill-section-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 1px;
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
