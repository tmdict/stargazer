<script setup lang="ts">
/* The head of a section in an import review: its label, then the section's
   own details. */

defineProps<{ label: string }>()
</script>

<template>
  <div class="side-head">
    <span class="side-label">{{ label }}</span>
    <slot />
  </div>
</template>

<style scoped>
.side-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-sm);
}

.side-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--import-label);
}
</style>
