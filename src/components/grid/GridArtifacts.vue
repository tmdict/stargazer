<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPopup from '@/components/ArtifactSelectionPopup.vue'
import { useGridEvents } from '@/composables/useGridEvents'
import { useSelectionState } from '@/composables/useSelectionState'
import { Hex } from '@/lib/hex'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { svgPointToScreen } from '@/utils/gridScreenPosition'

const props = defineProps<{
  allyArtifactId?: number | null
  enemyArtifactId?: number | null
  showPerspective?: boolean
  scaleY?: number
  readonly?: boolean
  isMapEditorMode?: boolean
}>()

const gridEvents = useGridEvents()
const gameDataStore = useGameDataStore()
const gridStore = useGridStore()
const { handleTeamChange, requestTab } = useSelectionState()

// Purely-visual host cells: the left/right neighbours of real cells 1 (ally) and
// 45 (enemy). Not part of the grid simulation (no tile, pathfinding, or drop
// target) — just an SVG outline + the icon, tracking the layout/scale.
const ghostCell = (baseId: number, direction: number): Hex | null => {
  try {
    return gridStore.getHexById(baseId).neighbor(direction)
  } catch {
    return null
  }
}
const allyCellHex = computed(() => ghostCell(1, 4)) // direction 4 = left of cell 1
const enemyCellHex = computed(() => ghostCell(45, 1)) // direction 1 = right of cell 45

const cellCenter = (hex: Hex | null) => (hex ? gridStore.layout.hexToPixel(hex) : { x: 0, y: 0 })
const cellPoints = (hex: Hex | null) =>
  hex
    ? gridStore.layout
        .polygonCorners(hex)
        .map((p) => `${p.x},${p.y}`)
        .join(' ')
    : ''

const allyCenter = computed(() => cellCenter(allyCellHex.value))
const enemyCenter = computed(() => cellCenter(enemyCellHex.value))
const allyCellPoints = computed(() => cellPoints(allyCellHex.value))
const enemyCellPoints = computed(() => cellPoints(enemyCellHex.value))

// The cell-outline SVG shares the full grid box and coordinate space with GridTiles,
// so it compresses with the perspective wrapper exactly like the real hexes.
const gridPixelSize = computed(() => 600 * gridStore.getHexScale())
const cellStrokeWidth = computed(() => Math.max(1.5, 2 * gridStore.getHexScale()))
const cellDashArray = computed(() => {
  const scale = gridStore.getHexScale()
  return `${6 * scale},${4 * scale}`
})

// Artifact icon geometry (at 40px hex radius). Icons are full-bleed square art
// that fills the circle; only the container scales with the breakpoint.
const BASE_ARTIFACT_SIZE = 52

const artifactDimensions = computed(() => {
  const scale = gridStore.getHexScale()
  return {
    containerSize: BASE_ARTIFACT_SIZE * scale,
    borderWidth: Math.max(2, 2 * scale),
  }
})

// Center the icon on its host cell. In perspective, lift it and counter-scale
// vertically — the same transform GridCharacters applies — so it reads as an
// isometric token standing in the cell while the cell beneath it compresses.
const iconStyle = (center: { x: number; y: number }) => {
  const { containerSize, borderWidth } = artifactDimensions.value
  const styles: Record<string, string | number> = {
    width: `${containerSize}px`,
    height: `${containerSize}px`,
    '--artifact-border-width': `${borderWidth}px`,
    left: `${center.x - containerSize / 2}px`,
    top: `${center.y - containerSize / 2}px`,
  }
  if (props.showPerspective) {
    const verticalOffset = -70 * gridStore.getHexScale()
    styles.transform = `translateY(${verticalOffset}px) scaleY(${props.scaleY || 1.0})`
  }
  return styles
}

const getAllyStyles = computed(() => iconStyle(allyCenter.value))
const getEnemyStyles = computed(() => iconStyle(enemyCenter.value))

// Resolve artifact IDs to records (name + season drive local vs remote icons).
const allyArtifact = computed(() => {
  if (props.allyArtifactId === null || props.allyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.allyArtifactId) ?? null
})

const enemyArtifact = computed(() => {
  if (props.enemyArtifactId === null || props.enemyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.enemyArtifactId) ?? null
})

// The empty dashed cell is an "add artifact here" affordance, shown only on the
// interactive grid; a filled cell always frames its artifact. The enemy cell
// follows the enemy artifact's team-view visibility (id is nulled upstream).
const showPlaceholders = computed(() => !props.readonly && !props.isMapEditorMode)
const showAllyCell = computed(() => !!allyArtifact.value || showPlaceholders.value)
const showEnemyCell = computed(
  () => !gridStore.teamView && (!!enemyArtifact.value || showPlaceholders.value),
)

// An empty host cell opens the artifact picker; a filled cell's icon handles
// removal (handleArtifactClick), mirroring the character flow (empty hex → picker,
// placed hero → remove).
const allyCellClickable = computed(() => showPlaceholders.value && !allyArtifact.value)
const enemyCellClickable = computed(
  () => showPlaceholders.value && !gridStore.teamView && !enemyArtifact.value,
)

const showPopup = ref(false)
const popupTeam = ref<Team | null>(null)
const popupPosition = ref({ x: 0, y: 0 })

const openPopup = (team: Team, center: { x: number; y: number }) => {
  const scale = gridStore.getHexScale()
  // Mobile (sheet mode, scale < 1): mirror the character flow — no on-grid popup;
  // open the roster sheet on the Seasonal tab, targeting the tapped team.
  if (scale < 1) {
    handleTeamChange(team)
    requestTab('seasonal')
    return
  }
  const screen = svgPointToScreen(center)
  if (!screen) return
  popupPosition.value = { x: screen.x + 30 * scale, y: screen.y - 50 * scale }
  popupTeam.value = team
  showPopup.value = true
}

const closePopup = () => {
  showPopup.value = false
  popupTeam.value = null
}

const handleArtifactClick = (team: Team) => {
  gridEvents.emit('artifact:remove', team)
}
</script>

<template>
  <div class="grid-artifacts">
    <!-- Visual-only host cells (dashed). Same coordinate space as GridTiles. -->
    <svg
      v-if="showAllyCell || showEnemyCell"
      class="artifact-cell-layer"
      :width="gridPixelSize"
      :height="gridPixelSize"
    >
      <polygon
        v-if="showAllyCell"
        class="artifact-cell"
        fill="transparent"
        :class="{ clickable: allyCellClickable }"
        :points="allyCellPoints"
        :stroke-width="cellStrokeWidth"
        :stroke-dasharray="cellDashArray"
        @click="allyCellClickable && openPopup(Team.ALLY, allyCenter)"
      />
      <polygon
        v-if="showEnemyCell"
        class="artifact-cell"
        fill="transparent"
        :class="{ clickable: enemyCellClickable }"
        :points="enemyCellPoints"
        :stroke-width="cellStrokeWidth"
        :stroke-dasharray="cellDashArray"
        @click="enemyCellClickable && openPopup(Team.ENEMY, enemyCenter)"
      />
    </svg>

    <!-- Ally artifact (host cell: left of cell 1). `front` lifts it above the
         character layer so the lifted icon isn't covered in perspective. -->
    <div
      v-if="allyArtifact"
      class="grid-artifact front"
      :class="{ readonly }"
      :style="getAllyStyles"
      @click="!readonly && handleArtifactClick(Team.ALLY)"
    >
      <div class="artifact-circle">
        <ArtifactImage :artifact="allyArtifact" />
      </div>
      <div v-if="showPerspective" class="artifact-pointer" />
    </div>

    <!-- Enemy artifact (host cell: right of cell 45). Stays behind the character
         layer (DOM order) so overlapping characters sit on top in perspective. -->
    <div
      v-if="enemyArtifact"
      class="grid-artifact"
      :class="{ readonly }"
      :style="getEnemyStyles"
      @click="!readonly && handleArtifactClick(Team.ENEMY)"
    >
      <div class="artifact-circle">
        <ArtifactImage :artifact="enemyArtifact" />
      </div>
      <div v-if="showPerspective" class="artifact-pointer" />
    </div>

    <Teleport to="body">
      <ArtifactSelectionPopup
        v-if="showPopup && popupTeam !== null"
        :team="popupTeam"
        :position="popupPosition"
        @close="closePopup"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.grid-artifacts {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Host cells sit just past the grid's left/right edges; clip x only (y stays
     visible for perspective-lifted icons) so they can't cause horizontal page
     overflow if the grid is ever transiently mis-scaled. */
  overflow-x: clip;
}

.artifact-cell-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}

.artifact-cell {
  /* Paired with a transparent `fill` attribute in the template: PNG export drops
     scoped CSS, so without it the polygon falls back to SVG's default black fill. */
  fill: rgba(255, 255, 255, 0.06);
  stroke: var(--color-text-tertiary, #8a8f98);
}

/* Empty host cells invite a click to open the artifact picker. */
.artifact-cell.clickable {
  pointer-events: auto;
  cursor: pointer;
  transition: fill 0.15s ease;
}

.artifact-cell.clickable:hover {
  fill: rgba(255, 255, 255, 0.16);
}

.grid-artifact {
  position: absolute;
  cursor: pointer;
  pointer-events: auto;
  transform-origin: center;
  /* Always present (not inline-only) so the perspective<->flat transform animates
     in both directions, in sync with the grid + character icons. */
  transition: transform 0.3s ease-out;
}

/* Ally artifact paints above the character layer (which is a later sibling). */
.grid-artifact.front {
  z-index: 2;
}

.grid-artifact.readonly {
  cursor: default;
}

/* The circular, clipped visual. The wrapper stays overflow-visible so the
   perspective pointer can extend below it. */
.artifact-circle {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-round);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: var(--artifact-border-width, 2px) solid var(--color-bg-white);
  box-shadow: 0 0 0 2px #fff;
  /* White backing for every season (icons may have transparency). */
  background: #fff;
}

/* Mirrors GridCharacters' .character-pointer — the isometric "foot" in perspective. */
.artifact-pointer {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #777;
}
</style>
