<script setup lang="ts">
import { ref } from 'vue'

import { Team } from '../../lib/types/team'
import { useArtifactStore } from '../../stores/artifact'
import { useCharacterStore } from '../../stores/character'
import { useGameDataStore } from '../../stores/gameData'
import { useGridStore } from '../../stores/grid'
import { usePathfindingStore } from '../../stores/pathfinding'
import { useSkillStore } from '../../stores/skill'
import { getStateName, getStateClass } from '../../utils/stateFormatting'
import { getSymmetricalHexId } from '../../lib/skills/utils/symmetry'

// Access Pinia stores
const gridStore = useGridStore()
const characterStore = useCharacterStore()
const pathfindingStore = usePathfindingStore()
const artifactStore = useArtifactStore()
const gameDataStore = useGameDataStore()
const skillStore = useSkillStore()

// Character visibility toggles for debug lines
const hiddenCharacters = ref<Set<number>>(new Set())

// Helper function to get character name by ID
const getCharacterName = (characterId: number): string => {
  return gameDataStore.getCharacterNameById(characterId) || 'Unknown'
}

// Helper function to get artifact name by ID
const getArtifactName = (artifactId: number | null): string => {
  if (artifactId === null) return 'n/a'
  const artifact = gameDataStore.getArtifactById(artifactId)
  return artifact?.name || 'Unknown'
}

// Toggle visibility of debug lines for a character
const toggleCharacterDebugLines = (hexId: number) => {
  if (hiddenCharacters.value.has(hexId)) {
    hiddenCharacters.value.delete(hexId)
  } else {
    hiddenCharacters.value.add(hexId)
  }
  // Trigger reactivity
  hiddenCharacters.value = new Set(hiddenCharacters.value)
}

// Check if debug lines should be shown for a character
const shouldShowDebugLines = (hexId: number): boolean => {
  return !hiddenCharacters.value.has(hexId)
}

// Expose functions for PathfindingDebug component
defineExpose({
  shouldShowDebugLines,
})
</script>

<template>
  <div class="grid-stats">
    <h3>Debug Grid</h3>
    <p>
      Total Hexes: {{ gridStore.hexes.length }}; Characters Placed:
      {{ characterStore.charactersPlaced }}; Grid Origin: ({{ gridStore.gridOrigin.x }},
      {{ gridStore.gridOrigin.y }}); Hex Size: {{ gridStore.layout.size.x }}×{{
        gridStore.layout.size.y
      }}
    </p>

    <div v-if="characterStore.charactersPlaced > 0">
      <ul>
        <li
          v-for="tile in characterStore.getTilesWithCharacters()"
          :key="tile.hex.getId()"
          class="character-tile"
          :class="{
            'ally-character': tile.team === Team.ALLY,
            'enemy-character': tile.team === Team.ENEMY,
          }"
        >
          <div class="tile-info">
            <div class="tile-main">
              <span class="hex-id">Hex {{ tile.hex.getId() }}</span>
              <span class="character-name">{{ getCharacterName(tile.characterId!) }}</span>
            </div>
            <div class="tile-state">
              <span class="state-label" :class="getStateClass(tile.state)">
                {{ getStateName(tile.state) }}
              </span>
            </div>
            <!-- Show skill targeting info for Silvina -->
            <div v-if="tile.characterId === 39 && tile.team" class="skill-info">
              <span class="skill-label">Skill: First Strike (Silvina)</span>
              <span class="symmetry-info"
                >Symmetrical Hex: {{ getSymmetricalHexId(tile.hex.getId()) }}</span
              >
              <template v-for="[key, targetInfo] in skillStore.getAllSkillTargets" :key="key">
                <template v-if="key === `${tile.characterId}-${tile.team}`">
                  <span class="skill-target">
                    → Targeting Hex {{ targetInfo.targetHexId }}
                    <span v-if="targetInfo.metadata?.isSymmetricalTarget">(symmetrical)</span>
                    <span v-else>(spiral search)</span>
                  </span>
                  <span v-if="targetInfo.metadata?.examinedTiles" class="examined-tiles">
                    Examined tiles: {{ targetInfo.metadata.examinedTiles.join(', ') }}
                  </span>
                </template>
              </template>
            </div>
            <!-- Show skill targeting info for Reinier -->
            <div v-if="tile.characterId === 31 && tile.team" class="skill-info">
              <span class="skill-label">Skill: Dynamic Balance (Reinier)</span>
              <template v-for="[key, targetInfo] in skillStore.getAllSkillTargets" :key="key">
                <span v-if="key === `${tile.characterId}-${tile.team}`" class="skill-target">
                  <template
                    v-if="targetInfo.metadata?.allyHexId && targetInfo.metadata?.enemyHexId"
                  >
                    → Targeting Ally Hex {{ targetInfo.metadata.allyHexId }}, Enemy Hex
                    {{ targetInfo.metadata.enemyHexId }}
                    <span>(symmetrical pair)</span>
                  </template>
                </span>
              </template>
            </div>
            <!-- Show skill targeting info for Vala -->
            <div v-if="tile.characterId === 46 && tile.team" class="skill-info">
              <span class="skill-label">Skill: Assassin (Vala)</span>
              <template v-for="[key, targetInfo] in skillStore.getAllSkillTargets" :key="key">
                <template v-if="key === `${tile.characterId}-${tile.team}`">
                  <span class="skill-target">
                    → Targeting Hex {{ targetInfo.targetHexId }}
                    <span v-if="targetInfo.metadata?.distance"
                      >(distance: {{ targetInfo.metadata.distance }})</span
                    >
                  </span>
                  <span v-if="targetInfo.metadata?.examinedTiles" class="examined-tiles">
                    Examined tiles: {{ targetInfo.metadata.examinedTiles.join(', ') }}
                  </span>
                </template>
              </template>
            </div>
            <!-- Show skill targeting info for Dunlingr -->
            <div v-if="tile.characterId === 57 && tile.team" class="skill-info">
              <span class="skill-label">Skill: Assassin (Dunlingr)</span>
              <template v-for="[key, targetInfo] in skillStore.getAllSkillTargets" :key="key">
                <template v-if="key === `${tile.characterId}-${tile.team}`">
                  <span class="skill-target">
                    → Targeting Ally Hex {{ targetInfo.targetHexId }}
                    <span v-if="targetInfo.metadata?.distance"
                      >(distance: {{ targetInfo.metadata.distance }})</span
                    >
                  </span>
                  <span v-if="targetInfo.metadata?.examinedTiles" class="examined-tiles">
                    Examined tiles: {{ targetInfo.metadata.examinedTiles.join(', ') }}
                  </span>
                </template>
              </template>
            </div>
            <!-- Show skill targeting info for Nara -->
            <div v-if="tile.characterId === 58 && tile.team" class="skill-info">
              <span class="skill-label">Skill: Phantom Chains (Nara)</span>
              <span class="symmetry-info"
                >Symmetrical Hex: {{ getSymmetricalHexId(tile.hex.getId()) }}</span
              >
              <template v-for="[key, targetInfo] in skillStore.getAllSkillTargets" :key="key">
                <template v-if="key === `${tile.characterId}-${tile.team}`">
                  <span class="skill-target">
                    → Targeting Hex {{ targetInfo.targetHexId }}
                    <span v-if="targetInfo.metadata?.isSymmetricalTarget">(symmetrical)</span>
                    <span v-else>(spiral search)</span>
                  </span>
                  <span v-if="targetInfo.metadata?.examinedTiles" class="examined-tiles">
                    Examined tiles: {{ targetInfo.metadata.examinedTiles.join(', ') }}
                  </span>
                </template>
              </template>
            </div>
            <!-- Show closest enemy info for Ally characters -->
            <div
              v-if="
                tile.team === Team.ALLY && pathfindingStore.closestEnemyMap.has(tile.hex.getId())
              "
              class="closest-info"
            >
              <div class="closest-target-line">
                <span class="closest-enemy">
                  → Enemy at Hex
                  {{ pathfindingStore.closestEnemyMap.get(tile.hex.getId())?.enemyHexId }}
                  (distance:
                  {{ pathfindingStore.closestEnemyMap.get(tile.hex.getId())?.distance }})
                </span>
              </div>
              <div class="debug-toggle-line">
                <label class="debug-toggle-inline">
                  <input
                    type="checkbox"
                    :checked="shouldShowDebugLines(tile.hex.getId())"
                    @change="toggleCharacterDebugLines(tile.hex.getId())"
                    class="debug-checkbox"
                  />
                  <span class="debug-label">Show debug lines</span>
                </label>
              </div>
            </div>
            <!-- Show closest ally info for Enemy characters -->
            <div
              v-if="
                tile.team === Team.ENEMY && pathfindingStore.closestAllyMap.has(tile.hex.getId())
              "
              class="closest-info"
            >
              <div class="closest-target-line">
                <span class="closest-ally">
                  → Ally at Hex
                  {{ pathfindingStore.closestAllyMap.get(tile.hex.getId())?.allyHexId }}
                  (distance:
                  {{ pathfindingStore.closestAllyMap.get(tile.hex.getId())?.distance }})
                </span>
              </div>
              <div class="debug-toggle-line">
                <label class="debug-toggle-inline">
                  <input
                    type="checkbox"
                    :checked="shouldShowDebugLines(tile.hex.getId())"
                    @change="toggleCharacterDebugLines(tile.hex.getId())"
                    class="debug-checkbox"
                  />
                  <span class="debug-label">Show debug lines</span>
                </label>
              </div>
            </div>
          </div>
          <button
            @click="characterStore.removeCharacterFromHex(tile.hex.getId())"
            class="remove-btn"
          >
            ×
          </button>
        </li>
      </ul>
    </div>

    <!-- Artifact Selection Info -->
    <div class="artifact-section">
      <h4>Artifact Selection</h4>
      <div class="artifact-info">
        <div class="artifact-team ally">
          <span class="team-label">Artifact (Ally):</span>
          <span class="artifact-name">
            {{ getArtifactName(artifactStore.allyArtifactId) }}
          </span>
          <button
            v-if="artifactStore.allyArtifactId !== null"
            @click="artifactStore.removeArtifact(Team.ALLY)"
            class="remove-artifact-btn"
          >
            ×
          </button>
        </div>
        <div class="artifact-team enemy">
          <span class="team-label">Artifact (Enemy):</span>
          <span class="artifact-name">
            {{ getArtifactName(artifactStore.enemyArtifactId) }}
          </span>
          <button
            v-if="artifactStore.enemyArtifactId !== null"
            @click="artifactStore.removeArtifact(Team.ENEMY)"
            class="remove-artifact-btn"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-stats {
  padding: var(--spacing-lg);
  background: var(--color-bg-light-gray);
  border-radius: var(--radius-large);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.grid-stats h3 {
  margin: 0;
  color: var(--color-text-primary);
}

.toggle-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s ease;
}

.toggle-btn:hover {
  background: #005a9e;
}

.toggle-btn.collapsed {
  background: #6c757d;
}

.toggle-btn.collapsed:hover {
  background: #5a6268;
}

.toggle-icon {
  font-size: 0.8rem;
  transition: transform 0.2s ease;
}

.stats-content {
  animation: fadeIn 0.3s ease-in-out;
}

.stats-header + .stats-content {
  margin-top: 0;
}

.grid-stats.collapsed .stats-header {
  margin-bottom: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.grid-stats p {
  margin: var(--spacing-sm) 0;
  color: var(--color-text-secondary);
}

.grid-stats ul {
  margin-left: 0;
  list-style: none;
  padding: 0;
}

.grid-stats li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  margin: var(--spacing-sm) 0;
  border-radius: var(--radius-small);
}

.character-tile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-bg-white);
  margin: var(--spacing-sm) 0;
  border-radius: var(--radius-medium);
  border-left: 4px solid var(--color-border-light);
}

.closest-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.closest-target-line {
  display: flex;
  align-items: center;
}

.debug-toggle-line {
  display: flex;
  align-items: center;
  margin-left: var(--spacing-sm);
}

.character-tile.ally-character {
  border-left-color: var(--color-ally);
}

.character-tile.enemy-character {
  border-left-color: var(--color-enemy);
}

.tile-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
}

.tile-main {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.hex-id {
  font-weight: bold;
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.character-name {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.tile-state {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.state-label {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* State-specific colors */
.state-default {
  background: #e9ecef;
  color: #495057;
}

.state-available-ally {
  background: #d4edda;
  color: #155724;
}

.state-available-enemy {
  background: #fff3cd;
  color: #856404;
}

.state-occupied-ally {
  background: #cce7ff;
  color: #004085;
}

.state-occupied-enemy {
  background: #f8d7da;
  color: #721c24;
}

.state-blocked {
  background: #d1ecf1;
  color: #0c5460;
}

.state-blocked-breakable {
  background: #e2e3e5;
  color: #383d41;
}

.state-unknown {
  background: #f8f9fa;
  color: #6c757d;
}

.closest-enemy {
  font-size: 0.75rem;
  color: #c82333;
  font-style: italic;
}

.closest-ally {
  font-size: 0.75rem;
  color: #36958e;
  font-style: italic;
}

.remove-btn {
  background: var(--color-danger);
  color: white;
  border: none;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  line-height: 1;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: var(--color-danger-hover);
}

/* Artifact section styles */
.artifact-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 2px solid #ddd;
}

.artifact-section h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1rem;
}

.artifact-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.artifact-team {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #ddd;
}

.artifact-team.ally {
  border-left-color: #36958e;
}

.artifact-team.enemy {
  border-left-color: #c82333;
}

.team-label {
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
  min-width: 130px;
  text-align: left;
}

.artifact-name {
  color: #666;
  font-size: 0.9rem;
  flex: 1;
  font-family: monospace;
  text-align: left;
}

.remove-artifact-btn {
  background: #c05b4d;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  line-height: 1;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-artifact-btn:hover {
  background: #c82333;
}

.debug-toggle-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  user-select: none;
}

.debug-checkbox {
  width: 12px;
  height: 12px;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

.debug-label {
  font-style: italic;
  color: var(--color-text-secondary);
}

/* Skill targeting info styles */
.skill-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.25rem 1rem 0.25rem 0;
  padding: 0.5rem;
  background: #f0f8ff;
  border-radius: 4px;
  border-left: 3px solid #4a90e2;
}

.skill-label {
  font-size: 0.8rem;
  font-weight: bold;
  color: #2c5aa0;
}

.symmetry-info {
  font-size: 0.75rem;
  color: #666;
  font-style: italic;
}

.skill-target {
  font-size: 0.75rem;
  color: #4a90e2;
  font-weight: 500;
}

.examined-tiles {
  font-size: 0.7rem;
  color: #7a8a9a;
  font-style: italic;
  display: block;
  margin-top: 0.25rem;
}
</style>
