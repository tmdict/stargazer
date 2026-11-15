<script setup lang="ts">
/* The Honor Duel list: the mode's equipment by tier, then its artifacts.
   Nothing here goes on a board, so a click opens the item's details, as the
   inspect gesture (right-click, hold) does. */

import { computed } from 'vue'

import HoldRing from '@/components/ui/HoldRing.vue'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import {
  duelArtifacts,
  duelEquipment,
  duelItemImage,
  duelItemName,
  equipmentTierLabel,
} from '@/lib/honorDuel'
import { EQUIPMENT_TIERS, type HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'

const { scrollable = true } = defineProps<{
  // See CharacterSelection: off when the picker flows in normal page height.
  scrollable?: boolean
}>()

const i18n = useI18nStore()
const { inspect } = useInspect()

const open = (item: HonorDuelItem) => void inspect({ kind: 'honorDuel', item })
const { pressing, start: startHold, onContextMenu } = useLongPress<HonorDuelItem>(open)

const groups = computed(() => {
  const locale = i18n.currentLocale
  return [
    ...EQUIPMENT_TIERS.map((tier) => ({
      key: tier,
      title: equipmentTierLabel(tier, locale),
      items: duelEquipment
        .filter((item) => item.tier === tier)
        .map((item): HonorDuelItem => ({ kind: 'equipment', item })),
    })),
    {
      key: 'artifact',
      title: gameLabel('duel-artifact', locale),
      items: duelArtifacts.map((item): HonorDuelItem => ({ kind: 'artifact', item })),
    },
  ]
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        item,
        name: duelItemName(item, locale),
        image: duelItemImage(item),
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
      <h3 class="icon-group-title">{{ group.title }}</h3>
      <div class="icon-grid">
        <button
          v-for="{ item, name, image } in group.items"
          :key="item.item.id"
          type="button"
          class="icon-cell duel-item"
          @click="open(item)"
          @pointerdown="startHold($event, item)"
          @contextmenu="onContextMenu($event, item)"
        >
          <span class="duel-icon">
            <img
              v-if="image"
              :src="image"
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            />
            <HoldRing v-if="pressing === item" />
          </span>
          <span class="icon-cell-name">{{ name }}</span>
        </button>
      </div>
    </section>
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  margin-top: var(--spacing-xs);
  transition: transform var(--transition-fast);
}

.duel-icon img {
  max-width: 100%;
  max-height: 100%;
}

.duel-item:hover .duel-icon {
  transform: scale(1.05);
}

@media (max-width: 480px) {
  .duel-icon {
    width: var(--hero-icon-size);
    height: var(--hero-icon-size);
  }
}
</style>
