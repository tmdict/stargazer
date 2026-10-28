<script setup lang="ts">
/* Who Would Win?'s match result: Team A's chance to win the match and of each
   final score, worked out from the games' chances as shown so that they agree
   with the game lines; a line per game; and the game picked from its line,
   game 1 to begin with, drawn as One game draws its result. */

import { computed, ref } from 'vue'

import WwwChances from './WwwChances.vue'
import WwwResult, { verdictText, type WwwShown } from './WwwResult.vue'
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
          <span class="www-line-name">{{ gameName(index) }}</span>
          <WwwChances class="www-line-chances" :chance="game.panel.shown / 1000" small />
          <span class="www-line-verdict">{{ verdictText(i18n.t, game.panel) }}</span>
        </button>
      </div>
    </section>

    <p class="www-picked">{{ gameName(picked) }}</p>
    <WwwResult :panel="games[picked]!.panel" :groups="games[picked]!.groups" />
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

.www-sub,
.www-picked {
  margin: 6px 0 0;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  color: var(--color-text-secondary);
}

.www-picked {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-primary);
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
  grid-template-columns: 4.5rem minmax(0, 16rem) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-top: 1px solid var(--color-border-light);
  background: none;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.www-line:hover,
.www-line.picked {
  background: var(--color-bg-raised);
}

.www-line-name {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.www-line.picked .www-line-name {
  color: var(--color-text-primary);
}

.www-line-verdict {
  font-size: 13px;
  color: var(--color-text-primary);
}

@container (max-width: 519px) {
  .www-line {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 10px;
  }
  .www-line-chances {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .www-line-verdict {
    text-align: right;
  }
}
</style>
