<script setup lang="ts">
/* The box beside a unit in an import review's list where its tile number is
   typed; the parent listens for change and Enter on it. */

defineProps<{
  tile: number | null
  label: string
}>()
</script>

<template>
  <input
    class="tile-box"
    :class="{ unplaced: tile === null }"
    type="text"
    inputmode="numeric"
    maxlength="2"
    :value="tile ?? ''"
    :aria-label="label"
  />
</template>

<style scoped>
.tile-box {
  width: 3.4em;
  flex: none;
  padding: 3px 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-small);
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: max(0.8rem, var(--field-min-font-size));
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.tile-box:focus-visible {
  border-color: var(--import-border-strong);
  outline: none;
}

.tile-box.unplaced {
  border-color: var(--import-warn);
}
</style>
