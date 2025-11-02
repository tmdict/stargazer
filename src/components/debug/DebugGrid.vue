<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GridTile } from '@/lib/grid'
import { getCharacterSkill } from '@/lib/skills/skill'
import type { SkillTargetInfo } from '@/lib/skills/skill'
import { getSymmetricalHexId } from '@/lib/skills/utils/symmetry'
import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { usePathfindingStore } from '@/stores/pathfinding'
import { useSkillStore } from '@/stores/skill'
import { getStateClass, getStateName } from '@/utils/tileStateFormatting'

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

// Helper to get skill targets for a character
const getSkillTargetsForCharacter = (
  characterId: number,
  team: Team,
): Array<{ key: string; target: SkillTargetInfo }> => {
  const targets: Array<{ key: string; target: SkillTargetInfo }> = []
  const allTargets = skillStore.getAllSkillTargets

  // Check for standard key format
  const standardKey = `${characterId}-${team}`
  if (allTargets.has(standardKey)) {
    targets.push({ key: standardKey, target: allTargets.get(standardKey)! })
  }

  // Check for multi-target keys (e.g., 90.1, 90.2 for Ravion)
  for (const [key, target] of allTargets) {
    if (key.startsWith(`${characterId}.`) && key.endsWith(`-${team}`)) {
      targets.push({ key, target })
    }
  }

  return targets
}

// Helper to format target label based on team context
const getTargetLabel = (
  targetHexId: number | null,
  sourceTeam: Team | null | undefined,
): string => {
  if (targetHexId === null) return 'No target'
  const targetTile = gridStore.grid.getTileById(targetHexId)
  if (!targetTile || !sourceTeam) return `Hex ${targetHexId}`

  if (targetTile.team === sourceTeam) {
    return `Ally Hex ${targetHexId}`
  } else if (targetTile.team && targetTile.team !== sourceTeam) {
    return `Enemy Hex ${targetHexId}`
  }
  return `Hex ${targetHexId}`
}

// Helper to get metadata descriptor
const getMetadataDescriptor = (metadata: SkillTargetInfo['metadata']): string | null => {
  if (!metadata) return null

  // Priority order for descriptors
  if (metadata.isSymmetricalTarget === true) return 'symmetrical'
  if (metadata.isSymmetricalTarget === false) return 'spiral fallback'
  if (metadata.isFrontmostTarget) return 'frontmost'
  if (metadata.isRearmostTarget) return 'rearmost'
  if (metadata.distance !== undefined) return `distance: ${metadata.distance}`

  return null
}

// Computed property for active skill configs
const activeSkillConfigs = computed(() => {
  const configs: Array<{
    tile: GridTile
    characterId: number
    skillName: string
    characterName: string
    targets: Array<{ key: string; target: SkillTargetInfo; index?: number }>
    showSymmetry: boolean
  }> = []

  // Get all tiles with characters that have skills
  for (const tile of characterStore.getTilesWithCharacters()) {
    if (!tile.characterId || !tile.team) continue

    const skill = getCharacterSkill(tile.characterId)
    if (!skill) continue

    const targets = getSkillTargetsForCharacter(tile.characterId, tile.team)
    if (targets.length === 0) continue

    // Add index for multi-target display (e.g., "1st rearmost", "2nd rearmost")
    const indexedTargets = targets.map((t, index) => ({
      ...t,
      index: targets.length > 1 ? index : undefined,
    }))

    configs.push({
      tile,
      characterId: tile.characterId,
      skillName: skill.name || 'Unknown Skill',
      characterName: getCharacterName(tile.characterId),
      targets: indexedTargets,
      showSymmetry: [39, 58].includes(tile.characterId), // Silvina, Nara
    })
  }

  return configs
})

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
            <!-- Dynamic skill targeting info - works for all characters with skills -->
            <template v-for="config in activeSkillConfigs" :key="config.characterId">
              <div v-if="config.tile === tile" class="skill-info">
                <span class="skill-label"
                  >Skill: {{ config.skillName }} ({{ config.characterName }})</span
                >
                <!-- Show symmetry info for characters that use it -->
                <span v-if="config.showSymmetry" class="symmetry-info"
                  >Symmetrical Hex: {{ getSymmetricalHexId(tile.hex.getId()) }}</span
                >
                <!-- Handle Reinier's special dual target display -->
                <template v-if="config.characterId === 31">
                  <template v-for="targetData in config.targets" :key="targetData.key">
                    <span
                      v-if="
                        targetData.target.metadata?.allyHexId &&
                        targetData.target.metadata?.enemyHexId
                      "
                      class="skill-target"
                    >
                      → Targeting Ally Hex {{ targetData.target.metadata.allyHexId }}, Enemy Hex
                      {{ targetData.target.metadata.enemyHexId }}
                      <span>(symmetrical pair)</span>
                    </span>
                  </template>
                </template>
                <!-- Handle all other characters -->
                <template v-else>
                  <template v-for="targetData in config.targets" :key="targetData.key">
                    <span class="skill-target">
                      → Targeting {{ getTargetLabel(targetData.target.targetHexId, tile.team) }}
                      <!-- Show metadata descriptor -->
                      <span v-if="getMetadataDescriptor(targetData.target.metadata)">
                        <template v-if="targetData.index !== undefined">
                          ({{
                            targetData.index === 0 ? '1st' : targetData.index === 1 ? '2nd' : '3rd'
                          }}
                          {{ getMetadataDescriptor(targetData.target.metadata) }})
                        </template>
                        <template v-else>
                          ({{ getMetadataDescriptor(targetData.target.metadata) }})
                        </template>
                      </span>
                    </span>
                    <!-- Show examined tiles (only once for multi-target skills) -->
                    <span
                      v-if="
                        targetData.target.metadata?.examinedTiles && (targetData.index ?? 0) === 0
                      "
                      class="examined-tiles"
                    >
                      Examined tiles: {{ targetData.target.metadata.examinedTiles.join(', ') }}
                    </span>
                  </template>
                </template>
              </div>
            </template>
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
  font-weight: 700;
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
  font-weight: 700;
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
  font-weight: 700;
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
  font-weight: 700;
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
  font-weight: 700;
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
