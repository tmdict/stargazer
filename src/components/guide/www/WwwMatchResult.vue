<script setup lang="ts">
/* Who Would Win?'s match result: Team A's chance to win the match and of each
   final score, worked out from the games' chances as shown so that they agree
   with the game lines; a line per game, its name in the middle and each
   team's chance growing from it toward that team's side; and the game picked
   from its line, game 1 to begin with, drawn as One game draws its result. */

import { computed, ref } from 'vue'

import WwwChances from './WwwChances.vue'
import WwwResult, { type WwwShown } from './WwwResult.vue'
import { slPercent } from '@/components/guide/sl/useSlNames'
import { matchOdds } from '@/lib/pvp/sl/www/match'
import { useI18nStore } from '@/stores/i18n'

const { games } = defineProps<{ games: readonly WwwShown[] }>()

const i18n = useI18nStore()

const picked = ref(0)

const odds = computed(() => matchOdds(games.map((game) => game.panel.shown / 1000)))
// Team A's clean sweep first, Team B's last.
const scores = computed(() =>
  odds.value.wins.map((chance, won) => ({ won, lost: games.length - won, chance })).reverse(),
)
const gameName = (index: number): string => i18n.t('app.www-game', { n: index + 1 })
</script>

<template>
  <div class="www-match-result">
    <section class="sl-panel www-summary">
      <WwwChances :chance="odds.chance" />
      <p class="www-caption">{{ i18n.t('app.www-match-chance') }}</p>

      <p class="www-sub">{{ i18n.t('app.www-scores') }}</p>
      <div class="www-scores">
        <span
          v-for="score in scores"
          :key="score.won"
          class="www-score"
          :class="score.won > score.lost ? 'a' : 'b'"
        >
          <b>{{ score.won }}–{{ score.lost }}</b>
          <span>{{ slPercent(score.chance) }}</span>
        </span>
      </div>

      <p class="www-sub">{{ i18n.t('app.www-each-game') }}</p>
      <div class="www-lines">
        <button
          v-for="(game, index) in games"
          :key="index"
          type="button"
          class="www-line"
          :class="{ picked: picked === index }"
          :aria-pressed="picked === index"
          @click="picked = index"
        >
          <span class="l">
            <span class="www-pct a">{{ slPercent(game.panel.shown / 1000) }}</span>
            <span class="www-half"><i :style="{ width: `${game.panel.shown / 10}%` }" /></span>
          </span>
          <span class="c">{{ gameName(index) }}</span>
          <span class="r">
            <span class="www-half"
              ><i :style="{ width: `${100 - game.panel.shown / 10}%` }"
            /></span>
            <span class="www-pct b">{{ slPercent(1 - game.panel.shown / 1000) }}</span>
          </span>
        </button>
      </div>
    </section>

    <WwwResult
      :panel="games[picked]!.panel"
      :groups="games[picked]!.groups"
      :title="gameName(picked)"
    />
  </div>
</template>

<style scoped>
.www-match-result {
  display: grid;
  gap: 14px;
}

.www-summary {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px 16px;
  container-type: inline-size;
}

.a {
  color: var(--unit-frame-ally);
}

.b {
  color: var(--unit-frame-enemy);
}

.www-caption {
  margin: 0;
  font-size: 14px;
  text-align: center;
  color: var(--color-text-primary);
}

.www-sub {
  margin: 6px 0 0;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-scores {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.www-score {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 6px 0;
  border-top: 1px solid var(--color-border-light);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.www-score > b {
  font-size: 15px;
}

.www-score > span {
  color: var(--color-text-secondary);
}

.www-lines {
  display: grid;
}

.www-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.2rem minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-top: 1px solid var(--color-border-light);
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.www-line:hover,
.www-line.picked {
  background: var(--color-bg-raised);
}

.www-line > .l,
.www-line > .r {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.www-line > .c {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-line.picked > .c {
  color: var(--color-text-primary);
}

.www-pct {
  min-width: 3.2em;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.l > .www-pct {
  text-align: left;
}

.r > .www-pct {
  text-align: right;
}

.www-half {
  display: flex;
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--color-border-light);
}

.l > .www-half {
  justify-content: flex-end;
}

.www-half > i {
  display: block;
  height: 100%;
}

.l > .www-half > i {
  background: var(--unit-frame-ally);
}

.r > .www-half > i {
  background: var(--unit-frame-enemy);
}
</style>
