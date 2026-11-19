<script setup lang="ts">
/* A hero's equipment slot: the piece it holds as a round picture, or an empty
   slot. A tap asks for the picker. The host sets the size (--badge-size,
   --badge-border), and may fill an empty slot that sits over a picture
   (--slot-fill). */

import { computed } from 'vue'

import DuelSlot from './DuelSlot.vue'
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
  <DuelSlot v-if="held || !readonly" :label :empty="!held" :readonly @press="open">
    <UnitBadge v-if="held" :color="held.backdrop">
      <img v-if="held.image" :src="held.image" alt="" draggable="false" />
    </UnitBadge>
    <IconPlus v-else :size="11" />
  </DuelSlot>
</template>
