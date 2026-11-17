<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import ArtifactSelectionPopup from '@/components/ArtifactSelectionPopup.vue'
import ArtifactTooltip from '@/components/ArtifactTooltip.vue'
import GridPointer from '@/components/grid/GridPointer.vue'
import HoldRing from '@/components/ui/HoldRing.vue'
import { useArtifactPlaces } from '@/composables/useArtifactPlaces'
import { useDragDrop } from '@/composables/useDragDrop'
import { useGridContext } from '@/composables/useGridContext'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import { useSelectionState } from '@/composables/useSelectionState'
import type { ArtifactType } from '@/lib/types/artifact'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids, type ArtifactDragPayload } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { svgPointToScreen } from '@/utils/gridScreenPosition'

import '@/styles/grid-artifact.css'

const props = defineProps<{
  allyArtifactId?: number | null
  enemyArtifactId?: number | null
  // Gates the hover card only; placement interactions are unaffected.
  showHover: boolean
  // Placement tips, whose card the board draws for the ally artifact, so only
  // the enemy's keeps its hover card.
  showRules: boolean
  // How Placement tips' card marks the ally artifact.
  rulesMark?: 'own' | 'named' | 'faded' | null
  readonly?: boolean
  isMapEditorMode?: boolean
  // The sheet layout's tap-to-sheet instead of the desktop popup.
  tapMode?: boolean
}>()

const emit = defineEmits<{
  artifactEnter: [team: Team]
  artifactLeave: []
}>()

const ctx = useGridContext()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const grids = useGrids()
const { setArtifactTarget, requestTab } = useSelectionState()
const { artifactDragPayload } = useDragDrop()

// Hover tooltip: the same artifact card as the picker, shown only on a still
// hover and only while the hover pref is on. Native HTML5 drag suppresses
// mouse events, so it can't appear mid-drag; the click and dragstart handlers
// also dismiss it, and it clears on any artifact change.
const {
  hoveredEl,
  hovered: hoveredArtifact,
  show,
  hide: hideArtifactTooltip,
} = useGridHoverTooltip<ArtifactType>(() => [props.allyArtifactId, props.enemyArtifactId])

// Runs on readonly boards too: the card is pure information, gated by the
// pref alone.
const showArtifactTooltip = (event: MouseEvent, artifact: ArtifactType | null, team: Team) => {
  if (!artifact) return
  emit('artifactEnter', team)
  if (props.showHover || (props.showRules && team === Team.ENEMY)) show(event, artifact)
}

const hideArtifactHover = () => {
  emit('artifactLeave')
  hideArtifactTooltip()
}

// This board's host-cell SVG, used to anchor the artifact popup to the clicked
// board (its coordinate space matches the layout, like GridTiles).
const cellLayerRef = ref<SVGSVGElement | null>(null)

// The host cells accept artifact drops via the separate artifact pipeline
// below.
const {
  gridPixelSize,
  ally: { center: allyCenter, points: allyCellPoints, style: getAllyStyles },
  enemy: { center: enemyCenter, points: enemyCellPoints, style: getEnemyStyles },
  allyInFront: allySlotInFront,
  enemyInFront: enemySlotInFront,
  enemyVisible: enemySlotVisible,
} = useArtifactPlaces(ctx)

const allyArtifact = computed(() => {
  if (props.allyArtifactId === null || props.allyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.allyArtifactId) ?? null
})

const enemyArtifact = computed(() => {
  if (props.enemyArtifactId === null || props.enemyArtifactId === undefined) return null
  return gameDataStore.getArtifactById(props.enemyArtifactId) ?? null
})

// An id with no record is retired seasonal content: the slot stays occupied
// (click still removes, placing another artifact still replaces) and renders a
// placeholder instead of nothing.
const allyRetired = computed(
  () => props.allyArtifactId !== null && props.allyArtifactId !== undefined && !allyArtifact.value,
)
const enemyRetired = computed(
  () =>
    props.enemyArtifactId !== null && props.enemyArtifactId !== undefined && !enemyArtifact.value,
)

// Inspect: long-press or right-click opens the artifact's details. A retired
// artifact has no record and so no details.
const { inspect } = useInspect()

const inspectArtifact = (team: Team): void => {
  const artifact = team === Team.ALLY ? allyArtifact.value : enemyArtifact.value
  if (!artifact) return
  hideArtifactTooltip()
  void inspect({ kind: 'artifact', artifact })
}

const { pressing: holdingTeam, start: startHold, onContextMenu } = useLongPress(inspectArtifact)

const showPlaceholders = computed(() => !props.readonly && !props.isMapEditorMode)
const showEnemyCell = computed(() => enemySlotVisible.value && showPlaceholders.value)

// An empty host cell opens the artifact picker; a filled cell's icon handles
// removal (handleArtifactClick), mirroring the mouse character flow (empty hex
// → picker, placed hero → remove). Unlike heroes, artifacts have no tap-lift:
// a touch tap on a filled cell also removes, so touch can add and delete
// artifacts but only a mouse drag repositions one (an intended scope cut).
const allyCellClickable = computed(
  () => showPlaceholders.value && !allyArtifact.value && !allyRetired.value,
)
const enemyCellClickable = computed(
  () => showEnemyCell.value && !enemyArtifact.value && !enemyRetired.value,
)

const showPopup = ref(false)
const popupTeam = ref<Team | null>(null)
const popupPosition = ref({ x: 0, y: 0 })

const openPopup = (team: Team, center: { x: number; y: number }) => {
  if (props.tapMode) {
    setArtifactTarget(team, ctx.id)
    requestTab('seasonal')
    return
  }
  const screen = svgPointToScreen(center, cellLayerRef.value)
  if (!screen) return
  popupPosition.value = { x: screen.x + 30 * ctx.hexScale, y: screen.y - 50 * ctx.hexScale }
  popupTeam.value = team
  showPopup.value = true
}

const closePopup = () => {
  showPopup.value = false
  popupTeam.value = null
}

const handleArtifactClick = (team: Team) => {
  hideArtifactTooltip()
  ctx.removeArtifact(team)
}

// Artifact drag-and-drop. A filled icon is the drag source; an empty cell polygon
// and a filled icon are the drop targets (the two-surface split mirrors the existing
// click affordances). Move/swap routing and per-team uniqueness live in
// grids.routeArtifactDrop; a distinct MIME plus stopPropagation keeps this off the
// character drop pipeline. Desktop-only, interactive boards only.
const ARTIFACT_MIME = 'application/artifact'

const canDrag = computed(() => showPlaceholders.value && !props.tapMode)
const allyDroppable = computed(() => canDrag.value && !allyArtifact.value)
const enemyDroppable = computed(
  () => canDrag.value && enemySlotVisible.value && !enemyArtifact.value,
)

const handleArtifactDragStart = (event: DragEvent, team: Team) => {
  hideArtifactTooltip()
  if (!canDrag.value || !event.dataTransfer) return
  const payload: ArtifactDragPayload = { sourceCtxId: ctx.id, sourceTeam: team }
  event.dataTransfer.setData(ARTIFACT_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'move'
  artifactDragPayload.value = payload
}

const handleArtifactDragEnd = () => {
  artifactDragPayload.value = null
  invalidDropTeam.value = null
}

// The hovered cell the router would reject. Gating the styling on the mirrored
// payload drops it everywhere the moment the drag ends, so a board whose
// dragleave never fired can't keep a stale highlight.
const invalidDropTeam = ref<Team | null>(null)
const invalidDrop = (team: Team): boolean =>
  artifactDragPayload.value !== null && invalidDropTeam.value === team

const clearInvalidDrop = () => {
  invalidDropTeam.value = null
}

// A valid target accepts the drop; a rejectable one refuses it (not-allowed
// cursor + invalid-drop styling), and stopping propagation keeps the document
// level dragover from accepting it anyway.
const allowArtifactDrop = (event: DragEvent, team: Team) => {
  if (!canDrag.value || !event.dataTransfer?.types.includes(ARTIFACT_MIME)) return
  const payload = artifactDragPayload.value
  if (payload && !grids.canDropArtifact(payload, ctx.id, team)) {
    invalidDropTeam.value = team
    event.stopPropagation()
    return
  }
  invalidDropTeam.value = null
  event.preventDefault()
}

const handleArtifactDrop = (event: DragEvent, targetTeam: Team) => {
  const raw = event.dataTransfer?.getData(ARTIFACT_MIME)
  if (!raw || !canDrag.value) return
  event.stopPropagation()
  event.preventDefault()
  grids.routeArtifactDrop(JSON.parse(raw) as ArtifactDragPayload, ctx.id, targetTeam)
  artifactDragPayload.value = null
  invalidDropTeam.value = null
}
</script>

<template>
  <div class="grid-artifacts">
    <svg
      v-if="showPlaceholders"
      ref="cellLayerRef"
      class="artifact-cell-layer"
      :width="gridPixelSize"
      :height="gridPixelSize"
    >
      <polygon
        class="artifact-cell"
        :class="{
          clickable: allyCellClickable,
          droppable: allyDroppable,
          'invalid-drop': invalidDrop(Team.ALLY),
        }"
        :points="allyCellPoints"
        @click="allyCellClickable && openPopup(Team.ALLY, allyCenter)"
        @dragover="allowArtifactDrop($event, Team.ALLY)"
        @dragleave="clearInvalidDrop"
        @drop="handleArtifactDrop($event, Team.ALLY)"
      />
      <polygon
        v-if="showEnemyCell"
        class="artifact-cell"
        :class="{
          clickable: enemyCellClickable,
          droppable: enemyDroppable,
          'invalid-drop': invalidDrop(Team.ENEMY),
        }"
        :points="enemyCellPoints"
        @click="enemyCellClickable && openPopup(Team.ENEMY, enemyCenter)"
        @dragover="allowArtifactDrop($event, Team.ENEMY)"
        @dragleave="clearInvalidDrop"
        @drop="handleArtifactDrop($event, Team.ENEMY)"
      />
    </svg>

    <!-- Ally artifact (host cell: left of cell 1). `front` lifts it above the
         character layer so the icon isn't covered in perspective; it applies to
         whichever cell renders at the near (screen-bottom) edge. -->
    <div
      v-if="allyArtifact || allyRetired"
      class="grid-artifact inspectable"
      :class="[
        { readonly, front: allySlotInFront, 'invalid-drop': invalidDrop(Team.ALLY) },
        rulesMark && `rules-${rulesMark}`,
      ]"
      :style="getAllyStyles"
      :draggable="canDrag && !!allyArtifact"
      @click="!readonly && handleArtifactClick(Team.ALLY)"
      @dragstart="handleArtifactDragStart($event, Team.ALLY)"
      @dragend="handleArtifactDragEnd"
      @dragover="allowArtifactDrop($event, Team.ALLY)"
      @dragleave="clearInvalidDrop"
      @drop="handleArtifactDrop($event, Team.ALLY)"
      @mouseenter="showArtifactTooltip($event, allyArtifact, Team.ALLY)"
      @mouseleave="hideArtifactHover"
      @pointerdown="allyArtifact && startHold($event, Team.ALLY)"
      @contextmenu="allyArtifact && onContextMenu($event, Team.ALLY)"
    >
      <div class="artifact-circle">
        <ArtifactImage v-if="allyArtifact" :artifact="allyArtifact" />
        <span v-else class="retired-artifact" :title="i18n.t('app.retired')">?</span>
      </div>
      <GridPointer v-if="ctx.perspective" />
      <HoldRing v-if="holdingTeam === Team.ALLY" />
    </div>

    <!-- Enemy artifact (host cell: right of cell 45). Behind the character layer
         (DOM order) unless the inverted view rotates it to the near edge. -->
    <div
      v-if="(enemyArtifact || enemyRetired) && enemySlotVisible"
      class="grid-artifact inspectable"
      :class="{ readonly, front: enemySlotInFront, 'invalid-drop': invalidDrop(Team.ENEMY) }"
      :style="getEnemyStyles"
      :draggable="canDrag && !!enemyArtifact"
      @click="!readonly && handleArtifactClick(Team.ENEMY)"
      @dragstart="handleArtifactDragStart($event, Team.ENEMY)"
      @dragend="handleArtifactDragEnd"
      @dragover="allowArtifactDrop($event, Team.ENEMY)"
      @dragleave="clearInvalidDrop"
      @drop="handleArtifactDrop($event, Team.ENEMY)"
      @mouseenter="showArtifactTooltip($event, enemyArtifact, Team.ENEMY)"
      @mouseleave="hideArtifactHover"
      @pointerdown="enemyArtifact && startHold($event, Team.ENEMY)"
      @contextmenu="enemyArtifact && onContextMenu($event, Team.ENEMY)"
    >
      <div class="artifact-circle">
        <ArtifactImage v-if="enemyArtifact" :artifact="enemyArtifact" />
        <span v-else class="retired-artifact" :title="i18n.t('app.retired')">?</span>
      </div>
      <GridPointer v-if="ctx.perspective" />
      <HoldRing v-if="holdingTeam === Team.ENEMY" />
    </div>

    <ArtifactTooltip
      v-if="hoveredEl && hoveredArtifact"
      :artifact="hoveredArtifact"
      :target-element="hoveredEl"
      variant="detailed"
      :hint="[
        i18n.t('app.hold-for-details'),
        i18n.t(showHover ? 'app.turn-off-hover-details' : 'app.turn-off-placement-tips'),
      ]"
    />

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
/* Under auto an unfilled cell takes no pointer events inside it, so drops there are lost. */
.artifact-cell.droppable {
  pointer-events: all;
}

.artifact-cell.invalid-drop {
  stroke: var(--color-danger-text);
  stroke-width: var(--tile-highlight-stroke-width);
  filter: var(--invalid-drop-glow);
}

.grid-artifact.invalid-drop {
  opacity: 0.55;
}

.grid-artifact.rules-faded {
  opacity: 0.35;
}

.rules-own .artifact-circle {
  box-shadow: 0 0 0 3px var(--placement-ring-focus);
}

.rules-named .artifact-circle {
  box-shadow: 0 0 0 3px var(--placement-ring-named);
}

.retired-artifact {
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  font-weight: 700;
  user-select: none;
}
</style>
