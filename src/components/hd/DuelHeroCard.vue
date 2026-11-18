<script setup lang="ts">
/* The hero card of an Honor Duel board: the Arena's panel of portraits and
   names, with each unit's tier in place of its upgrades, its equipment slot
   and a mark on a Trial unit. What a unit carries is set here and shows on
   the board. */

import { ref } from 'vue'

import DuelPiecePicker, { type DuelPiecePick } from './DuelPiecePicker.vue'
import DuelPieceSlot from './DuelPieceSlot.vue'
import DuelTierPill from './DuelTierPill.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import UnitBadge from '@/components/grid/UnitBadge.vue'
import { below } from '@/components/guide/shop/popupLayout'
import { isTrialHeroId } from '@/lib/characters/trial'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import type { GridContext } from '@/stores/gridContext'
import { useI18nStore } from '@/stores/i18n'
import { initialOf } from '@/utils/nameFormatting'

defineProps<{
  context: GridContext
  readonly?: boolean
}>()

const i18n = useI18nStore()

const picking = ref<DuelPiecePick | null>(null)
</script>

<template>
  <TeamPowerPanel :context :show-upgrades="false" :readonly>
    <template #mark="{ hero }">
      <UnitBadge
        v-if="isTrialHeroId(hero.characterId)"
        class="trial-mark"
        color="var(--duel-trial-mark)"
        :title="i18n.t('app.trial')"
      >
        {{ initialOf(i18n.t('app.trial')) }}
      </UnitBadge>
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
