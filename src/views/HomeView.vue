<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CharacterSelection from '@/components/CharacterSelection.vue'
import DebugPanel from '@/components/debug/DebugPanel.vue'
import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import GridControls from '@/components/grid/GridControls.vue'
import MapEditor from '@/components/MapEditor.vue'
import SeasonalSelection from '@/components/SeasonalSelection.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import TabNavigation from '@/components/ui/TabNavigation.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
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
const validTabs = ['characters', 'seasonal', 'mapEditor', 'debug'] as const
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
const sheetExpanded = ref(false)

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
  if (id !== null) sheetExpanded.value = false
})

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

        <!-- Roster (a pull-up bottom sheet over the grid on mobile). -->
        <BottomSheet v-model:expanded="sheetExpanded" @dismiss="clearTargetHex">
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
            <!-- Seasonal Tab -->
            <div v-show="activeTab === 'seasonal'" class="tab-panel">
              <SeasonalSelection
                :artifacts="gameDataStore.artifacts"
                :phantimals="gameDataStore.phantimals"
              />
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
        </BottomSheet>
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

/* Mobile: clear the collapsed sheet peek and trim the grid card's side padding
   so the grid claims the narrow viewport. The roster sheet chrome lives in
   BottomSheet; TabNavigation owns its own in-sheet fill/scroll. */
@media (max-width: 768px) {
  main {
    padding-bottom: 64px;
  }

  .sections-container > .section:first-child {
    padding-left: var(--spacing-md);
    padding-right: var(--spacing-md);
  }
}

/* Side-by-side layout. Floor is dictated by the left column's fixed width:
   grid (600px) + padding pushes it to ~660px. Below ~1220px the columns stack.
   The right column's height-cap + flex-fill (so long tab content scrolls within
   it) lives in BottomSheet.

   NOTE: this breakpoint must stay in sync with the @media rules in each
   tab-content panel component (CharacterSelection, SeasonalSelection,
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
    padding-bottom: 64px;
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
