<script setup lang="ts">
/* The Faction Bonus guide's table in small: each step's same-faction heroes
   and the ATK and HP they give. */

import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import { FACTION_BONUS_STEPS, stepTeam, TEAM_SIZE } from '@/lib/factionBonus'
import { useGameDataStore } from '@/stores/gameData'

const gameData = useGameDataStore()

const ROWS = FACTION_BONUS_STEPS.map(({ groups, percent }) => {
  const team = stepTeam(groups)
  return {
    key: groups.join('-'),
    team,
    empty: TEAM_SIZE - team.length,
    count: groups.join(' + '),
    percent,
  }
})
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock>
        <div v-for="row in ROWS" :key="row.key" class="step">
          <span class="pips">
            <img
              v-for="(faction, i) in row.team"
              :key="i"
              :src="gameData.getIcon(`faction-${faction}`)"
              alt=""
            />
            <span v-for="i in row.empty" :key="`empty-${i}`" class="pip-empty"></span>
          </span>
          <span class="count">{{ row.count }}</span>
          <span class="gain">+{{ row.percent }}%</span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 2px;
  font-size: 0.85rem;
}

.step + .step {
  border-top: 1px solid var(--color-border-primary);
}

.pips {
  display: flex;
  gap: 3px;
}

.pips img,
.pip-empty {
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.pip-empty {
  border: 1.5px dashed var(--color-border-primary);
}

.count {
  color: var(--color-text-secondary);
}

.gain {
  margin-left: auto;
  font-weight: 700;
  color: var(--color-success);
}
</style>
