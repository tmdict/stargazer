<script setup lang="ts">
/* The equipment the shop sells, by tier, to pick one piece from. */

import { computed } from 'vue'

import { duelEquipment, duelItemImage, duelItemName, equipmentTierLabel } from '@/lib/hd/catalog'
import { EQUIPMENT_TIERS, type EquipmentTier } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'

const { tier, taken = [] } = defineProps<{
  // The one tier to list; every tier the shop sells when left out.
  tier?: EquipmentTier
  // Pieces already picked, which are left out.
  taken?: readonly string[]
}>()

const emit = defineEmits<{ pick: [name: string] }>()

const i18n = useI18nStore()

const groups = computed(() =>
  EQUIPMENT_TIERS.filter((one) => !tier || one === tier)
    .map((one) => ({
      tier: one,
      title: equipmentTierLabel(one, i18n.currentLocale),
      pieces: duelEquipment
        .filter((piece) => piece.shop && piece.tier === one && !taken.includes(piece.name))
        .map((item) => ({
          name: item.name,
          label: duelItemName({ kind: 'equipment', item }, i18n.currentLocale),
          image: duelItemImage({ kind: 'equipment', item }),
        })),
    }))
    .filter((group) => group.pieces.length > 0),
)
</script>

<template>
  <div class="shop-equipment">
    <section v-for="group in groups" :key="group.tier" :class="`shop-tier-${group.tier}`">
      <h3 v-if="!tier">{{ group.title }}</h3>
      <div class="pieces">
        <button
          v-for="piece in group.pieces"
          :key="piece.name"
          type="button"
          class="piece"
          @click="emit('pick', piece.name)"
        >
          <span class="icon">
            <img v-if="piece.image" :src="piece.image" alt="" loading="lazy" draggable="false" />
          </span>
          <span class="label">{{ piece.label }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.shop-equipment {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h3 {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--shop-tier);
}

.pieces {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 4px;
}

.piece {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 4px 2px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: rgba(255, 255, 255, 0.85);
  font: inherit;
  cursor: pointer;
}

.piece:hover {
  background: rgba(255, 255, 255, 0.1);
}

.icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 2px var(--shop-tier);
}

.icon img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.label {
  max-width: 100%;
  overflow: hidden;
  overflow-wrap: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
}
</style>
