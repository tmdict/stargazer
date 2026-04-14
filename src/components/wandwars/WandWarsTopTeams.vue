<template>
  <div v-if="result.dataTeams.length > 0 || result.suggestedTeams.length > 0" class="top-teams">
    <!-- Data-backed teams -->
    <div v-if="result.dataTeams.length > 0" class="team-section">
      <h4 class="section-title">Top Teams</h4>
      <div class="team-list">
        <div v-for="(team, i) in result.dataTeams" :key="'d' + i" class="team-row">
          <div class="team-heroes">
            <img
              v-for="hero in orderedTeam(team.team)"
              :key="hero"
              :src="characterImages[hero]"
              :alt="hero"
              :title="formatName(hero)"
              class="team-hero-img"
            />
          </div>
          <span class="team-record">
            <span class="team-wins">{{ team.wins }}W</span>
            <span class="team-losses">{{ team.losses }}L</span>
            <span v-if="team.draws > 0" class="team-draws">{{ team.draws }}D</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Constructed teams -->
    <div v-if="result.suggestedTeams.length > 0" class="team-section">
      <h4 class="section-title suggested">Suggested Teams</h4>
      <div class="team-list">
        <div
          v-for="(team, i) in result.suggestedTeams"
          :key="'s' + i"
          class="team-row constructed"
          title="Suggested based on pair records"
        >
          <div class="team-heroes">
            <img
              v-for="hero in orderedTeam(team.team)"
              :key="hero"
              :src="characterImages[hero]"
              :alt="hero"
              :title="formatName(hero)"
              class="team-hero-img"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { formatName } from '@/wandwars/formatting'
import { getTopTeams } from '@/wandwars/teamSuggestions'
import type { MatchResult } from '@/wandwars/types'

const props = defineProps<{
  teammates: string[]
  excludeHeroes: string[]
  matches: MatchResult[]
  characterImages: Record<string, string>
}>()

const result = computed(() => getTopTeams(props.teammates, props.matches, props.excludeHeroes))

function orderedTeam(team: string[]): string[] {
  // Picked heroes first (in pick order), then remaining heroes alphabetically
  const picked = props.teammates.filter((t) => team.includes(t))
  const rest = team.filter((h) => !props.teammates.includes(h)).sort()
  return [...picked, ...rest]
}
</script>

<style scoped>
.top-teams {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  margin-bottom: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.team-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-title {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.section-title.suggested {
  color: var(--color-primary);
}

.team-list {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-light-gray);
  border: 1px solid #aaa;
  border-radius: var(--radius-small);
  flex: 0 0 213px;
}

.team-row.constructed {
  border-style: dashed;
}

.team-heroes {
  display: flex;
  gap: 2px;
}

.team-hero-img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 2px solid var(--color-bg-white);
}

.team-record {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.3;
  margin-right: var(--spacing-sm);
}

.team-wins {
  color: #1e7e34;
}

.team-losses {
  color: #c62828;
}

.team-draws {
  color: var(--color-text-secondary);
}
</style>
