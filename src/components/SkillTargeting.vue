<script setup lang="ts">
import { computed } from 'vue'

import GridArrow from './grid/GridArrow.vue'
import { useArrowLayer } from '@/composables/useArrowLayer'
import { getCharacterSkill } from '@/lib/skills/skill'
import { useSkillStore } from '@/stores/skill'

interface Props {
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const skillStore = useSkillStore()

const { svgDimensions, arrowStyle, layerTransform } = useArrowLayer(
  () => props.showPerspective,
  () => props.defaultSvgHeight,
)

const skillTargets = computed(() => {
  return skillStore.getAllSkillTargets
})

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

function getTargetingColor(key: string): string {
  const parsed = parseSkillKey(key)
  if (!parsed) return '#36958e'
  const skill = getCharacterSkill(parsed.characterId)
  return skill?.targetingColorModifier || '#36958e' // Default to green if not specified
}

const arrowsToRender = computed(() => {
  const arrows: Array<{
    key: string
    fromHexId: number
    toHexId: number
    color: string
  }> = []

  for (const [key, targetInfo] of skillTargets.value) {
    if (!isTargetingSkill(key)) continue

    // Check for arrows array in metadata
    if (targetInfo.metadata?.arrows) {
      const color = getTargetingColor(key)
      targetInfo.metadata.arrows.forEach((arrow, idx) => {
        arrows.push({
          key: `${key}-arrow-${idx}`,
          fromHexId: arrow.fromHexId,
          toHexId: arrow.toHexId,
          color,
        })
      })
    }
  }

  return arrows
})
</script>

<template>
  <svg
    v-if="arrowsToRender.length > 0"
    class="skill-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="layerTransform">
      <GridArrow
        v-for="arrow in arrowsToRender"
        :id="arrow.key"
        :key="arrow.key"
        :start-hex-id="arrow.fromHexId"
        :end-hex-id="arrow.toHexId"
        :color="arrow.color"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
      />
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
</style>
