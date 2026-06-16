<script setup lang="ts">
/* The Teams page orchestrator (mirrors WandWarsView): it owns the outer tab state
   and the 5 v 5 board lifecycle/shared state, and renders one TabView (5 v 5 boards
   / Image Stitcher) inside a card plus the roster as a separate sibling card shown
   for 5 v 5. The board lifecycle (setGridCount, sizing, URL restore) lives here so
   it's scoped to route enter/leave, not to a tab switch. */

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TeamsBoards from '@/components/teams/TeamsBoards.vue'
import TeamsRoster from '@/components/teams/TeamsRoster.vue'
import TabView from '@/components/ui/TabView.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGridExport } from '@/composables/useGridExport'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { FIVE_V_FIVE_DEFAULT_MAPS } from '@/lib/maps'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'
import { generateMultiShareableUrl, getEncodedStateFromUrl } from '@/utils/urlStateManager'

// Board size steps down as the window narrows (large desktop / medium tablet /
// small mobile); the row scrolls horizontally so size isn't bound by fitting five.
const LARGE_HEX = { x: 33, y: 33 }
const MEDIUM_HEX = { x: 26, y: 26 }
const MOBILE_HEX = { x: 23, y: 23 }

const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const urlStateStore = useUrlStateStore()
const { copyToClipboard, downloadAsImage } = useGridExport()
const { success, error } = useToast()
const { currentBreakpoint } = useBreakpoint({ autoFlattenOnMobile: false })
const { clearTargetHex, clearLiftedHex } = useSelectionState()

gameDataStore.initializeData()
i18n.initialize()

useHead({ title: 'Teams · Stargazer' })

const activeTab = ref('fiveVFive')
// Image Stitcher is a wide-window-only tool: its tab is hidden on mobile.
const tabs = computed(() => [
  { key: 'fiveVFive', label: i18n.t('app.5-v-5') },
  { key: 'imageStitcher', label: 'Image Stitcher', hideMobile: true },
])

// Display flags drive every board (global controls); the share link serializes them.
const showArrows = ref(false)
const showHexIds = ref(false)
const showPerspective = ref(false)
const showSkills = ref(true)

// At sheet widths (<= tablet) the roster is a pull-up sheet and boards place via
// the cell-tap flow; on desktop the roster is a card and cells use the on-grid popup.
const isSheet = computed(() => currentBreakpoint.value !== 'desktop')

// 5 v 5 pins its own size per breakpoint, not the breakpoint-driven Arena sizing;
// hexSizeMode tells useBreakpoint to leave the size alone.
const applySize = () => {
  grids.hexSize =
    currentBreakpoint.value === 'mobile'
      ? MOBILE_HEX
      : currentBreakpoint.value === 'tablet'
        ? MEDIUM_HEX
        : LARGE_HEX
}
watch(currentBreakpoint, applySize)

grids.setGridCount(FIVE_V_FIVE_DEFAULT_MAPS.length, FIVE_V_FIVE_DEFAULT_MAPS)
grids.hexSizeMode = 'fixed-medium'
applySize()

// Drop any tap-target/lift carried in from another page so it can't show a stale
// highlight or mis-route on board 0 (boards share hex ids).
clearTargetHex()
clearLiftedHex()

// Restore a shared 5 v 5 link (?g=) if one is present.
if (gameDataStore.dataLoaded) {
  const encoded = getEncodedStateFromUrl()
  if (encoded) {
    const result = urlStateStore.restoreMultiFromEncodedState(encoded)
    if (result.success && result.displayFlags) {
      showHexIds.value = result.displayFlags.showHexIds ?? false
      showArrows.value = result.displayFlags.showArrows ?? false
      showPerspective.value = result.displayFlags.showPerspective ?? false
      showSkills.value = result.displayFlags.showSkills ?? true
      grids.teamView = result.displayFlags.teamView ?? false
      success(i18n.t('app.grid-loaded'))
    } else if (result.error && result.error !== 'No state provided') {
      error(i18n.t('app.invalid-url'))
    }
  }
}

onUnmounted(() => {
  grids.hexSizeMode = 'breakpoint'
  grids.setGridCount(1)
  clearTargetHex()
  clearLiftedHex()
})

// Capture all five boards as one image (the full-width track, so boards scrolled
// out of view are still included; drop the per-board clear buttons).
const boardCapture = {
  showPerspective: false,
  target: '.boards-track',
  filter: (node: HTMLElement) => !node.classList?.contains('board-clear'),
}
const handleCopyImage = () => copyToClipboard(boardCapture)
const handleDownload = () => downloadAsImage(boardCapture)

const handleCopyLink = async () => {
  try {
    const boards = grids.contexts.map((ctx) => ({
      tiles: ctx.grid.getAllTiles(),
      allyArtifact: ctx.artifacts.ally,
      enemyArtifact: ctx.artifacts.enemy,
    }))
    const url = generateMultiShareableUrl(boards, grids.activeId, {
      showHexIds: showHexIds.value,
      showArrows: showArrows.value,
      showPerspective: showPerspective.value,
      showSkills: showSkills.value,
      teamView: grids.teamView,
    })
    await navigator.clipboard.writeText(url)
    success(i18n.t('app.copied-clipboard'))
  } catch (err) {
    console.error('Failed to copy 5 v 5 link:', err)
    error(i18n.t('app.copy-link-failed'))
  }
}

// Image Stitcher is wide-window-only; if the viewport narrows while it's active,
// fall back to 5 v 5 (its tab is hidden, so it would otherwise be a stranded panel).
let mq: MediaQueryList | null = null
const enforceMobileTab = () => {
  if (mq?.matches && activeTab.value === 'imageStitcher') activeTab.value = 'fiveVFive'
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  enforceMobileTab()
  mq.addEventListener('change', enforceMobileTab)
})
onUnmounted(() => mq?.removeEventListener('change', enforceMobileTab))
</script>

<template>
  <main>
    <!-- DragDropProvider wraps both the boards (TabView panel) and the roster sibling
         so characters can be dragged between them. -->
    <DragDropProvider>
      <div class="teams-layout">
        <section class="section">
          <!-- eager: keep the boards panel mounted across tab switches (board state
               lives in the store, but this avoids remount churn + keeps the export
               target rendered). -->
          <TabView v-model="activeTab" :tabs="tabs" eager>
            <template #fiveVFive>
              <TeamsBoards
                v-model:show-arrows="showArrows"
                v-model:show-hex-ids="showHexIds"
                v-model:show-perspective="showPerspective"
                v-model:show-skills="showSkills"
                :characters="gameDataStore.characters"
                :tap-mode="isSheet"
                @copy-link="handleCopyLink"
                @copy-image="handleCopyImage"
                @download="handleDownload"
              />
            </template>
            <template #imageStitcher>
              <h1 class="page-title">Image Stitcher</h1>
              <ImageStitcher />
            </template>
          </TabView>
        </section>

        <TeamsRoster
          v-show="activeTab === 'fiveVFive'"
          :characters="gameDataStore.characters"
          :artifacts="gameDataStore.artifacts"
          :phantimals="gameDataStore.phantimals"
        />
      </div>
    </DragDropProvider>
    <ToastContainer />
  </main>
</template>

<style scoped>
/* Single column: the boards card on top, the roster card/sheet below. */
.teams-layout {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

.page-title {
  margin: 0 0 var(--spacing-lg);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Clear the collapsed roster sheet's peek so page content isn't hidden behind it. */
@media (max-width: 768px) {
  main {
    padding-bottom: 64px;
  }
}
</style>
