<script setup lang="ts">
/* One game's two team rows with VS between them, under the game's number in
   Match. */

import WwwTeamRow from './WwwTeamRow.vue'
import type { Point } from '@/lib/layout'
import type { WwwGame, WwwLevelAttr } from '@/lib/pvp/sl/www/match'
import type { TeamSide } from '@/lib/pvp/sl/www/panel'
import { useI18nStore } from '@/stores/i18n'

const { game, number, target } = defineProps<{
  game: WwwGame
  // From 1; null in One game, which shows no number.
  number: number | null
  // The slot the hero grid fills next, when it is in this game.
  target: { side: TeamSide; slot: number } | null
}>()

const emit = defineEmits<{
  slot: [side: TeamSide, index: number, under: Point]
  artifact: [side: TeamSide, under: Point]
  level: [side: TeamSide, index: number, attr: WwwLevelAttr, level: number]
}>()

const i18n = useI18nStore()

const SIDES: readonly TeamSide[] = ['a', 'b']
</script>

<template>
  <div
    class="www-game"
    :role="number === null ? undefined : 'group'"
    :aria-label="number === null ? undefined : i18n.t('app.www-game', { n: number })"
  >
    <span v-if="number !== null" class="www-game-label" aria-hidden="true">{{
      i18n.t('app.www-game', { n: number })
    }}</span>
    <div class="www-teams">
      <template v-for="side in SIDES" :key="side">
        <span v-if="side === 'b'" class="www-vs" aria-hidden="true">VS</span>
        <WwwTeamRow
          :side
          :team="game[side]"
          :target="target?.side === side ? target.slot : null"
          @slot="(slot, under) => emit('slot', side, slot, under)"
          @artifact="emit('artifact', side, $event)"
          @level="(slot, attr, level) => emit('level', side, slot, attr, level)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.www-game {
  display: grid;
  justify-items: center;
  gap: 10px;
}

.www-game + .www-game {
  padding-top: 18px;
  border-top: 1px solid var(--color-border-light);
}

.www-game-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-primary);
}

.www-teams {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
}

.www-vs {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

@container (max-width: 779px) {
  .www-teams {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    width: min(100cqi, 440px);
  }
}
</style>
