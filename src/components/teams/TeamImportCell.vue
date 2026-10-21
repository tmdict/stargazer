<script setup lang="ts">
/* One reading in an import review's grid: the card as the screenshot shows
   it beside the unit it is taken for, the control naming that unit, and a
   meta row. The parent sets the look with classes on it: the reading's state
   (review, paragon, refinement, none, duplicate), `unit` for a formation
   portrait's square crop, and `missing` with `next` or `unplaced` for a unit
   the screenshot misses, whose `next` border takes the side's `--pick-colour`. */

defineProps<{
  // The card's crop, empty when the screenshot shows none.
  card: string
  portrait: string | null
}>()
</script>

<template>
  <div class="cell">
    <div class="cell-images">
      <img v-if="card" class="cell-card" :src="card" alt="" />
      <span v-else class="cell-card empty" />
      <img v-if="portrait !== null" class="cell-portrait" :src="portrait" alt="" />
      <span v-else class="cell-portrait empty" />
    </div>
    <slot name="name" />
    <div class="cell-meta">
      <slot name="meta" />
    </div>
  </div>
</template>

<style scoped>
.cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
  background: var(--import-surface);
}

.cell.review,
.cell.paragon,
.cell.refinement,
.cell.missing.unplaced {
  border-color: var(--import-warn);
  background: var(--import-warn-tint);
}

.cell.missing.next {
  border-color: var(--pick-colour);
}

.cell.none,
.cell.duplicate {
  border-color: var(--import-bad);
  background: var(--import-bad-tint);
}

.cell-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.cell-card,
.cell-portrait {
  display: block;
  width: 100%;
  aspect-ratio: 74 / 104;
  object-fit: cover;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.cell-card.empty,
.cell-portrait.empty {
  background: rgba(255, 255, 255, 0.06);
}

.cell.unit .cell-card,
.cell.unit .cell-portrait {
  aspect-ratio: 1;
  object-position: top;
}

:slotted(.cell-name) {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}

:slotted(.cell-name:hover),
:slotted(.cell-name:focus-visible),
:slotted(.cell-name.open) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.cell-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

@media (pointer: coarse) {
  :slotted(.cell-name) {
    padding: 8px 6px;
  }
}
</style>
