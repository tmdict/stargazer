<script setup lang="ts">
/* The Honor Duel list: the mode's artifacts, then its equipment by tier, each
   piece on its tier's backdrop. Hovering shows an item's effect, and the
   inspect gesture (right-click, hold) opens its details. So does a click,
   except beside an Honor Duel board, where an artifact's click places it or
   takes it off as on the Arena's list, and a piece can be dragged onto a
   unit. */

import { computed } from 'vue'

import HonorDuelTooltip from './HonorDuelTooltip.vue'
import HoldRing from '@/components/ui/HoldRing.vue'
import { useDuelPieceDrag } from '@/composables/useDuelPieceDrag'
import { useDuelText } from '@/composables/useDuelText'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { useSelectionState } from '@/composables/useSelectionState'
import {
  duelArtifactById,
  duelArtifacts,
  duelEquipment,
  duelItemImage,
  duelItemName,
  equipmentTierLabel,
} from '@/lib/hd/catalog'
import { EQUIPMENT_TIERS, type HonorDuelItem } from '@/lib/types/honorDuel'
import { duelArtifactSide, toggleDuelArtifact } from '@/stores/duelBoard'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'
import { tierBackdrop } from '@/utils/tierBackdrop'

const { scrollable = true } = defineProps<{
  // See CharacterSelection: off when the picker flows in normal page height.
  scrollable?: boolean
}>()

const i18n = useI18nStore()
const grids = useGrids()
const { fillOrder } = useSelectionState()
const { inspect } = useInspect()
const pieceDrag = useDuelPieceDrag()

const board = computed(() => (grids.active?.kind === 'honorDuel' ? grids.active : null))

// One shared card follows the hovered icon; the icons are action triggers
// (a tap places or opens the details), so touch gets none.
const {
  anchor: hoveredEl,
  payload: hovered,
  onMouseEnter,
  onMouseLeave,
} = useHoverTooltip<HonorDuelItem>()

const open = (item: HonorDuelItem) => {
  onMouseLeave()
  void inspect({ kind: 'honorDuel', item })
}
const { pressing, start: startHold, onContextMenu } = useLongPress<HonorDuelItem>(open)

const handleClick = (item: HonorDuelItem): void => {
  if (board.value && item.kind === 'artifact')
    toggleDuelArtifact(board.value, item.item.id, fillOrder, (id) => !!duelArtifactById(id))
  else open(item)
}

const isPlaced = (item: HonorDuelItem): boolean =>
  !!board.value &&
  item.kind === 'artifact' &&
  duelArtifactSide(board.value, item.item.id, fillOrder) !== null

// A piece needs a unit to go to, so it is dragged onto one.
const isDraggable = (item: HonorDuelItem): boolean => !!board.value && item.kind === 'equipment'

const handleDragStart = (event: DragEvent, item: HonorDuelItem): void => {
  onMouseLeave()
  pieceDrag.start(event, item.item.id)
}

const text = useDuelText()

const hoveredText = computed(() => {
  const item = hovered.value
  if (!item || !text.value) return undefined
  return item.kind === 'equipment'
    ? text.value.equipment[item.item.name]
    : text.value.artifacts[item.item.name]
})

const groups = computed(() => {
  const locale = i18n.currentLocale
  return [
    {
      key: 'artifact',
      title: gameLabel('duel-artifact', locale),
      items: duelArtifacts.map((item): HonorDuelItem => ({ kind: 'artifact', item })),
    },
    ...EQUIPMENT_TIERS.map((tier) => ({
      key: tier,
      title: equipmentTierLabel(tier, locale),
      items: duelEquipment
        .filter((item) => item.tier === tier)
        .map((item): HonorDuelItem => ({ kind: 'equipment', item })),
    })),
  ]
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        item,
        name: duelItemName(item, locale),
        image: duelItemImage(item),
        backdrop: item.kind === 'equipment' ? tierBackdrop(item.item.tier) : undefined,
      })),
    }))
})
</script>

<template>
  <div
    v-scroll-chain
    class="honor-duel-selection icon-groups panel-min-height"
    :class="{ 'panel-fill': scrollable }"
  >
    <section v-for="group in groups" :key="group.key" class="icon-group">
      <h3 class="seasonal-title">{{ group.title }}</h3>
      <div class="seasonal-cells">
        <!-- Not a button: Firefox starts no drag from inside one. -->
        <div
          v-for="{ item, name, image, backdrop } in group.items"
          :key="item.item.id"
          class="seasonal-cell duel-item inspectable"
          role="button"
          tabindex="0"
          @click="handleClick(item)"
          @keydown.enter.space.prevent="!$event.repeat && handleClick(item)"
          @pointerdown="startHold($event, item)"
          @contextmenu="onContextMenu($event, item)"
          @mouseenter="onMouseEnter($event, item)"
          @mouseleave="onMouseLeave"
        >
          <span class="icon-disc-frame">
            <span
              class="duel-icon round-icon"
              :class="{ 'greyed-out': isPlaced(item) }"
              :style="{ background: backdrop }"
              :draggable="isDraggable(item)"
              @dragstart="handleDragStart($event, item)"
            >
              <img
                v-if="image"
                :src="image"
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
              />
            </span>
            <HoldRing v-if="pressing === item" />
          </span>
          <span class="seasonal-cell-name">{{ name }}</span>
        </div>
      </div>
    </section>

    <HonorDuelTooltip
      v-if="hovered && hoveredEl"
      :item="hovered"
      :target-element="hoveredEl"
      :text="hoveredText"
      :hint="board && hovered.kind === 'artifact' ? i18n.t('app.hold-for-details') : undefined"
    />
  </div>
</template>

<style scoped>
.duel-item {
  cursor: pointer;
}

.duel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
}

.duel-icon[draggable='true'] {
  cursor: grab;
}

.duel-icon[draggable='true']:active {
  cursor: grabbing;
}

.duel-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.duel-item:hover .duel-icon {
  transform: scale(1.05);
}
</style>
