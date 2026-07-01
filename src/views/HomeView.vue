<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CharacterSelection from '@/components/CharacterSelection.vue'
import DebugPanel from '@/components/debug/DebugPanel.vue'
import DragDropProvider from '@/components/DragDropProvider.vue'
import ArenaDropdown from '@/components/grid/ArenaDropdown.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import GridControls from '@/components/grid/GridControls.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import MapEditor from '@/components/MapEditor.vue'
import SeasonalSelection from '@/components/SeasonalSelection.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import TabView from '@/components/ui/TabView.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useDisplayFlags } from '@/composables/useDisplayFlags'
import { useGridExport } from '@/composables/useGridExport'
import { useArenaPersistence } from '@/composables/useGridPersistence'
import { useSelectionState } from '@/composables/useSelectionState'
import { useShareLink } from '@/composables/useShareLink'
import { useToast } from '@/composables/useToast'
import { State } from '@/lib/types/state'
import { useArtifactStore } from '@/stores/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useMapEditorStore } from '@/stores/mapEditor'
import { useUrlStateStore } from '@/stores/urlState'
import { serializeGridState } from '@/utils/gridStateSerializer'
import { encodeGridStateToUrl, getEncodedStateFromUrl } from '@/utils/urlStateManager'

// Perspective Mode Configuration
const PERSPECTIVE_VERTICAL_COMPRESSION = 0.55
const DEFAULT_SVG_HEIGHT = 600 // Default SVG height

const gridStore = useGridStore()
const grids = useGrids()
// The Arena is the single-board case. Start from a clean single board and default
// display globals so it never inherits state left in the shared store by /share
// or the 5 v 5 page; the saved arena (or a ?g= link) is applied on top below.
grids.setGridCount(1)
grids.hexSizeMode = 'breakpoint'
grids.teamView = false
grids.inverted = false
const activeContext = computed(() => grids.active!)
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const urlStateStore = useUrlStateStore()
const artifactStore = useArtifactStore()
const mapEditorStore = useMapEditorStore()
const { success, error } = useToast()
const router = useRouter()
const route = useRoute()
const { copyToClipboard, downloadAsImage } = useGridExport()
const shareLink = useShareLink()

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

// Roster tabs. Debug is desktop-only (hidden on mobile to save space; the arena
// is selectable in the Map Editor tab).
const tabs = computed(() => [
  { key: 'characters', label: i18nStore.t('app.characters') },
  { key: 'seasonal', label: i18nStore.t('app.seasonal') },
  { key: 'mapEditor', label: i18nStore.t('app.maps') },
  { key: 'debug', label: i18nStore.t('app.debug'), hideMobile: true },
])

// Mobile: the tab panel (roster) is a pull-up bottom sheet over the grid.
const { targetHexId, liftedHexId, tabRequest, clearTargetHex, clearTargets, clearLiftedHex } =
  useSelectionState()
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

// Mobile: a component (e.g. an on-grid artifact cell) requesting the roster open
// on a specific tab: switch to it and expand the sheet.
watch(tabRequest, (req) => {
  if (!req) return
  activeTab.value = req.tab
  sheetExpanded.value = true
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

const { showArrows, showGridInfo, showSkills, showPerspective, toFlags, applyFlags } =
  useDisplayFlags()

const debugPanelRef = ref<InstanceType<typeof DebugPanel> | null>(null)

const selectedMapEditorState = ref<State>(State.DEFAULT)

// Opt-in tile painting, off by default: a Map-tab click then places a character like
// the other tabs, and only turning this on makes clicks paint the selected tile. The
// editor lives only in the Map tab, so painting is gated on both.
const editorEnabled = ref(false)
const mapEditorActive = computed(() => activeTab.value === 'mapEditor' && editorEnabled.value)

// Tile painting is incompatible with these display modes; force them off when the
// editor turns on (not on Map-tab entry, so placing characters there keeps them).
const resetForMapEditor = () => {
  showArrows.value = false
  showGridInfo.value = false
  gridStore.teamView = false
}
watch(mapEditorActive, (active) => {
  if (active) resetForMapEditor()
})

// Debug shows the full grid, so team view (which crops to ally tiles) doesn't apply.
const resetForDebug = () => {
  gridStore.teamView = false
}

const applyTabResets = (tab: string) => {
  if (tab === 'debug') resetForDebug()
}

const handleTabChange = (tab: string) => {
  activeTab.value = tab

  // Push so each tab switch is a history entry, so back/forward navigates tabs.
  router.push({
    query: {
      ...route.query,
      t: tab,
    },
  })

  applyTabResets(tab)
}

// Switches the displayed arena; shared by the Map Editor tab and the ArenaDropdown.
const handleMapChange = (mapKey: string) => {
  gridStore.switchMap(mapKey)
}

// Browser back/forward (and the push above) change the query; mirror it onto the
// active tab. Landing back on a bare `/` (no `?t=`) restores the default.
watch(
  () => route.query.t,
  (newTab) => {
    const tab = newTab && validTabs.includes(newTab as ValidTab) ? (newTab as string) : 'characters'
    activeTab.value = tab
    applyTabResets(tab)
  },
)

// Initialize data immediately (synchronous)
gameDataStore.initializeData()
i18nStore.initialize()

const arenaPersistence = useArenaPersistence(toFlags)

// A ?g= link takes priority and is applied in setup (before paint, matching the
// existing share behavior); the autosave on mount then overwrites the saved arena
// with it. A link that fails to decode is treated as absent, so the saved arena
// still loads and the autosave can't wipe it with the empty board.
const sharedLink = gameDataStore.dataLoaded ? getEncodedStateFromUrl() : null
let sharedLinkRestored = false
if (sharedLink) {
  const result = urlStateStore.restoreFromEncodedState(sharedLink)
  if (result.success && result.displayFlags) {
    sharedLinkRestored = true
    applyFlags(result.displayFlags)
    // The restore replaced the board; drop any stale mobile tap/lift selection.
    clearTargetHex()
    clearLiftedHex()
    success(i18nStore.t('app.grid-loaded'))
  } else {
    error(i18nStore.t('app.invalid-url'))
  }
}

// The initial tab comes straight from ?t= without passing through handleTabChange,
// so enforce its display resets here, after a restore, which can introduce the
// conflicting flags (e.g. team view in a share link while ?t=debug).
applyTabResets(activeTab.value)

// No restored share link: restore the saved arena. Done on mount because
// localStorage is unavailable during SSG, so the pre-rendered empty grid hydrates
// cleanly first. Autosave starts after the restore so the restore isn't what
// triggers a write.
onMounted(() => {
  if (!sharedLinkRestored && gameDataStore.dataLoaded) {
    const saved = arenaPersistence.load()
    if (saved) {
      const result = urlStateStore.restoreFromEncodedState(saved)
      if (result.success && result.displayFlags) {
        applyFlags(result.displayFlags)
        applyTabResets(activeTab.value)
      }
    }
  }
  arenaPersistence.startAutosave()
})

// Action button handlers

const handleCopyLink = () => {
  // Serialize the board exactly as it appears, then copy + open the read-only share.
  const encodedState = encodeGridStateToUrl(
    serializeGridState(
      gridStore.getAllTiles,
      artifactStore.allyArtifactId,
      artifactStore.enemyArtifactId,
      toFlags(),
      activeContext.value.getParagon,
    ),
  )
  return shareLink(encodedState)
}

const handleCopyImage = async () => {
  await copyToClipboard({
    showPerspective: showPerspective.value,
    perspectiveCompression: PERSPECTIVE_VERTICAL_COMPRESSION,
    appendTarget: '.team-power',
  })
}

const handleDownload = async () => {
  await downloadAsImage({
    showPerspective: showPerspective.value,
    perspectiveCompression: PERSPECTIVE_VERTICAL_COMPRESSION,
    filePrefix: 'team',
    appendTarget: '.team-power',
  })
}

const handleMapEditorStateSelected = (state: State) => {
  selectedMapEditorState.value = state
}

const handleApplyAllTiles = (state: State) => {
  mapEditorStore.resetAllHexesToState(state)
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
            :context="activeContext"
            :characters="gameDataStore.characters"
            :show-arrows="showArrows"
            :show-grid-info="showGridInfo"
            :show-debug="showDebug"
            :show-skills="showSkills"
            :is-map-editor-mode="mapEditorActive"
            :selected-map-editor-state="selectedMapEditorState"
            :show-perspective
            :debug-panel-ref
            :perspective-vertical-compression="PERSPECTIVE_VERTICAL_COMPRESSION"
            :default-svg-height="DEFAULT_SVG_HEIGHT"
          />
          <TeamPowerPanel v-if="showGridInfo && !mapEditorActive" :context="activeContext" />
          <GridControls
            v-model:show-arrows="showArrows"
            v-model:show-grid-info="showGridInfo"
            v-model:show-perspective="showPerspective"
            v-model:show-skills="showSkills"
            v-model:team-view="gridStore.teamView"
            :disable-team-view="mapEditorActive || activeTab === 'debug'"
            :hide-team-controls="mapEditorActive || activeTab === 'debug'"
            @copy-link="handleCopyLink"
            @copy-image="handleCopyImage"
            @download="handleDownload"
          />
        </div>

        <!-- Roster (a pull-up bottom sheet over the grid on mobile). -->
        <BottomSheet v-model:expanded="sheetExpanded" @dismiss="clearTargets">
          <TabView
            :tabs="tabs"
            :model-value="activeTab"
            fill
            eager
            @update:model-value="handleTabChange"
          >
            <template #characters>
              <CharacterSelection :characters="gameDataStore.characters" :is-draggable="true" />
            </template>
            <template #seasonal>
              <SeasonalSelection
                :artifacts="gameDataStore.artifacts"
                :phantimals="gameDataStore.phantimals"
                :is-draggable="true"
              />
            </template>
            <template #mapEditor>
              <MapEditor
                v-model:enabled="editorEnabled"
                @state-selected="handleMapEditorStateSelected"
                @apply-all-tiles="handleApplyAllTiles"
                @reset-map="handleResetMap"
                @arena-selected="handleMapChange"
              />
            </template>
            <template #debug>
              <DebugPanel ref="debugPanelRef" />
            </template>
            <template #actions>
              <ArenaDropdown />
            </template>
          </TabView>
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
   BottomSheet; TabView owns its own in-sheet fill/scroll. */
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
   MapEditor, DebugPanel): they own the flex-fill + internal scroll on the same
   condition (TabView provides the flex shell; the panels scroll). */
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

@media (max-width: 480px) {
  main {
    padding-bottom: 64px;
  }
  .sections-container > .section:first-child {
    padding-left: var(--spacing-xs);
    padding-right: var(--spacing-xs);
  }
}
</style>
