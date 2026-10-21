<script setup lang="ts">
/* The unit picker an import review opens on a tile of its screenshot, placed
   in a positioned box around the drawn board. A click inside it stops there,
   so a review closing it on clicks elsewhere leaves it open. */

import type { PickerItem, TilePicker } from '@/composables/useTilePlacing'
import { useUnitLabels } from '@/composables/useUnitLabels'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  picker: TilePicker
  items: { heroes: readonly PickerItem[]; extras: readonly PickerItem[] }
  pickedHere: number | null
}>()

const emit = defineEmits<{ pick: [unitId: number | null] }>()

const i18n = useI18nStore()
const { unitName, unitImage } = useUnitLabels()
</script>

<template>
  <div
    class="picker"
    :style="{ '--tile-x': `${picker.left * 100}%`, top: `${picker.top * 100}%` }"
    role="menu"
    :aria-label="i18n.t('app.import-tile', { tile: picker.hexId })"
    @click.stop
  >
    <span class="picker-head">{{ i18n.t('app.import-tile', { tile: picker.hexId }) }}</span>
    <div class="picker-heroes">
      <button
        v-for="item in items.heroes"
        :key="item.unitId"
        type="button"
        class="picker-item hero"
        :class="{ on: item.unitId === pickedHere }"
        role="menuitem"
        @click="emit('pick', item.unitId)"
      >
        <img class="picker-portrait" :src="unitImage(item.unitId)" alt="" />
        <span class="picker-name">{{ unitName(item.unitId) }}</span>
        <span v-if="item.tile !== null && item.tile !== picker.hexId" class="picker-tile">
          {{ item.tile }}
        </span>
      </button>
    </div>
    <div v-if="items.extras.length" class="picker-extras">
      <button
        v-for="item in items.extras"
        :key="item.unitId"
        type="button"
        class="picker-item extra"
        :class="{ on: item.unitId === pickedHere }"
        role="menuitem"
        :title="unitName(item.unitId)"
        :aria-label="unitName(item.unitId)"
        @click="emit('pick', item.unitId)"
      >
        <img class="picker-portrait" :src="unitImage(item.unitId)" alt="" />
      </button>
    </div>
    <button
      v-if="pickedHere !== null"
      type="button"
      class="picker-item clear"
      role="menuitem"
      @click="emit('pick', null)"
    >
      {{ i18n.t('app.import-clear-tile') }}
    </button>
  </div>
</template>

<style scoped>
.picker {
  --picker-half: min(162px, 50%);
  position: absolute;
  z-index: 2;
  left: clamp(var(--picker-half), var(--tile-x), calc(100% - var(--picker-half)));
  width: max-content;
  max-width: calc(2 * var(--picker-half));
  transform: translate(-50%, 12px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--import-border-strong);
  border-radius: var(--radius-medium);
  background: rgba(20, 22, 28, 0.96);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.picker-head {
  padding: 2px 6px 4px;
  font-size: 0.7rem;
  color: var(--import-label);
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-small);
  background: none;
  color: var(--import-text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.picker-item:hover,
.picker-item:focus-visible {
  background: var(--import-surface-hover);
  outline: none;
}

.picker-item.on {
  background: var(--import-surface);
  font-weight: 700;
}

.picker-item.clear {
  justify-content: center;
  color: var(--import-bad);
}

.picker-heroes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: calc(5 * 58px + 4 * 4px);
}

.picker-item.hero {
  position: relative;
  flex-direction: column;
  gap: 3px;
  width: 58px;
  padding: 5px 2px;
}

.picker-item.hero .picker-name {
  max-width: 100%;
  font-size: 0.68rem;
  text-align: center;
}

.picker-item.hero .picker-tile {
  position: absolute;
  top: 2px;
  right: 4px;
  padding: 0 4px;
  border-radius: var(--radius-small);
  background: var(--import-surface-hover);
  color: var(--import-text);
}

.picker-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px solid var(--import-border);
}

.picker-item.extra {
  padding: 3px;
}

.picker-portrait {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
  background: var(--import-surface);
}

.picker-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-tile {
  font-size: 0.7rem;
  color: var(--import-text-dim);
  font-variant-numeric: tabular-nums;
}
</style>
