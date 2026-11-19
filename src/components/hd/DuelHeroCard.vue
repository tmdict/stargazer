<script setup lang="ts">
/* The hero card of an Honor Duel board: the Arena's panel of portraits and
   names, with each unit's tier in place of its upgrades, its equipment slot
   and its Trial mark. What a unit carries, and whether a hero is its normal
   or its Trial copy, is set here and shows on the board. */

import { ref } from 'vue'

import DuelPiecePicker, { type DuelPiecePick } from './DuelPiecePicker.vue'
import DuelPieceSlot from './DuelPieceSlot.vue'
import DuelTierPill from './DuelTierPill.vue'
import DuelTrialToggle from './DuelTrialToggle.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import { isTrialHeroId } from '@/lib/characters/trial'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import { duelOtherCopy, swapDuelCopy } from '@/stores/duelBoard'
import type { GridContext } from '@/stores/gridContext'
import { below } from '@/utils/popupLayout'

defineProps<{
  context: GridContext
  readonly?: boolean
}>()

const picking = ref<DuelPiecePick | null>(null)
</script>

<template>
  <TeamPowerPanel :context :show-upgrades="false" :readonly>
    <template #mark="{ team, hero }">
      <DuelTrialToggle
        class="trial-mark"
        :trial="isTrialHeroId(hero.characterId)"
        :fixed="readonly || duelOtherCopy(context, team, hero.characterId) === null"
        @toggle="swapDuelCopy(context, team, hero.characterId)"
      />
    </template>
    <template #pill="{ team, hero }">
      <DuelTierPill
        class="tier"
        :unit-id="hero.characterId"
        :tier="context.getAttr(team, hero.characterId, DUEL_ATTR_TIER)"
        :readonly
        @pick="context.setAttr(team, hero.characterId, DUEL_ATTR_TIER, $event)"
      />
    </template>
    <template #controls="{ team, hero }">
      <DuelPieceSlot
        class="piece"
        :piece="context.getAttr(team, hero.characterId, DUEL_ATTR_EQUIPMENT)"
        :readonly
        @open="picking = { team, unitId: hero.characterId, position: below($event) }"
      />
    </template>
  </TeamPowerPanel>
  <DuelPiecePicker v-model="picking" :context />
</template>

<style scoped>
.trial-mark {
  --badge-size: 16px;
  --badge-border: 1.5px;
  --slot-fill: var(--color-bg-raised);
  position: absolute;
  top: 0;
  right: 0;
}

.tier {
  margin-top: -7px;
}

.piece {
  --badge-size: 24px;
  --badge-border: 1.5px;
}
</style>
