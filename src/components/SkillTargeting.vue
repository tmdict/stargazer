<script setup lang="ts">
import { computed } from 'vue'

import GridArrow from './grid/GridArrow.vue'
import GridLine from './grid/GridLine.vue'
import { TEAM_ARROW_COLORS, useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { getCharacterSkill } from '@/lib/skills/skill'
import { clipLaneBoundary } from '@/lib/skills/utils/line'
import { Team } from '@/lib/types/team'

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

// Only targeting skills (those with a targetingColorModifier) draw arrows.
function targetingColor(key: string): string | undefined {
  const parsed = parseSkillKey(key)
  return parsed ? getCharacterSkill(parsed.characterId)?.targetingColorModifier : undefined
}

const arrowsToRender = computed(() => {
  const arrows: Array<{
    key: string
    fromHexId: number
    toHexId: number
    color: string
  }> = []

  for (const [key, targetInfo] of skillTargets.value) {
    const color = targetingColor(key)
    if (!color) continue

    if (targetInfo.metadata?.arrows) {
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

// An artifact arrow shows with its slot: team view hides the enemy slot, and
// ally targets are ally tiles, which team view always shows.
const artifactArrowsToRender = computed(() =>
  ctx.artifactArrows.filter((arrow) => !ctx.teamView || arrow.team === Team.ALLY),
)

// Lines carry their own color, so (unlike arrows) they render for any skill, not just
// targeting ones. A same-hex corner line is an exact tile edge (a zone-outline segment)
// kept iff its tile is shown; a two-hex corner (lane-boundary) line spans the visible
// cells of its lane and the adjacent lane it borders, so it runs edge to edge across
// the shown region (the whole grid outside team view); a center line drops when either
// end is cropped.
const linesToRender = computed(() =>
  ctx.skillLines.flatMap((line) => {
    if (line.fromCorner === undefined || line.toCorner === undefined) {
      return bothVisible(line.fromHexId, line.toHexId) ? [line] : []
    }
    if (line.fromHexId === line.toHexId) {
      return visibleHexIds.value.has(line.fromHexId) ? [line] : []
    }
    const laneS = ctx.grid.getHexById(line.fromHexId).s
    const clip = clipLaneBoundary(ctx.visibleHexes, laneS, line.fromCorner)
    return clip ? [{ ...line, ...clip }] : []
  }),
)
</script>

<template>
  <svg
    v-if="arrowsToRender.length || artifactArrowsToRender.length || linesToRender.length"
    class="skill-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
  >
    <g :transform="layerTransform">
      <GridLine
        v-for="(line, idx) in linesToRender"
        :key="`line-${idx}`"
        :start-hex="ctx.grid.getHexById(line.fromHexId)"
        :end-hex="ctx.grid.getHexById(line.toHexId)"
        :start-corner="line.fromCorner"
        :end-corner="line.toCorner"
        :color="line.color"
        :stroke-width="arrowStyle.strokeWidth"
      />
      <GridArrow
        v-for="arrow in arrowsToRender"
        :id="arrow.key"
        :key="arrow.key"
        :start-hex="ctx.grid.getHexById(arrow.fromHexId)"
        :end-hex="ctx.grid.getHexById(arrow.toHexId)"
        :color="arrow.color"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
      />
      <!-- Marker ids are document-wide; the board id keeps two boards' artifact
           arrows to the same hex from sharing one. -->
      <GridArrow
        v-for="arrow in artifactArrowsToRender"
        :id="`artifact-${ctx.id}-${arrow.team}-${arrow.toHex.getId()}`"
        :key="`artifact-${arrow.team}-${arrow.toHex.getId()}`"
        :start-hex="arrow.fromHex"
        :end-hex="arrow.toHex"
        :color="TEAM_ARROW_COLORS[arrow.team]"
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
