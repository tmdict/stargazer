<script setup lang="ts">
/* The Honor Duel board's picture: the tab's lists, and one hero as the board
   draws it under the pointer, as a normal copy and as a Trial copy a tier up. */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import DuelPieceSlot from '@/components/hd/DuelPieceSlot.vue'
import DuelTierPill from '@/components/hd/DuelTierPill.vue'
import DuelTrialToggle from '@/components/hd/DuelTrialToggle.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { DUEL_TIERS } from '@/lib/hd/board'
import { useGameDataStore } from '@/stores/gameData'
import { appLabel, gameLabel } from '@/utils/skillLabels'
import { tierBackdrop } from '@/utils/tierBackdrop'

const lang = useHelpLocale()
const gameData = useGameDataStore()

const lists = computed(() => [
  { key: 'units', label: appLabel('units', lang.value), selected: true },
  { key: 'artifact', label: gameLabel('duel-artifact', lang.value), selected: false },
  { key: 'equipment', label: gameLabel('equipment', lang.value), selected: false },
])

// Heroes the shop sells, which the list draws on the lowest tier's fill.
const LIST = ['valen', 'cecia', 'thoran', 'silvina', 'lily-may']
const HERO = 'valen'
const heroId = computed(() => gameData.characters.find((c) => c.name === HERO)?.id ?? 0)

// Positions in DUEL_TIERS.
const COPIES = [
  { key: 'normal', trial: false, tier: 0 },
  { key: 'trial', trial: true, tier: 1 },
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="appLabel('honor-duel', lang)">
        <div class="help-mock-bar centered">
          <SegmentedPicker small :segments="lists" />
        </div>
        <div class="help-duel-list">
          <GuideDisc v-for="slug in LIST" :key="slug" :size="34" :backdrop="tierBackdrop('epic')">
            <img :src="gameData.getCharacterImage(slug)" alt="" />
          </GuideDisc>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="appLabel('arena', lang)">
        <div class="help-duel-units">
          <span v-for="copy in COPIES" :key="copy.key" class="help-duel-unit">
            <GuideDisc :size="76" :backdrop="tierBackdrop(DUEL_TIERS[copy.tier]!)">
              <img :src="gameData.getCharacterImage(HERO)" alt="" />
            </GuideDisc>
            <span class="help-duel-mark piece"><DuelPieceSlot :piece="0" /></span>
            <span class="help-duel-mark trial">
              <DuelTrialToggle :trial="copy.trial" :lang />
            </span>
            <span class="help-duel-mark tier">
              <DuelTierPill :unit-id="heroId" :tier="copy.tier" :lang />
            </span>
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-duel-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding: 2px 0 4px;
}

.help-duel-units {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 22px 0 20px;
}

.help-duel-unit {
  --rim: 27px;
  --badge-size: 27px;
  --badge-border: 1.5px;
  --slot-fill: var(--color-bg-raised);
  position: relative;
  display: flex;
}

.help-duel-mark {
  position: absolute;
  top: calc(50% - var(--rim));
  left: calc(50% - var(--rim));
  z-index: 2;
  display: flex;
  transform: translate(-50%, -50%);
}

.help-duel-mark.piece {
  --badge-size: 35px;
}

.help-duel-mark.trial {
  left: calc(50% + var(--rim));
}

.help-duel-mark.tier {
  top: calc(50% + var(--rim));
}

.help-duel-mark.tier :deep(.duel-tier) {
  zoom: 1.25;
}
</style>
