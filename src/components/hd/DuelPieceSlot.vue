<script setup lang="ts">
/* A hero's equipment slot: the piece it holds as a round picture, or an empty
   slot. A tap asks for the picker. The host sets the size (--badge-size,
   --badge-border), and may fill an empty slot that sits over a picture
   (--slot-fill). */

import { computed } from 'vue'

import UnitBadge from '@/components/grid/UnitBadge.vue'
import IconPlus from '@/components/ui/IconPlus.vue'
import { useDuelItems } from '@/composables/useDuelItems'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'

const { piece, readonly } = defineProps<{
  // The piece's id, 0 for none.
  piece: number
  readonly?: boolean
}>()

const emit = defineEmits<{ open: [under: DOMRect] }>()

const i18n = useI18nStore()
const { pieceOf } = useDuelItems()

const held = computed(() => pieceOf(piece))
const label = computed(() => held.value?.label ?? gameLabel('equipment', i18n.currentLocale))
const open = (event: MouseEvent): void =>
  emit('open', (event.currentTarget as HTMLElement).getBoundingClientRect())
</script>

<template>
  <component
    :is="readonly ? 'span' : 'button'"
    v-if="held || !readonly"
    :type="readonly ? undefined : 'button'"
    :role="readonly ? 'img' : undefined"
    class="piece-slot"
    :class="{ empty: !held, readonly }"
    :title="label"
    :aria-label="label"
    @click="!readonly && open($event)"
  >
    <UnitBadge v-if="held" :color="held.backdrop">
      <img v-if="held.image" :src="held.image" alt="" draggable="false" />
    </UnitBadge>
    <IconPlus v-else :size="11" />
  </component>
</template>

<style scoped>
.piece-slot {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--badge-size);
  height: var(--badge-size);
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.piece-slot.empty {
  border: 1.5px dashed var(--color-border-primary);
  background: var(--slot-fill, none);
}

.piece-slot.readonly {
  cursor: default;
}

@media (hover: hover) {
  .piece-slot:not(.readonly):hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
}

@media (pointer: coarse) {
  .piece-slot:not(.readonly)::after {
    content: '';
    position: absolute;
    inset: -6px;
  }
}
</style>
