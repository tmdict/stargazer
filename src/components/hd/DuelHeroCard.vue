<script setup lang="ts">
/* The hero card of an Honor Duel board: the Arena's panel of portraits and
   names, with each hero's tier in place of its upgrades, its equipment slot
   and a mark on a Trial hero. What a hero carries is set here and shows on its
   portrait on the board. */

import { ref } from 'vue'

import DuelPieceSlot from './DuelPieceSlot.vue'
import DuelTierPill from './DuelTierPill.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import UnitBadge from '@/components/grid/UnitBadge.vue'
import { below } from '@/components/guide/shop/popupLayout'
import { isTrialHeroId } from '@/lib/characters/trial'
import { DUEL_ATTR_EQUIPMENT, DUEL_ATTR_TIER } from '@/lib/hd/board'
import type { Point } from '@/lib/layout'
import type { Team } from '@/lib/types/team'
import { setDuelEquipment } from '@/stores/duelBoard'
import type { GridContext } from '@/stores/gridContext'
import { useI18nStore } from '@/stores/i18n'
import { defineLazyComponent } from '@/utils/lazyComponent'

const props = defineProps<{
  context: GridContext
  readonly?: boolean
}>()

const i18n = useI18nStore()

const DuelEquipmentPopup = defineLazyComponent(() => import('./DuelEquipmentPopup.vue'))

// The hero whose equipment picker is open.
const picking = ref<{ team: Team; unitId: number; position: Point } | null>(null)

const pieceOf = (team: Team, unitId: number): number =>
  props.context.getAttr(team, unitId, DUEL_ATTR_EQUIPMENT)

const pick = (piece: number): void => {
  const hero = picking.value
  if (hero) setDuelEquipment(props.context, hero.team, hero.unitId, piece)
  picking.value = null
}
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
        {{ [...i18n.t('app.trial')][0] }}
      </UnitBadge>
    </template>
    <template #pill="{ team, hero }">
      <DuelTierPill
        :unit-id="hero.characterId"
        :tier="context.getAttr(team, hero.characterId, DUEL_ATTR_TIER)"
        :readonly
        @pick="context.setAttr(team, hero.characterId, DUEL_ATTR_TIER, $event)"
      />
    </template>
    <template #controls="{ team, hero }">
      <DuelPieceSlot
        :piece="pieceOf(team, hero.characterId)"
        :readonly
        @open="picking = { team, unitId: hero.characterId, position: below($event) }"
      />
    </template>
  </TeamPowerPanel>
  <DuelEquipmentPopup
    v-if="picking"
    :position="picking.position"
    :clearable="pieceOf(picking.team, picking.unitId) !== 0"
    @pick="pick"
    @close="picking = null"
  />
</template>

<style scoped>
.trial-mark {
  --badge-size: 16px;
  --badge-border: 1.5px;
  position: absolute;
  top: 0;
  right: 0;
}
</style>
