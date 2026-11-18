<script setup lang="ts">
/* A hero's equipment slot in the hero card: the piece it holds as the round
   picture its portrait carries on the board, or an empty slot. A tap asks for
   the picker. */

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
  --badge-size: 24px;
  --badge-border: 1.5px;
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
