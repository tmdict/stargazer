<script setup lang="ts">
import { computed } from 'vue'

import GridArrow from './grid/GridArrow.vue'
import GridLine from './grid/GridLine.vue'
import { useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { getCharacterSkill } from '@/lib/skills/skill'
import { clipLaneBoundary } from '@/lib/skills/utils/line'

interface Props {
  showPerspective: boolean
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const ctx = useGridContext()

const { svgDimensions, arrowStyle, layerTransform } = useArrowLayer(
  () => props.showPerspective,
  () => props.defaultSvgHeight,
)

const skillTargets = computed(() => ctx.skillTargets)

// Team view crops to the shown team's tiles, so a skill arrow/line touching a
// hidden (enemy-side) hex would point at a cropped-out tile. Keep only visuals
// whose endpoints are both in the shown region; outside team view visibleHexes is
// the whole grid, so this passes everything.
const visibleHexIds = computed(() => new Set(ctx.visibleHexes.map((hex) => hex.getId())))
const bothVisible = (fromHexId: number, toHexId: number): boolean =>
  visibleHexIds.value.has(fromHexId) && visibleHexIds.value.has(toHexId)

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
        if (!bothVisible(arrow.fromHexId, arrow.toHexId)) return
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

// Lines carry their own color, so (unlike arrows) they render for any skill, not just
// targeting ones. A corner (lane-boundary) line spans the visible cells of its lane and
// the adjacent lane it borders, so it runs edge to edge across the shown region (the
// whole grid outside team view); a center line drops when either end is cropped.
const linesToRender = computed(() =>
  ctx.skillLines.flatMap((line) => {
    if (line.fromCorner === undefined || line.toCorner === undefined) {
      return bothVisible(line.fromHexId, line.toHexId) ? [line] : []
    }
    const laneS = ctx.grid.getHexById(line.fromHexId).s
    const clip = clipLaneBoundary(ctx.visibleHexes, laneS, line.fromCorner)
    return clip ? [{ ...line, ...clip }] : []
  }),
)
</script>

<template>
  <svg
    v-if="arrowsToRender.length > 0 || linesToRender.length > 0"
    class="skill-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="layerTransform">
      <GridLine
        v-for="(line, idx) in linesToRender"
        :key="`line-${idx}`"
        :start-hex-id="line.fromHexId"
        :end-hex-id="line.toHexId"
        :start-corner="line.fromCorner"
        :end-corner="line.toCorner"
        :color="line.color"
        :stroke-width="arrowStyle.strokeWidth"
      />
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
