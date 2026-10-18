<script setup lang="ts">
import { computed } from 'vue'

import GridArrow from './grid/GridArrow.vue'
import GridLine from './grid/GridLine.vue'
import { TEAM_ARROW_COLORS, useArrowLayer } from '@/composables/useArrowLayer'
import { useGridContext } from '@/composables/useGridContext'
import { ATTR_SKILL_MODE } from '@/lib/characters/attributes'
import type { Hex } from '@/lib/hex'
import { getCharacterSkill } from '@/lib/skills/skill'
import { SKILL_MODES } from '@/lib/skills/skillModes'
import { Team } from '@/lib/types/team'

interface Props {
  defaultSvgHeight: number
}

const props = defineProps<Props>()

const ctx = useGridContext()

const { svgDimensions, layerStyle, arrowStyle, layerTransform } = useArrowLayer(
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

// Only targeting skills (those with a targetingColorModifier) draw arrows. A
// hero with skill modes draws in the colour of the mode it is set to.
function targetingColor(key: string): string | undefined {
  const parsed = parseSkillKey(key)
  if (!parsed) return undefined
  const { characterId } = parsed
  const color = getCharacterSkill(characterId)?.targetingColorModifier
  if (!color) return undefined
  const mode = ctx.getAttr(Number(parsed.team) as Team, characterId, ATTR_SKILL_MODE)
  return SKILL_MODES[characterId]?.modes[mode]?.color ?? color
}

const arrowsToRender = computed(() => {
  const arrows: Array<{ key: string; fromHex: Hex; toHex: Hex; color: string }> = []

  for (const [key, targetInfo] of skillTargets.value) {
    const color = targetingColor(key)
    if (!color) continue

    targetInfo.metadata?.arrows?.forEach((arrow, idx) => {
      if (!bothVisible(arrow.fromHexId, arrow.toHexId)) return
      arrows.push({
        key: `${key}-arrow-${idx}`,
        fromHex: ctx.grid.getHexById(arrow.fromHexId),
        toHex: ctx.grid.getHexById(arrow.toHexId),
        color,
      })
    })
  }

  const pair = (from: Hex, to: Hex) => `${from.getId()}>${to.getId()}`
  const joined = new Set(arrows.map((a) => pair(a.fromHex, a.toHex)))
  return arrows.map((a) => ({ ...a, mutual: joined.has(pair(a.toHex, a.fromHex)) }))
})

// An artifact arrow shows with its slot (team view hides the enemy slot) and
// only while its target tile is shown: an ally slot can target enemies, whose
// tiles team view crops out. The host cell sits outside the grid, so only the
// target end is checked.
const artifactArrowsToRender = computed(() =>
  ctx.artifactArrows.filter(
    (arrow) =>
      (!ctx.teamView || arrow.team === Team.ALLY) && visibleHexIds.value.has(arrow.toHex.getId()),
  ),
)

// Lines carry their own color, so (unlike arrows) they render for any skill, not just
// targeting ones. Only center lines are drawn here, since they join units and rise
// with the portraits (layerTransform); SkillCornerLines draws corner lines on the
// tiles. A center line drops when either end is cropped.
const linesToRender = computed(() =>
  ctx.skillLines
    .filter(
      (line) =>
        (line.fromCorner === undefined || line.toCorner === undefined) &&
        bothVisible(line.fromHexId, line.toHexId),
    )
    .map((line) => ({
      ...line,
      fromHex: ctx.grid.getHexById(line.fromHexId),
      toHex: ctx.grid.getHexById(line.toHexId),
    })),
)
</script>

<template>
  <svg
    v-if="arrowsToRender.length || artifactArrowsToRender.length || linesToRender.length"
    class="skill-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
    :style="layerStyle"
  >
    <g :transform="layerTransform">
      <GridLine
        v-for="(line, idx) in linesToRender"
        :key="`line-${idx}`"
        :start-hex="line.fromHex"
        :end-hex="line.toHex"
        :color="line.color"
        :stroke-width="arrowStyle.strokeWidth"
      />
      <GridArrow
        v-for="arrow in arrowsToRender"
        :id="arrow.key"
        :key="arrow.key"
        :start-hex="arrow.fromHex"
        :end-hex="arrow.toHex"
        :color="arrow.color"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :arc="!arrow.mutual"
      />
      <GridArrow
        v-for="arrow in artifactArrowsToRender"
        :id="`artifact-${arrow.team}-${arrow.toHex.getId()}`"
        :key="`artifact-${arrow.team}-${arrow.toHex.getId()}`"
        :start-hex="arrow.fromHex"
        :end-hex="arrow.toHex"
        :color="TEAM_ARROW_COLORS[arrow.team]"
        :stroke-width="arrowStyle.strokeWidth"
        :arrowhead-size="arrowStyle.arrowheadSize"
        :arc="false"
      />
    </g>
  </svg>
</template>

<style scoped>
/* Visible overflow: a lifted arrow to the far row rises above the box. */
.skill-arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
  z-index: var(--z-arrows);
}

.skill-arrow-layer g {
  transition: transform var(--transition-perspective);
}
</style>
