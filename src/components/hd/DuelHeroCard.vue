<script setup lang="ts">
/* The hero card of an Honor Duel board: the Arena's panel of portraits and
   names, with each hero's tier in place of its upgrades and a mark on a Trial
   hero. What a hero carries is set here and shows on its portrait on the
   board. */

import DuelTierPill from './DuelTierPill.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import UnitBadge from '@/components/grid/UnitBadge.vue'
import { isTrialHeroId } from '@/lib/characters/trial'
import { DUEL_ATTR_TIER } from '@/lib/hd/board'
import type { GridContext } from '@/stores/gridContext'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  context: GridContext
  readonly?: boolean
}>()

const i18n = useI18nStore()
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
  </TeamPowerPanel>
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
