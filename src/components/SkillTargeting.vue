<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

import { useGridEvents } from '@/composables/useGridEvents'
import { getCharacterSkill } from '@/lib/skills/skill'
import { useGridStore } from '@/stores/grid'
import { useSkillStore } from '@/stores/skill'

interface Props {
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

// Grid and skill stores
const gridStore = useGridStore()
const skillStore = useSkillStore()
const gridEvents = useGridEvents()

// Get all active skill targets - Vue will track this computed
const skillTargets = computed(() => {
  // This computed will automatically re-run when getAllSkillTargets changes
  // because getAllSkillTargets itself is a computed that depends on targetVersion
  return skillStore.getAllSkillTargets
})

// Compute SVG dimensions based on grid scale
const svgDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    width: 600 * scale,
    height: props.defaultSvgHeight * scale,
  }
})

// Compute transform for perspective mode - same as GridArrows
const skillTransform = computed(() => {
  const scale = gridStore.getHexScale()
  return props.showPerspective ? `translate(0, ${-75 * scale})` : ''
})

// Dynamic arrow styling based on scale
const arrowStyle = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    strokeWidth: Math.max(3, 5 * scale), // Min 3px, thicker arrows
    dashArray: `${8 * scale},${8 * scale}`, // Scale the dash pattern
    arrowheadSize: Math.max(4, 4 * scale), // Same as normal arrows
  }
})

// Get arrow path for skill targeting
function getSkillArrowPath(fromHexId: number, toHexId: number): string | null {
  if (!fromHexId || !toHexId) return null

  try {
    // Use the same arrow path logic as targeting arrows
    // Character radius of 30 to start/end at character edge
    return gridStore.getArrowPath(fromHexId, toHexId, 30, false)
  } catch {
    return null
  }
}

// Parse skill key to get character and team info
function parseSkillKey(key: string): { characterId: number; team: string } | null {
  const parts = key.split('-')
  if (parts.length !== 2) return null

  const charIdStr = parts[0] ?? ''
  const teamStr = parts[1] ?? ''
  if (!charIdStr || !teamStr) {
    console.warn('SkillTargeting: Invalid skill key parts', { key, charIdStr, teamStr })
    return null
  }

  return {
    characterId: parseInt(charIdStr),
    team: teamStr,
  }
}

// Check if this is a targeting skill (has targetingColorModifier)
function isTargetingSkill(key: string): boolean {
  const parsed = parseSkillKey(key)
  if (!parsed) return false
  const skill = getCharacterSkill(parsed.characterId)
  return skill?.targetingColorModifier !== undefined
}

// Get the targeting color for a skill
function getTargetingColor(key: string): string {
  const parsed = parseSkillKey(key)
  if (!parsed) return '#36958e'
  const skill = getCharacterSkill(parsed.characterId)
  return skill?.targetingColorModifier || '#36958e' // Default to green if not specified
}

// Force update when grid changes
function handleGridUpdate() {
  // Component will automatically re-render due to computed properties
}

onMounted(() => {
  gridEvents.on('grid:updated', handleGridUpdate)
  gridEvents.on('character:placed', handleGridUpdate)
  gridEvents.on('character:removed', handleGridUpdate)
})

onUnmounted(() => {
  gridEvents.off('grid:updated', handleGridUpdate)
  gridEvents.off('character:placed', handleGridUpdate)
  gridEvents.off('character:removed', handleGridUpdate)
})
</script>

<template>
  <svg
    v-if="skillTargets.size > 0"
    class="skill-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="skillTransform">
      <!-- Render skill targeting arrows -->
      <template v-for="[key, targetInfo] in skillTargets" :key="key">
        <!-- Skill targeting arrow -->
        <g
          v-if="isTargetingSkill(key) && targetInfo.metadata?.sourceHexId && targetInfo.targetHexId"
        >
          <!-- Arrow head definition -->
          <defs>
            <marker
              :id="`skill-arrow-${key}`"
              markerWidth="20"
              markerHeight="14"
              refX="16"
              refY="7"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="0 0, 20 7, 0 14" :fill="getTargetingColor(key)" />
            </marker>
          </defs>

          <!-- White shadow path for better visibility -->
          <path
            v-if="getSkillArrowPath(targetInfo.metadata?.sourceHexId, targetInfo.targetHexId)"
            :d="getSkillArrowPath(targetInfo.metadata?.sourceHexId, targetInfo.targetHexId)!"
            fill="none"
            stroke="white"
            :stroke-width="arrowStyle.strokeWidth + 4"
            :stroke-dasharray="arrowStyle.dashArray"
            stroke-linecap="round"
            opacity="0.8"
          />

          <!-- Curved dotted arrow path -->
          <path
            v-if="getSkillArrowPath(targetInfo.metadata?.sourceHexId, targetInfo.targetHexId)"
            :d="getSkillArrowPath(targetInfo.metadata?.sourceHexId, targetInfo.targetHexId)!"
            fill="none"
            :stroke="getTargetingColor(key)"
            :stroke-width="arrowStyle.strokeWidth"
            :stroke-dasharray="arrowStyle.dashArray"
            :marker-end="`url(#skill-arrow-${key})`"
            opacity="0.8"
          />
        </g>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.skill-arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 15;
}

.skill-arrow-layer g {
  transition: transform 0.3s ease-out;
}

.skill-arrow-layer path {
  pointer-events: none;
}
</style>
