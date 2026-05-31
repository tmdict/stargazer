<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ArtifactSelection from '@/components/ArtifactSelection.vue'
import CharacterSelection from '@/components/CharacterSelection.vue'
import DebugPanel from '@/components/debug/DebugPanel.vue'
import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import GridControls from '@/components/grid/GridControls.vue'
import MapEditor from '@/components/MapEditor.vue'
import TabNavigation from '@/components/ui/TabNavigation.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBottomSheet } from '@/composables/useBottomSheet'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGridExport } from '@/composables/useGridExport'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { getMapNames } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { useArtifactStore } from '@/stores/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'
import { useMapEditorStore } from '@/stores/mapEditor'
import { useSkillStore } from '@/stores/skill'
import { useUrlStateStore } from '@/stores/urlState'
import { generateShareableUrl, getEncodedStateFromUrl } from '@/utils/urlStateManager'

// Perspective Mode Configuration
const PERSPECTIVE_VERTICAL_COMPRESSION = 0.55
const DEFAULT_SVG_HEIGHT = 600 // Default SVG height

// Use Pinia stores and router
const gridStore = useGridStore()
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const urlStateStore = useUrlStateStore()
const artifactStore = useArtifactStore()
const mapEditorStore = useMapEditorStore()
const skillStore = useSkillStore()
const { success, error } = useToast()
const router = useRouter()
const route = useRoute()
const { showPerspective } = useBreakpoint()
const { copyToClipboard, downloadAsImage } = useGridExport()

// Connect grid and skill manager
gridStore._getGrid().skillManager = skillStore._getSkillManager()

// Tab state management
const validTabs = ['characters', 'artifacts', 'mapEditor', 'debug'] as const
type ValidTab = (typeof validTabs)[number]

// The `?t=skills` query param resolves to the dedicated /skills route.
if (route.query.t === 'skills') {
  router.replace('/skills')
}

const getInitialTab = (): string => {
  const tabParam = route.query.t as string | undefined
  if (tabParam && validTabs.includes(tabParam as ValidTab)) {
    return tabParam
  }
  return 'characters'
}

const activeTab = ref(getInitialTab())

// Mobile: the tab panel (roster) is a pull-up bottom sheet over the grid.
const { targetHexId, liftedHexId, clearTargetHex } = useSelectionState()
const {
  expanded: sheetExpanded,
  dragging: sheetDragging,
  sheetStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  collapse: collapseSheet,
} = useBottomSheet({ peek: 96, expanded: 0.62 })

// Tapping a grid cell targets it: jump to the roster, open the sheet; placing
// (which clears the target) collapses it so the grid result is visible.
watch(targetHexId, (id) => {
  if (id !== null) {
    activeTab.value = 'characters'
    sheetExpanded.value = true
  } else {
    sheetExpanded.value = false
  }
})

// Lifting a hero (tap-to-move) collapses the sheet so every destination cell on
// the grid stays tappable for the drop.
watch(liftedHexId, (id) => {
  if (id !== null) collapseSheet()
})

// Tap-scrim: dismiss the sheet and cancel any pending placement target.
const dismissSheet = () => {
  clearTargetHex()
  collapseSheet()
}

// Debug visualization is active iff the user is on the Debug tab. Derived rather
// than its own ref so tab is the single source of truth (browser refresh on the
// Debug tab keeps debug on, switching away turns it off).
const showDebug = computed(() => activeTab.value === 'debug')

// Map management
const availableMaps = getMapNames().filter((m) => m.key.startsWith('arena'))
const selectedMap = ref('arena1')

// Grid display toggles
const showArrows = ref(false)
const showHexIds = ref(false)
const showSkills = ref(true)

// Team view toggle (single source of truth lives in gridStore so layer components
// reading viewBoxBounds/visibleHexes stay in sync). When team view turns on,
// auto-uncheck skills/targeting — they're disabled in the controls panel
// while it's active and stay off when team view exits (manual re-enable).
// (Debug is a tab, hidden while team view is active, so no reset needed for it.)
watch(
  () => gridStore.teamView,
  (active) => {
    if (active) {
      showSkills.value = false
      showArrows.value = false
    }
  },
)

// Debug grid ref
const debugPanelRef = ref<InstanceType<typeof DebugPanel> | null>(null)

// Map editor state
const selectedMapEditorState = ref<State>(State.DEFAULT)

// Map editor mode is incompatible with these display modes; force them off when entering.
const resetForMapEditor = () => {
  showArrows.value = false
  showHexIds.value = false
  gridStore.teamView = false
}

// Debug shows the full grid, so team view (which crops to ally tiles) doesn't apply.
const resetForDebug = () => {
  gridStore.teamView = false
}

const applyTabResets = (tab: string) => {
  if (tab === 'mapEditor') resetForMapEditor()
  else if (tab === 'debug') resetForDebug()
}

const handleTabChange = (tab: string) => {
  activeTab.value = tab

  // Update URL with new tab query parameter
  // Use replace to avoid creating browser history entries for tab switches
  router.replace({
    query: {
      ...route.query,
      t: tab,
    },
  })

  applyTabResets(tab)
}

const handleMapChange = (mapKey: string) => {
  const success = gridStore.switchMap(mapKey)
  if (success) {
    selectedMap.value = mapKey
    // Reset skill manager state and reconnect to the new grid
    skillStore._getSkillManager().reset()
    gridStore._getGrid().skillManager = skillStore._getSkillManager()
  }
}

// Watch for route query changes (browser back/forward navigation)
watch(
  () => route.query.t,
  (newTab) => {
    if (newTab && validTabs.includes(newTab as ValidTab)) {
      activeTab.value = newTab as string

      applyTabResets(newTab as string)
    }
  },
)

// Initialize data immediately (synchronous)
gameDataStore.initializeData()
i18nStore.initialize()
// After data is loaded, try to restore state from URL
if (gameDataStore.dataLoaded) {
  const encodedState = getEncodedStateFromUrl()
  if (encodedState) {
    // Only try to restore if there's a query param
    const result = urlStateStore.restoreFromEncodedState(encodedState)

    if (result.success && result.displayFlags) {
      // Apply display flags from URL
      showHexIds.value = result.displayFlags.showHexIds ?? false
      showArrows.value = result.displayFlags.showArrows ?? false
      showPerspective.value = result.displayFlags.showPerspective ?? false
      showSkills.value = result.displayFlags.showSkills ?? true
      gridStore.teamView = result.displayFlags.teamView ?? false
      success('Grid loaded from URL!')
    } else {
      error('Invalid URL - using default grid')
    }
  }
}

// Action button handlers

const handleCopyLink = async () => {
  try {
    // Generate shareable URL with current grid state exactly as it appears
    const shareableUrl = generateShareableUrl(
      gridStore.getAllTiles,
      artifactStore.allyArtifactId,
      artifactStore.enemyArtifactId,
      {
        showHexIds: showHexIds.value,
        showArrows: showArrows.value,
        showPerspective: showPerspective.value,
        showSkills: showSkills.value,
        teamView: gridStore.teamView,
      },
    )

    // Convert to share link format
    const urlParams = new URLSearchParams(shareableUrl.split('?')[1])
    const encodedState = urlParams.get('g')
    const shareLink = `${window.location.origin}/share?g=${encodedState}`

    // Copy share URL to clipboard
    await navigator.clipboard.writeText(shareLink)

    // Navigate to share page with state indicating link was copied
    router.push({
      path: '/share',
      query: { g: encodedState },
      state: { linkCopied: true },
    })
  } catch (err) {
    console.error('Failed to copy grid link:', err)
    error('Failed to copy link')
  }
}

const handleCopyImage = async () => {
  await copyToClipboard({
    showPerspective: showPerspective.value,
    perspectiveCompression: PERSPECTIVE_VERTICAL_COMPRESSION,
  })
}

const handleDownload = async () => {
  await downloadAsImage({
    showPerspective: showPerspective.value,
    perspectiveCompression: PERSPECTIVE_VERTICAL_COMPRESSION,
  })
}

const handleMapEditorStateSelected = (state: State) => {
  selectedMapEditorState.value = state
}

const handleApplyAllTiles = (state: State) => {
  mapEditorStore.applyAllHexStates(state)
}

const handleResetMap = () => {
  mapEditorStore.resetToCurrentMap()
}
</script>

<template>
  <main>
    <!-- Tap-scrim: dismisses the expanded sheet (and cancels a pending target). -->
    <div v-if="sheetExpanded" class="sheet-backdrop" @click="dismissSheet" />
    <DragDropProvider>
      <div class="sections-container">
        <div class="section">
          <GridContainer
            :characters="gameDataStore.characters"
            :show-arrows="showArrows"
            :show-hex-ids="showHexIds"
            :show-debug="showDebug"
            :show-skills="showSkills"
            :is-map-editor-mode="activeTab === 'mapEditor'"
            :selected-map-editor-state="selectedMapEditorState"
            :show-perspective
            :debugPanelRef
            :perspective-vertical-compression="PERSPECTIVE_VERTICAL_COMPRESSION"
            :default-svg-height="DEFAULT_SVG_HEIGHT"
          />
          <GridControls
            :showArrows
            :showHexIds
            :showPerspective
            :showSkills
            :teamView="gridStore.teamView"
            :hideTeamView="activeTab === 'mapEditor' || activeTab === 'debug'"
            :hideTeamControls="activeTab === 'mapEditor' || activeTab === 'debug'"
            @update:showArrows="showArrows = $event"
            @update:showHexIds="showHexIds = $event"
            @update:showPerspective="showPerspective = $event"
            @update:showSkills="showSkills = $event"
            @update:teamView="gridStore.teamView = $event"
            @copyLink="handleCopyLink"
            @copyImage="handleCopyImage"
            @download="handleDownload"
          />
        </div>

        <!-- Tab Navigation (a pull-up bottom sheet over the grid on mobile). -->
        <div
          class="section tab-section"
          :class="{ 'is-dragging': sheetDragging }"
          :style="sheetStyle"
        >
          <div
            class="sheet-handle-area"
            @touchstart.passive="onTouchStart"
            @touchmove.passive="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @mousedown="onMouseDown"
          >
            <span class="sheet-handle" />
          </div>
          <TabNavigation
            :activeTab
            :availableMaps
            :selectedMap
            @tab-change="handleTabChange"
            @map-change="handleMapChange"
          >
            <!-- Tab Content -->
            <!-- Characters Tab -->
            <div v-show="activeTab === 'characters'" class="tab-panel">
              <CharacterSelection :characters="gameDataStore.characters" :isDraggable="true" />
            </div>
            <!-- Artifacts Tab -->
            <div v-show="activeTab === 'artifacts'" class="tab-panel">
              <ArtifactSelection :artifacts="gameDataStore.artifacts" />
            </div>
            <!-- Map Editor Tab -->
            <div v-show="activeTab === 'mapEditor'" class="tab-panel">
              <MapEditor
                @state-selected="handleMapEditorStateSelected"
                @apply-all-tiles="handleApplyAllTiles"
                @reset-map="handleResetMap"
                @arena-selected="handleMapChange"
              />
            </div>
            <!-- Debug Tab -->
            <div v-show="activeTab === 'debug'" class="tab-panel">
              <DebugPanel ref="debugPanelRef" />
            </div>
          </TabNavigation>
        </div>
      </div>
    </DragDropProvider>

    <!-- Toast Container -->
    <ToastContainer />
  </main>
</template>

<style scoped>
/* Container for sections - side by side on large screens */
.sections-container {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

/* The drag handle only exists in the mobile bottom-sheet mode. */
.sheet-handle-area {
  display: none;
}

/* Scrim behind the expanded sheet (only rendered when expanded); a tap
   collapses it. Mirrors SkillsBrowser's sheet backdrop. */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 799;
  background: rgba(0, 0, 0, 0.15);
  animation: sheet-fade-in 0.2s ease;
}
@keyframes sheet-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile/tablet (matches the grid picker's scale < 1 breakpoint, <= 768px):
   the tab panel becomes a pull-up bottom sheet over the grid. Tapping a tile
   targets it and opens this sheet; tapping a character fills the targeted tile.
   Mirrors the skills-page sheet (SkillsBrowser) — keep the two in sync. */
@media (max-width: 768px) {
  main {
    padding-bottom: 96px; /* clear the collapsed peek */
  }

  /* Trim the grid card's side padding so the grid claims more of the narrow
     viewport instead of floating in whitespace. */
  .sections-container > .section:first-child {
    padding-left: var(--spacing-md);
    padding-right: var(--spacing-md);
  }

  .tab-section {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 62vh;
    padding: 0;
    background: var(--color-bg-primary);
    border-radius: var(--radius-large) var(--radius-large) 0 0;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
    z-index: 800;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Collapsed peek before the composable engages; it sets the same inline. */
    transform: translateY(calc(62vh - 96px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .tab-section.is-dragging {
    transition: none;
  }

  .sheet-handle-area {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    touch-action: none;
    cursor: grab;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.22);
  }

  /* TabNavigation fills the sheet (its -2em — which escapes the section's
     normal padding, zeroed here — is neutralized); its .tab-content scrolls so
     the tab buttons stay pinned. */
  .tab-section > :deep(.tab-container) {
    flex: 1;
    min-height: 0;
    height: auto;
    margin: 0;
  }
  .tab-section :deep(.tab-content) {
    overflow-y: auto;
  }
}

/* Side-by-side layout. Floor is dictated by the left column's fixed width:
   grid (600px) + padding pushes it to ~660px. Below ~1220px, the right
   column gets uncomfortably narrow and tab content cramps even with wrap.

   container-type: inline-size on the right column lets TabNavigation's
   @container queries respond to the right column's actual width (which is
   what determines whether tabs need to wrap), independent of viewport.

   NOTE: this breakpoint must stay in sync with the @media rules in each
   tab-content panel component (CharacterSelection, ArtifactSelection,
   MapEditor, DebugPanel) and .tab-panel below — they gate the flex-fill
   + internal scroll behavior on the same condition. */
@media (min-width: 1220px) {
  .sections-container {
    flex-direction: row;
    align-items: flex-start;
  }

  .sections-container > .section:first-child {
    flex: 0 0 660px;
    width: 660px;
  }

  /* Right column is height-capped to viewport so long tab content (e.g. the
     character grid) scrolls within the panel rather than stretching the page.
     The TabNavigation child fills the column via flex; its internal
     .tab-content handles the scroll so the tab buttons stay pinned. The cap
     is released below 1024px (column-stacked layout), where there's no row
     to keep aligned and the natural page scroll is correct. */
  .sections-container > .section:last-child {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    max-height: 100vh;
    container-type: inline-size;
  }

  .sections-container > .section:last-child > * {
    flex: 1;
    min-height: 0;
  }
}

.tab-panel {
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

/* On wide screens, the active tab panel flex-fills the right column so the
   panel component inside (whose max-height is overridden in its own scoped
   CSS at the same breakpoint) can stretch to viewport-bounded height. */
@media (min-width: 1220px) {
  .tab-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .tab-panel {
    padding: var(--spacing-lg) 0;
  }
}

@media (max-width: 480px) {
  main {
    padding-bottom: 88px;
  }
  .sections-container > .section:first-child {
    padding-left: var(--spacing-xs);
    padding-right: var(--spacing-xs);
  }
  .tab-panel {
    padding: var(--spacing-sm) 0;
  }
}
</style>
