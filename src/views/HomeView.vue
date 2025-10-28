/** * Home.vue - Main application layout */
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import ArtifactSelection from '@/components/ArtifactSelection.vue'
import CharacterSelection from '@/components/CharacterSelection.vue'
import DebugGrid from '@/components/debug/DebugGrid.vue'
import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import GridControls from '@/components/grid/GridControls.vue'
import MapEditor from '@/components/MapEditor.vue'
import SkillsSelection from '@/components/SkillsSelection.vue'
import TabNavigation from '@/components/ui/TabNavigation.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGridExport } from '@/composables/useGridExport'
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
const { showPerspective } = useBreakpoint()
const { copyToClipboard, downloadAsImage } = useGridExport()

// Connect grid and skill manager
gridStore._getGrid().skillManager = skillStore._getSkillManager()

// Tab state management
const activeTab = ref('characters')
const showDebug = ref(false)

// Map management
const availableMaps = getMapNames()
const selectedMap = ref('arena1')

// Grid display toggles
const showArrows = ref(false)
const showHexIds = ref(false)
const showSkills = ref(true)

// Debug grid ref
const debugGridRef = ref<InstanceType<typeof DebugGrid> | null>(null)

// Map editor state
const selectedMapEditorState = ref<State>(State.DEFAULT)

const handleTabChange = (tab: string) => {
  activeTab.value = tab

  // When entering Map Editor mode, hide details to prevent flashing
  if (tab === 'mapEditor') {
    showArrows.value = false
    showHexIds.value = false
  }
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
      showPerspective.value = result.displayFlags.showPerspective ?? true
      showSkills.value = result.displayFlags.showSkills ?? true
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

const handleClearMap = () => {
  mapEditorStore.resetToCurrentMap()
}
</script>

<template>
  <main>
    <DragDropProvider>
      <div class="sections-container">
        <div class="section">
          <!-- Grid and Debug Layout -->
          <div class="grid-and-debug">
            <!-- Grid Manager Component -->
            <GridContainer
              :characters="gameDataStore.characters"
              :show-arrows="showArrows"
              :show-hex-ids="showHexIds"
              :show-debug="showDebug"
              :show-skills="showSkills"
              :is-map-editor-mode="activeTab === 'mapEditor'"
              :selected-map-editor-state="selectedMapEditorState"
              :show-perspective
              :debugGridRef
              :perspective-vertical-compression="PERSPECTIVE_VERTICAL_COMPRESSION"
              :default-svg-height="DEFAULT_SVG_HEIGHT"
            />

            <!-- Debug Panel (outside perspective transforms) -->
            <div v-if="showDebug" class="debug-panel">
              <DebugGrid ref="debugGridRef" />
            </div>
          </div>

          <!-- Grid Display Toggle -->
          <GridControls
            :showDebug
            :showArrows
            :showHexIds
            :showPerspective
            :showSkills
            @update:showDebug="showDebug = $event"
            @update:showArrows="showArrows = $event"
            @update:showHexIds="showHexIds = $event"
            @update:showPerspective="showPerspective = $event"
            @update:showSkills="showSkills = $event"
            @copyLink="handleCopyLink"
            @copyImage="handleCopyImage"
            @download="handleDownload"
          />
        </div>

        <!-- Tab Navigation -->
        <div class="section">
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
            <!-- Skills Tab -->
            <div v-show="activeTab === 'skills'" class="tab-panel">
              <SkillsSelection :characters="gameDataStore.characters" :isDraggable="true" />
            </div>
            <!-- Map Editor Tab -->
            <div v-show="activeTab === 'mapEditor'" class="tab-panel">
              <MapEditor
                @state-selected="handleMapEditorStateSelected"
                @clear-map="handleClearMap"
              />
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
  gap: var(--spacing-xl);
  width: 100%;
}

/* Side-by-side layout for screens > 1440px */
@media (min-width: 1400px) {
  .sections-container {
    flex-direction: row;
    align-items: flex-start;
  }

  .sections-container > .section:first-child {
    flex: 0 0 660px;
    width: 660px;
  }

  .sections-container > .section:last-child {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.grid-and-debug {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  justify-content: center;
  align-items: center;
  width: 100%;
}

.tab-panel {
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

@media (max-width: 1280px) {
  .sections-container {
    gap: var(--spacing-lg);
  }
}

@media (max-width: 768px) {
  .sections-container {
    gap: 0;
  }

  .tab-panel {
    padding: var(--spacing-lg) 0;
  }
}

@media (max-width: 480px) {
  .tab-panel {
    padding: var(--spacing-sm) 0;
  }
}

/* Debug panel styling (moved from GridManager) */
.debug-panel {
  flex-shrink: 0;
  width: 100%;
  max-width: 860px;
  margin-top: var(--spacing-xl);
}

@media (max-width: 1024px) {
  .debug-panel {
    max-width: 600px;
  }
}
</style>
