<script setup lang="ts">
/* The Honor Duel list: the mode's artifacts, then its equipment by tier, each
   piece on its tier's backdrop. Nothing here goes on a board, so a click opens
   the item's details, as the inspect gesture (right-click, hold) does, and
   hovering shows its effect. */

import { computed, onMounted, shallowRef, watch } from 'vue'

import HonorDuelTooltip from './HonorDuelTooltip.vue'
import HoldRing from '@/components/ui/HoldRing.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import {
  duelArtifacts,
  duelEquipment,
  duelItemImage,
  duelItemName,
  equipmentTierLabel,
  loadHonorDuelText,
} from '@/lib/hd/catalog'
import { EQUIPMENT_TIERS, type HonorDuelItem, type HonorDuelText } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'
import { tierBackdrop } from '@/utils/tierBackdrop'

const { scrollable = true } = defineProps<{
  // See CharacterSelection: off when the picker flows in normal page height.
  scrollable?: boolean
}>()

const i18n = useI18nStore()
const { inspect } = useInspect()

// One shared card follows the hovered icon; the icons are action triggers
// (a tap opens the details), so touch gets none.
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

// The card's text, in the skill-text language as in the details popup. Read
// after mount, so the pre-rendered page carries none; null where the data pack
// holds none for the language.
const text = shallowRef<HonorDuelText | null>(null)
onMounted(() =>
  watch(
    () => i18n.effectiveSkillLocale,
    (lang) => {
      const settle = (loaded: HonorDuelText | null) => {
        if (i18n.effectiveSkillLocale === lang) text.value = loaded
      }
      loadHonorDuelText(lang).then(settle, () => settle(null))
    },
    { immediate: true },
  ),
)

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
        <button
          v-for="{ item, name, image, backdrop } in group.items"
          :key="item.item.id"
          type="button"
          class="seasonal-cell duel-item"
          @click="open(item)"
          @pointerdown="startHold($event, item)"
          @contextmenu="onContextMenu($event, item)"
          @mouseenter="onMouseEnter($event, item)"
          @mouseleave="onMouseLeave"
        >
          <span class="icon-disc-frame">
            <span class="duel-icon round-icon" :style="{ background: backdrop }">
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
        </button>
      </div>
    </section>

    <HonorDuelTooltip
      v-if="hovered && hoveredEl"
      :item="hovered"
      :target-element="hoveredEl"
      :text="hoveredText"
    />
  </div>
</template>

<style scoped>
.duel-item {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
}

.duel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
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
