<script setup lang="ts">
/* The Teams page orchestrator (mirrors WandWarsView): owns the outer tab state and
   the boards. The grid tab is mode-driven: a TEAM_MODES entry selects the board
   count + default maps, and useTeamsRestore is the only initiator of board-count
   changes (per-mode persistence slots, the pause/flush/rebuild/restore/resume
   switch sequence, and ?g= ingress routing all live there). onScopeDispose resets
   to the Arena's one board on leave (synchronously, so an HMR reload can't clobber
   it). Renders one TabView (Teams / Image Stitcher) inside a card, plus the roster
   as a separate sibling card shown for the grid tab. */

import { computed, onScopeDispose, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TeamsBoards from '@/components/teams/TeamsBoards.vue'
import TeamsRoster from '@/components/teams/TeamsRoster.vue'
import TabView from '@/components/ui/TabView.vue'
import { useDisplayFlags } from '@/composables/useDisplayFlags'
import { useGridExport } from '@/composables/useGridExport'
import { loadTeamsDisplayPrefs, saveTeamsDisplayPrefs } from '@/composables/useGridPersistence'
import { useGridSwap } from '@/composables/useGridSwap'
import { useSelectionState } from '@/composables/useSelectionState'
import { useShareLink } from '@/composables/useShareLink'
import { useTeamsRestore } from '@/composables/useTeamsRestore'
import { useToast } from '@/composables/useToast'
import { MAX_SAVED_TEAMS, TEAM_MODES } from '@/lib/teams/modes'
import { canonicalTeamData, nextAutoName, type SavedTeam } from '@/lib/teams/savedTeam'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { downloadBlob, timestampedName } from '@/utils/download'
import { teamsBoardSize } from '@/utils/teamsBoardSize'
import { getEncodedStateFromUrl } from '@/utils/urlStateManager'

const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const { copyToClipboard, downloadAsImage } = useGridExport()
const { success, error } = useToast()
const { clearTargetHex, clearLiftedHex } = useSelectionState()
const { cancel: cancelSwap } = useGridSwap()
const shareLink = useShareLink()

gameDataStore.initializeData()
i18n.initialize()

useHead({ title: 'Teams | Stargazer' })

const activeTab = ref('teams')
// Image Stitcher is a wide-window-only tool: its tab is hidden on mobile.
const tabs = computed(() => [
  { key: 'teams', label: i18n.t('app.teams') },
  { key: 'imageStitcher', label: i18n.t('app.image-stitcher'), hideMobile: true },
])
const isGridTab = computed(() => activeTab.value === 'teams')

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
  grids.hexSizeMode = 'fixed-medium'
  grids.hexSize = teamsBoardSize(currentBreakpoint.value)
}
watch(currentBreakpoint, applySize)

// Display globals on the grids store are page state; start clean so a first
// visit with no stored prefs doesn't inherit them from another page.
grids.teamView = false
grids.inverted = false

// Display toggles are device-level preferences shared by every team mode (board
// content stays per-mode; slot restores never touch them). Restore them before
// the boards so the restore renders under the user's toggles, then mirror every
// change. A ?g= link's flags apply during initialize and get committed as the
// new prefs by the same watcher (adopting the sharer's view is the point of a
// link).
const storedPrefs = loadTeamsDisplayPrefs()
if (storedPrefs) applyFlags(storedPrefs)
watch(toFlags, saveTeamsDisplayPrefs)

const teamLibrary = useTeamLibrary()
const teamsRestore = useTeamsRestore({
  getFlags: toFlags,
  applyFlags,
  applySize,
  // Stale provenance (deleted teams, restored backups) self-heals to null.
  resolveSourceId: (id) => (id !== null && teamLibrary.get(id) ? id : null),
})
const { activeMode } = teamsRestore

const canWrap = computed(() => !isSheet.value && TEAM_MODES[activeMode.value].canWrap)

// The Save button's target and the unsaved-changes indicator. Both sides of the
// dirty compare are canonical (viewer state stripped), so board clicks and
// display toggles never read as team edits.
const sourceTeam = computed(() => teamLibrary.get(teamsRestore.sourceId.value))
const canonicalActive = computed(() => canonicalTeamData(teamsRestore.snapshot()))
const dirty = computed(
  () => sourceTeam.value !== undefined && canonicalActive.value !== sourceTeam.value.data,
)
const suggestedName = computed(() => nextAutoName(teamLibrary.teams.map((team) => team.name)))

const handleSave = () => {
  const canonical = canonicalActive.value
  const source = sourceTeam.value
  if (!canonical || !source) return
  teamLibrary.update(source.id, canonical)
  success(i18n.t('app.team-saved', { name: source.name }))
}

const handleSaveAsNew = (name: string) => {
  const canonical = canonicalActive.value
  if (!canonical) return
  const team = teamLibrary.saveAsNew(activeMode.value, canonical, name)
  if (!team) {
    error(i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS }))
    return
  }
  teamsRestore.sourceId.value = team.id
  success(i18n.t('app.team-saved', { name: team.name }))
}

const handleRename = (name: string) => {
  const source = sourceTeam.value
  if (!source) return
  teamLibrary.rename(source.id, name)
}

const handleLoadTeam = (team: SavedTeam) => {
  if (!gameDataStore.dataLoaded) return
  teamsRestore.applyTeamData(team.mode, team.data, team.id)
  success(i18n.t('app.team-loaded'))
}

// Backup file of the whole library; import merges (never replaces); "replace
// all" is Delete all + Import.
const handleExportTeams = () => {
  downloadBlob(
    new Blob([JSON.stringify(teamLibrary.exportAll())], { type: 'application/json' }),
    timestampedName('stargazer-teams', 'json'),
  )
}

const handleImportFile = (raw: string) => {
  const result = teamLibrary.importTeams(raw)
  if (result.invalid) {
    error(i18n.t('app.import-invalid'))
    return
  }
  success(i18n.t('app.import-success', { imported: result.imported, skipped: result.skipped }))
}

// A ?g= link (mode-routed, shape-normalized) overwrites that mode's saved boards;
// otherwise the last-used mode and its boards are restored. Then every later
// change mirrors to the mode's slot. A link that fails to decode is treated as
// absent (falling back to the saved boards), so autosave can't wipe them.
if (gameDataStore.dataLoaded) {
  const { linkLoaded, linkFailed } = teamsRestore.initialize(getEncodedStateFromUrl())
  if (linkLoaded) success(i18n.t('app.grid-loaded'))
  else if (linkFailed) error(i18n.t('app.invalid-url'))
} else {
  // Data failed to load: show the default mode's empty boards, no persistence.
  teamsRestore.buildDefaults()
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

// Capture all boards as one image (the full-width track, so boards scrolled
// out of view are still included).
const boardCapture = {
  showPerspective: false,
  target: '.boards-track',
  filePrefix: 'teams',
}
const handleCopyImage = () => copyToClipboard(boardCapture)
const handleDownload = () => downloadAsImage(boardCapture)

// Mirror the Arena: copy a read-only /share link for all boards and open it.
// The persistence snapshot is exactly the shareable encoding (boards + active
// + flags + mode), so there is a single serialization path.
const handleCopyLink = () => shareLink(teamsRestore.snapshot())
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
            <template #teams>
              <TeamsBoards
                v-model:show-arrows="showArrows"
                v-model:show-grid-info="showGridInfo"
                v-model:show-perspective="showPerspective"
                v-model:show-skills="showSkills"
                v-model:wrap="wrapBoards"
                :characters="gameDataStore.characters"
                :active-mode="activeMode"
                :source-name="sourceTeam?.name ?? null"
                :dirty="dirty"
                :suggested-name="suggestedName"
                :tap-mode="isSheet"
                :can-wrap="canWrap"
                @switch-mode="teamsRestore.switchMode($event)"
                @new-team="teamsRestore.newTeam()"
                @save="handleSave"
                @save-as-new="handleSaveAsNew"
                @rename="handleRename"
                @export-teams="handleExportTeams"
                @import-file="handleImportFile"
                @copy-link="handleCopyLink"
                @copy-image="handleCopyImage"
                @download="handleDownload"
              />
            </template>
            <template #imageStitcher>
              <h1 class="page-title">{{ i18n.t('app.image-stitcher') }}</h1>
              <ImageStitcher />
            </template>
          </TabView>
        </section>

        <!-- TeamsRoster's root is BottomSheet, a multi-root (fragment) component that
             v-show can't bind to, so gate visibility with v-if. -->
        <TeamsRoster
          v-if="isGridTab"
          :characters="gameDataStore.characters"
          :artifacts="gameDataStore.artifacts"
          :phantimals="gameDataStore.phantimals"
          :loaded-team-id="sourceTeam?.id ?? null"
          @load-team="handleLoadTeam"
        />
      </div>
    </DragDropProvider>
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
