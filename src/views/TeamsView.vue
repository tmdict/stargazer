<script setup lang="ts">
/* The Teams page orchestrator (mirrors WandWarsView): owns the outer tab state and
   the boards. The active tab selects the board count (GRID_TABS), so a future grid
   mode (e.g. 3 v 3) drops in as one entry + a tab + a panel. A single watch on the
   active tab is the only writer of the count; onScopeDispose resets to the Arena's
   one board on leave (synchronously, so an HMR reload can't clobber it). Renders one
   TabView (grid modes / Image Stitcher) inside a card, plus the roster as a separate
   sibling card shown for any grid tab. */

import { computed, onMounted, onScopeDispose, onUnmounted, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TeamsBoards from '@/components/teams/TeamsBoards.vue'
import TeamsRoster from '@/components/teams/TeamsRoster.vue'
import TabView from '@/components/ui/TabView.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useDisplayFlags } from '@/composables/useDisplayFlags'
import { useGridExport } from '@/composables/useGridExport'
import { useTeamsPersistence } from '@/composables/useGridPersistence'
import { useGridSwap } from '@/composables/useGridSwap'
import { useSelectionState } from '@/composables/useSelectionState'
import { useShareLink } from '@/composables/useShareLink'
import { useToast } from '@/composables/useToast'
import { FIVE_V_FIVE_DEFAULT_MAPS } from '@/lib/maps'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'
import { serializeMultiGridState } from '@/utils/gridStateSerializer'
import { teamsBoardSize } from '@/utils/teamsBoardSize'
import { encodeMultiGridStateToUrl, getEncodedStateFromUrl } from '@/utils/urlStateManager'

const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const urlStateStore = useUrlStateStore()
const { copyToClipboard, downloadAsImage } = useGridExport()
const { success, error } = useToast()
const { clearTargetHex, clearLiftedHex } = useSelectionState()
const { cancel: cancelSwap } = useGridSwap()
const shareLink = useShareLink()

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
// 3-2 "wrap" boards layout vs one row; serialized with the other display flags.
const wrapBoards = ref(false)
const {
  showArrows,
  showGridInfo,
  showSkills,
  showPerspective,
  currentBreakpoint,
  toFlags,
  applyFlags,
} = useDisplayFlags({ wrap: wrapBoards })

// At sheet widths (<= tablet) the roster is a pull-up sheet and boards place via
// the cell-tap flow; on desktop the roster is a card and cells use the on-grid popup.
const isSheet = computed(() => currentBreakpoint.value !== 'desktop')

// Grid tabs pin their own size per breakpoint, not the breakpoint-driven Arena
// sizing; hexSizeMode tells useBreakpoint to leave the size alone.
const applySize = () => {
  grids.hexSize = teamsBoardSize(currentBreakpoint.value)
}

// Board count per grid tab; the active tab is the selector, so a future mode (e.g.
// 3 v 3) drops in as one entry. Non-grid tabs (Image Stitcher) aren't listed and
// leave the boards untouched.
const GRID_TABS: Record<string, { count: number; maps: string[] } | undefined> = {
  fiveVFive: { count: FIVE_V_FIVE_DEFAULT_MAPS.length, maps: FIVE_V_FIVE_DEFAULT_MAPS },
}
const isGridTab = computed(() => GRID_TABS[activeTab.value] !== undefined)

// The only writer of the board count. Rebuilds only when the active grid tab needs a
// different count (so toggling Image Stitcher and back preserves board state), then
// pins the medium sizing. A rebuild drops any stale tap-target/lift pointing at the
// replaced boards (boards share hex ids).
watch(
  activeTab,
  (tab) => {
    const cfg = GRID_TABS[tab]
    if (!cfg) return
    if (grids.contexts.length !== cfg.count) {
      grids.setGridCount(cfg.count, cfg.maps)
      clearTargetHex()
      clearLiftedHex()
    }
    grids.hexSizeMode = 'fixed-medium'
    applySize()
  },
  { immediate: true },
)
watch(currentBreakpoint, applySize)

const teamsPersistence = useTeamsPersistence(toFlags)

// A ?g= link overwrites the saved boards; otherwise restore them. Then mirror
// every later change to localStorage.
if (gameDataStore.dataLoaded) {
  const sharedLink = getEncodedStateFromUrl()
  const source = sharedLink ?? teamsPersistence.load()
  if (source) {
    const result = urlStateStore.restoreMultiFromEncodedState(source)
    if (result.success && result.displayFlags) {
      applyFlags(result.displayFlags)
      if (sharedLink) success(i18n.t('app.grid-loaded'))
    } else if (sharedLink && result.error && result.error !== 'No state provided') {
      error(i18n.t('app.invalid-url'))
    }
  }
  teamsPersistence.startAutosave()
}

// Reset to the Arena's single board on leave. onScopeDispose runs synchronously on
// unmount (before any re-mounted instance's setup), so an HMR reload can't leave the
// count clobbered the way a deferred onUnmounted would.
onScopeDispose(() => {
  grids.setGridCount(1)
  grids.hexSizeMode = 'breakpoint'
  clearTargetHex()
  clearLiftedHex()
  cancelSwap() // drop any in-flight swap + its document listeners on leave
})

// Capture all five boards as one image (the full-width track, so boards scrolled
// out of view are still included; drop the per-board action buttons).
const boardCapture = {
  showPerspective: false,
  target: '.boards-track',
  filter: (node: HTMLElement) => !node.classList?.contains('board-actions'),
  filePrefix: 'teams',
}
const handleCopyImage = () => copyToClipboard(boardCapture)
const handleDownload = () => downloadAsImage(boardCapture)

// Mirror the Arena: copy a read-only /share link for all five boards and open it.
const handleCopyLink = () => {
  const boards = grids.contexts.map((ctx) => ({
    tiles: ctx.grid.getAllTiles(),
    allyArtifact: ctx.artifacts.ally,
    enemyArtifact: ctx.artifacts.enemy,
    getParagon: ctx.getParagon,
  }))
  const encoded = encodeMultiGridStateToUrl(
    serializeMultiGridState(boards, grids.activeId, toFlags()),
  )
  return shareLink(encoded)
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
                v-model:show-grid-info="showGridInfo"
                v-model:show-perspective="showPerspective"
                v-model:show-skills="showSkills"
                v-model:wrap="wrapBoards"
                :characters="gameDataStore.characters"
                :tap-mode="isSheet"
                :can-wrap="!isSheet"
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
          v-show="isGridTab"
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
