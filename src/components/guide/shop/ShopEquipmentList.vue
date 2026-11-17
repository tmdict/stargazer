<script setup lang="ts">
/* Honor Duel equipment by tier, to pick one piece from, with a name search
   over the site's languages and Enter to take its single match: the pieces the
   shop sells, or every piece of the mode. */

import { computed, ref } from 'vue'

import ShopPieceDisc from './ShopPieceDisc.vue'
import PaletteSearch from '@/components/ui/PaletteSearch.vue'
import { duelEquipment, duelItemName, equipmentTierLabel } from '@/lib/hd/catalog'
import { EQUIPMENT_TIERS, type EquipmentTier } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { matchesPiece } from './shopGoods'

const {
  tier,
  taken = [],
  all = false,
  clearable = false,
} = defineProps<{
  // The one tier to list; every tier when left out.
  tier?: EquipmentTier
  // Pieces already picked, which are left out.
  taken?: readonly string[]
  // The pieces the shop never sells too.
  all?: boolean
  // Lists None first, for a pick that can take a piece off.
  clearable?: boolean
}>()

const emit = defineEmits<{ pick: [name: string]; clear: [] }>()

const i18n = useI18nStore()

const query = ref('')

const groups = computed(() =>
  EQUIPMENT_TIERS.filter((one) => !tier || one === tier)
    .map((one) => ({
      tier: one,
      title: equipmentTierLabel(one, i18n.currentLocale),
      pieces: duelEquipment
        .filter(
          (piece) =>
            (all || piece.shop) &&
            piece.tier === one &&
            !taken.includes(piece.name) &&
            matchesPiece(piece, query.value),
        )
        .map((item) => ({
          name: item.name,
          label: duelItemName({ kind: 'equipment', item }, i18n.currentLocale),
        })),
    }))
    .filter((group) => group.pieces.length > 0),
)

const only = computed(() => {
  const pieces = groups.value.flatMap((group) => group.pieces)
  return query.value.trim() && pieces.length === 1 ? pieces[0]!.name : null
})

const takeOnly = (): void => {
  if (only.value) emit('pick', only.value)
}
</script>

<template>
  <PaletteSearch
    v-model="query"
    :placeholder="i18n.t('app.shop-search-equipment')"
    @enter="takeOnly"
  />
  <div class="shop-equipment">
    <button
      v-if="clearable && !query.trim()"
      type="button"
      class="shop-pill-button none"
      @click="emit('clear')"
    >
      {{ i18n.t('app.none') }}
    </button>
    <section v-for="group in groups" :key="group.tier" :class="`shop-tier-${group.tier}`">
      <h3 v-if="!tier">{{ group.title }}</h3>
      <div class="pieces">
        <button
          v-for="piece in group.pieces"
          :key="piece.name"
          type="button"
          class="piece"
          :class="{ only: piece.name === only }"
          @click="emit('pick', piece.name)"
        >
          <ShopPieceDisc :name="piece.name" :size="60" />
          <span class="label">{{ piece.label }}</span>
        </button>
      </div>
    </section>
    <p v-if="!groups.length" class="shop-no-matches">{{ i18n.t('app.shop-no-matches') }}</p>
  </div>
</template>

<style scoped>
.shop-equipment {
  --disc-ring: rgba(255, 255, 255, 0.5);
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.none {
  align-self: flex-start;
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

.piece:hover,
.piece.only {
  background: rgba(255, 255, 255, 0.1);
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
