<script setup lang="ts">
/* The screen an import reads, drawn small as the help page draws screens:
   the battle stats screen's two sides, the Resonating Hall's Hands over its
   hero grid, or the knockout matchup's games, each two teams side by side. */

defineProps<{ screen: 'result' | 'roster' | 'matchup' }>()
</script>

<template>
  <div class="import-thumb" :class="screen" aria-hidden="true">
    <template v-if="screen === 'result'">
      <span class="banner"><i /><i /></span>
      <span v-for="side in ['ally', 'enemy']" :key="side" class="side" :class="side">
        <i class="tab" />
        <span v-for="row in 3" :key="row" class="row"><i class="card" /><i /><i /><i /></span>
      </span>
    </template>
    <template v-else-if="screen === 'roster'">
      <i class="line" />
      <span class="cards hands"><i v-for="card in 5" :key="card" /></span>
      <i class="line" />
      <span class="cards heroes"><i v-for="card in 18" :key="card" /></span>
    </template>
    <template v-else>
      <span v-for="game in 3" :key="game" class="game">
        <i class="line" />
        <span v-for="side in ['left', 'right']" :key="side" class="team" :class="side">
          <i class="bar" />
          <span class="cards"><i v-for="card in 5" :key="card" /></span>
        </span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.import-thumb {
  display: grid;
  gap: 4px;
  width: 96px;
  padding: 6px;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.line,
.tab,
.row > i {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.18);
}

.line {
  width: 40%;
}

.cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
}

.cards > i,
.row > .card {
  height: 9px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.28);
}

.banner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 5px;
  margin-bottom: 2px;
}

.banner > :first-child,
.ally > .tab {
  background: var(--import-ally);
}

.banner > :last-child,
.enemy > .tab {
  background: var(--import-enemy);
}

.side {
  display: grid;
  gap: 2px;
}

.tab {
  width: 30%;
}

.row {
  display: grid;
  grid-template-columns: 7px repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
}

.row > .card {
  height: 7px;
}

.hands > i {
  height: 12px;
}

.heroes {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.heroes > i {
  height: 11px;
}

.matchup {
  gap: 6px;
}

.game {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 4px;
}

.game > .line {
  grid-column: 1 / -1;
}

.team {
  display: grid;
  gap: 2px;
}

.bar {
  height: 3px;
}

.left > .bar {
  background: var(--import-matchup-left);
}

.right > .bar {
  background: var(--import-matchup-right);
}

.team > .cards {
  gap: 1px;
}
</style>
