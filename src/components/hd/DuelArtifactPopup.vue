<script setup lang="ts">
/* The artifact picker of an Honor Duel board: the side's artifact with its
   level and that level's effect, then the mode's artifacts to pick from, with
   a name search over the site's languages and Enter to take its single match.
   The popup stays open on a pick, for the level to be set. */

import { computed, ref } from 'vue'

import DuelEffectText from './DuelEffectText.vue'
import DuelItemDisc from './DuelItemDisc.vue'
import ShopPickerPopup from '@/components/guide/shop/ShopPickerPopup.vue'
import ShopPopupClose from '@/components/guide/shop/ShopPopupClose.vue'
import PaletteSearch from '@/components/ui/PaletteSearch.vue'
import { useDuelText } from '@/composables/useDuelText'
import { DUEL_ARTIFACT_LEVELS, type DuelArtifactSlot } from '@/lib/hd/board'
import type { Point } from '@/lib/layout'
import type { DuelArtifact, HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import {
  duelArtifactById,
  duelArtifacts,
  duelItemName,
  duelLevelText,
  matchesDuelItem,
} from '@/utils/duelCatalog'
import { gameLabel } from '@/utils/skillLabels'

import '@/components/guide/shop/shop.css'

const { held } = defineProps<{
  position: Point
  held: DuelArtifactSlot | null
}>()

const emit = defineEmits<{ pick: [slot: DuelArtifactSlot | null]; close: [] }>()

const i18n = useI18nStore()
const text = useDuelText()

const view = (artifact: DuelArtifact) => {
  const item: HonorDuelItem = { kind: 'artifact', item: artifact }
  return { artifact, item, label: duelItemName(item, i18n.currentLocale) }
}

const LEVELS = Array.from({ length: DUEL_ARTIFACT_LEVELS }, (_, i) => i + 1)

const current = computed(() => {
  const artifact = held && duelArtifactById(held.id)
  if (!held || !artifact) return null
  const entry = text.value?.artifacts[artifact.name]
  return {
    ...view(artifact),
    level: held.level,
    effect: entry && duelLevelText(entry, held.level),
  }
})

const query = ref('')

const shown = computed(() =>
  duelArtifacts.map(view).filter(({ item }) => matchesDuelItem(item, query.value)),
)

// The one artifact a search leaves, which Enter takes.
const only = computed(() =>
  query.value.trim() && shown.value.length === 1 ? shown.value[0]!.artifact : null,
)

// A pick keeps the level the side's artifact stands at.
const pick = (artifact: DuelArtifact): void =>
  emit('pick', { id: artifact.id, level: current.value?.level ?? 1 })

const takeOnly = (): void => {
  if (only.value) pick(only.value)
}
</script>

<template>
  <ShopPickerPopup
    :label="gameLabel('duel-artifact', i18n.currentLocale)"
    :position
    @close="emit('close')"
  >
    <div class="shop-popup">
      <ShopPopupClose @close="emit('close')" />
      <section v-if="current" class="held">
        <div class="held-head">
          <DuelItemDisc :item="current.item" :size="44" />
          <span class="held-name">{{ current.label }}</span>
          <button type="button" class="shop-pill-button" @click="emit('pick', null)">
            {{ i18n.t('app.none') }}
          </button>
        </div>
        <div class="levels" role="group" :aria-label="current.label">
          <button
            v-for="level in LEVELS"
            :key="level"
            type="button"
            class="shop-pill-button"
            :class="{ active: level === current.level }"
            :aria-pressed="level === current.level"
            @click="emit('pick', { id: current.artifact.id, level })"
          >
            {{ i18n.t('app.shop-level-short', { level }) }}
          </button>
        </div>
        <DuelEffectText v-if="current.effect" class="effect" :source="current.effect" />
      </section>
      <PaletteSearch v-model="query" :placeholder="i18n.t('app.search-label')" @enter="takeOnly" />
      <div class="artifacts shop-tiles">
        <button
          v-for="{ artifact, item, label } in shown"
          :key="artifact.id"
          type="button"
          class="shop-tile"
          :class="{ only: artifact === only, current: artifact === current?.artifact }"
          :aria-pressed="artifact === current?.artifact"
          @click="pick(artifact)"
        >
          <DuelItemDisc :item :size="60" />
          <span class="shop-tile-label">{{ label }}</span>
        </button>
      </div>
      <p v-if="!shown.length" class="shop-no-matches">{{ i18n.t('app.shop-no-matches') }}</p>
    </div>
  </ShopPickerPopup>
</template>

<style scoped>
.shop-popup {
  --disc-ring: rgba(255, 255, 255, 0.5);
}

.held {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 2px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}

.held-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 34px;
}

.held-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: break-word;
}

.levels {
  display: flex;
  gap: 6px;
}

.levels .active {
  border-color: #fff;
  background: #fff;
  color: #1a1a1a;
}

.effect {
  color: rgba(255, 255, 255, 0.88);
}

.artifacts {
  flex: none;
}

.shop-tile.current {
  background: rgba(255, 255, 255, 0.18);
}
</style>
