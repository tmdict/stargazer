/** * Home.vue - Main application layout */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

import { getMapNames } from '../lib/maps'
import { State } from '../lib/types/state'
import { useToast } from '../composables/useToast'
import { useArtifactStore } from '../stores/artifact'
import { useGameDataStore } from '../stores/gameData'
import { useGridStore, type Breakpoint } from '../stores/grid'
import { useMapEditorStore } from '../stores/mapEditor'
import { useSkillStore } from '../stores/skill'
import { useUrlStateStore } from '../stores/urlState'
import { generateShareableUrl } from '../utils/urlStateManager'
import ArtifactSelection from '../components/ArtifactSelection.vue'
import CharacterSelection from '../components/CharacterSelection.vue'
import DebugGrid from '../components/DebugGrid.vue'
import DragDropProvider from '../components/DragDropProvider.vue'
import GridControls from '../components/GridControls.vue'
import GridManager from '../components/GridManager.vue'
import MapEditor from '../components/MapEditor.vue'
import TabNavigation from '../components/TabNavigation.vue'
import ToastContainer from '../components/ToastContainer.vue'

// Perspective Mode Configuration
const PERSPECTIVE_VERTICAL_COMPRESSION = 0.55
const DEFAULT_SVG_HEIGHT = 600 // Default SVG height

// Use Pinia stores
const gridStore = useGridStore()
const gameDataStore = useGameDataStore()
const urlStateStore = useUrlStateStore()
const artifactStore = useArtifactStore()
const mapEditorStore = useMapEditorStore()
const skillStore = useSkillStore()
const { success, error } = useToast()

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
const showHexIds = ref(true)
const showPerspective = ref(true)
const showSkills = ref(true)

// Vertical scale compensation - automatically inverse of grid compression when in perspective mode
const verticalScaleComp = computed(() => {
  return showPerspective.value ? 1 / PERSPECTIVE_VERTICAL_COMPRESSION : 1.0
})

// Debug grid ref
const debugGridRef = ref<InstanceType<typeof DebugGrid> | null>(null)

// Map editor state
const selectedMapEditorState = ref<State>(State.DEFAULT)

// Breakpoint thresholds for grid resize
const MOBILE_BREAKPOINT = 480
const TABLET_BREAKPOINT = 768

// Track current breakpoint instead of exact width
const currentBreakpoint = ref<Breakpoint>('desktop')

const getBreakpoint = (width: number): Breakpoint => {
  if (width <= MOBILE_BREAKPOINT) return 'mobile'
  if (width <= TABLET_BREAKPOINT) return 'tablet'
  return 'desktop'
}

const handleResize = () => {
  const newBreakpoint = getBreakpoint(window.innerWidth)

  // Only update if breakpoint actually changed
  if (newBreakpoint !== currentBreakpoint.value) {
    const previousBreakpoint = currentBreakpoint.value
    currentBreakpoint.value = newBreakpoint
    gridStore.updateBreakpoint(newBreakpoint)

    // Automatically enable flat view (disable perspective) when moving to mobile
    if (newBreakpoint === 'mobile' && previousBreakpoint !== 'mobile') {
      showPerspective.value = false
    }
  }
}

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
// After data is loaded, try to restore state from URL
if (gameDataStore.dataLoaded) {
  const restoredState = urlStateStore.restoreStateFromUrl()
  // Apply display flags and map from URL if they exist
  if (restoredState) {
    showHexIds.value = restoredState.showHexIds ?? true
    showArrows.value = restoredState.showArrows ?? true
    showPerspective.value = restoredState.showPerspective ?? true
    
    // Apply map key if present
    if (restoredState.mapKey) {
      selectedMap.value = restoredState.mapKey
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
      },
      selectedMap.value,
    )

    // Copy URL to clipboard
    await navigator.clipboard.writeText(shareableUrl)
    success('Copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy grid link:', err)
    error('Failed to copy link')
  }
}

const handleCopyImage = async () => {
  try {
    // Import html-to-image dynamically
    const { toPng } = await import('html-to-image')

    // Get the perspective container to capture all transforms
    const containerElement = document.querySelector('.perspective-container') as HTMLElement
    if (!containerElement) {
      console.error('Perspective container not found')
      error('Failed to copy image')
      return
    }

    // Generate PNG from the perspective container (includes all transforms)
    const dataUrl = await toPng(containerElement, {
      quality: 1.0,
      pixelRatio: 2, // Higher quality export
      backgroundColor: 'transparent', // Transparent background
    })

    // Convert data URL to blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()

    // Copy to clipboard using Clipboard API
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ])
      success('Copied to clipboard!')
    } else {
      // Fallback: show message for manual copy
      error('Clipboard not supported')
    }
  } catch (err) {
    console.error('Failed to copy grid image:', err)
    error('Failed to copy image')
  }
}

const handleDownload = async () => {
  try {
    // Import html-to-image dynamically
    const { toPng } = await import('html-to-image')

    // Get the perspective container to capture all transforms
    const containerElement = document.querySelector('.perspective-container') as HTMLElement
    if (!containerElement) {
      console.error('Perspective container not found')
      error('Failed to download grid')
      return
    }

    // Generate PNG from the perspective container (includes all transforms)
    const dataUrl = await toPng(containerElement, {
      quality: 1.0,
      pixelRatio: 2, // Higher quality export
      backgroundColor: 'transparent', // Transparent background
    })

    // Create download link
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const timeStr =
      now.toTimeString().split(' ')[0].replace(/:/g, '') +
      now.getMilliseconds().toString().padStart(3, '0')
    const link = document.createElement('a')
    link.download = `stargazer-${dateStr}-${timeStr}.png`
    link.href = dataUrl

    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    success('Grid downloaded!')
  } catch (err) {
    console.error('Failed to export grid:', err)
    error('Download failed')
  }
}

const handleMapEditorStateSelected = (state: State) => {
  selectedMapEditorState.value = state
}

const handleClearMap = () => {
  mapEditorStore.resetToCurrentMap()
}

// Lifecycle hooks for viewport management
onMounted(() => {
  // Initial setup
  currentBreakpoint.value = getBreakpoint(window.innerWidth)
  gridStore.updateBreakpoint(currentBreakpoint.value)

  // If starting on mobile, automatically enable flat view
  if (currentBreakpoint.value === 'mobile') {
    showPerspective.value = false
  }

  // Add resize listener (no debouncing needed)
  window.addEventListener('resize', handleResize)

  // Handle orientation change
  window.addEventListener('orientationchange', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('orientationchange', handleResize)
})
</script>

<template>
  <main>
    <DragDropProvider>
      <div class="sections-container">
        <div class="section">
          <!-- Grid and Debug Layout -->
          <div class="grid-and-debug">
            <!-- Grid Manager Component -->
            <div class="perspective-container">
              <div
                :style="
                  showPerspective
                    ? { transform: `scaleY(${PERSPECTIVE_VERTICAL_COMPRESSION})` }
                    : {}
                "
                style="transform-origin: center; transition: transform 0.3s ease-out"
              >
                <GridManager
                  :characters="gameDataStore.characters"
                  :character-images="gameDataStore.characterImages"
                  :artifact-images="gameDataStore.artifactImages"
                  :icons="gameDataStore.icons"
                  :show-arrows="showArrows"
                  :show-hex-ids="showHexIds"
                  :show-debug="showDebug"
                  :show-skills="showSkills"
                  :is-map-editor-mode="activeTab === 'mapEditor'"
                  :selected-map-editor-state="selectedMapEditorState"
                  :showPerspective="showPerspective"
                  :debugGridRef="debugGridRef"
                  :verticalScaleComp="verticalScaleComp"
                  :defaultSvgHeight="DEFAULT_SVG_HEIGHT"
                />
              </div>
            </div>

            <!-- Debug Panel (outside perspective transforms) -->
            <div v-if="showDebug" class="debug-panel">
              <DebugGrid ref="debugGridRef" />
            </div>
          </div>

          <!-- Grid Display Toggle -->
          <GridControls
            :showDebug="showDebug"
            :showArrows="showArrows"
            :showHexIds="showHexIds"
            :showPerspective="showPerspective"
            :showSkills="showSkills"
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
            :activeTab="activeTab"
            :availableMaps="availableMaps"
            :selectedMap="selectedMap"
            @tab-change="handleTabChange"
            @map-change="handleMapChange"
          >
            <!-- Tab Content -->
            <!-- Characters Tab -->
            <div v-show="activeTab === 'characters'" class="tab-panel">
              <CharacterSelection
                :characters="gameDataStore.characters"
                :characterImages="gameDataStore.characterImages"
                :icons="gameDataStore.icons"
                :isDraggable="true"
              />
            </div>
            <!-- Artifacts Tab -->
            <div v-show="activeTab === 'artifacts'" class="tab-panel">
              <ArtifactSelection
                :artifacts="gameDataStore.artifacts"
                :artifactImages="gameDataStore.artifactImages"
                :icons="gameDataStore.icons"
              />
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
/* Override main max-width for large screens - only for Home page */
@media (min-width: 1281px) {
  main {
    --main-max-width: none;
  }
}

/* Container for sections - side by side on large screens */
.sections-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: 100%;
}

/* Side-by-side layout for screens > 1280px */
@media (min-width: 1281px) {
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

@media (max-width: 768px) {
  .tab-panel {
    padding: var(--spacing-lg);
  }
}

@media (max-width: 480px) {
  .tab-panel {
    padding: var(--spacing-sm);
  }
}

/* Perspective container - simplified to just hold the grid */
.perspective-container {
  display: flex;
  justify-content: center;
  align-items: center;
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
