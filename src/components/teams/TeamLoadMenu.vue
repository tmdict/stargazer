<script setup lang="ts">
/* The Load menu in the controls' action row: a dropdown of saved teams whose
   units all sit on one side (ally-only or enemy-only, across every board of
   the record), stamped onto the live boards without touching the other side.
   Two groups: the active mode's teams load board-for-board, and 1v1 teams
   (offered in every other mode) load onto the active board. Invert loads onto
   the opposite side, mirrored 180 degrees. Loading clears the destination
   side first (delete semantics), so a load that would remove anything arms a
   two-step confirm; search matches team names and hero names exactly like the
   Saved Teams tab (shared composable). */

import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import TeamPreview from '@/components/teams/TeamPreview.vue'
import IconFolderOpen from '@/components/ui/IconFolderOpen.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useOverlay } from '@/composables/useOverlay'
import { useSavedTeamSearch } from '@/composables/useSavedTeamSearch'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { useTouchDetection } from '@/composables/useTouchDetection'
import { useUpdatedLabel } from '@/composables/useUpdatedLabel'
import { getOpposingTeam } from '@/lib/characters/character'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { teamHasSynergy } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { buildSideLoadPlan, savedTeamSide } from '@/lib/teams/sideLoad'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids, type SideLoadOptions } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'

const { activeMode } = defineProps<{ activeMode: TeamModeKey }>()

const gameData = useGameDataStore()
const grids = useGrids()
const i18n = useI18nStore()
const library = useTeamLibrary()
const { success } = useToast()
const { clearTargetHex, clearLiftedHex } = useSelectionState()
const { isTouchDevice } = useTouchDetection()
const updatedLabel = useUpdatedLabel()

// One wrapper contains trigger and panel (the ArenaDropdown pattern), so the
// toggle click can never race the overlay's outside-click close.
const rootRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const panelRef = ref<HTMLElement>()
const searchInput = ref<HTMLInputElement>()
const open = ref(false)

// The panel centers under the trigger; the shift nudges it back inside the
// viewport when the trigger sits close to an edge (small screens, wrapped rows).
const panelShift = ref(0)
const clampPanel = (): void => {
  const panel = panelRef.value
  const trigger = triggerRef.value
  if (!panel || !trigger) return
  const margin = 8
  const rect = trigger.getBoundingClientRect()
  const center = rect.left + rect.width / 2
  const half = panel.offsetWidth / 2
  if (center - half < margin) panelShift.value = margin - (center - half)
  else if (center + half > window.innerWidth - margin) {
    panelShift.value = window.innerWidth - margin - (center + half)
  } else panelShift.value = 0
}

const openMenu = async (): Promise<void> => {
  hideTip()
  open.value = true
  window.addEventListener('resize', clampPanel)
  await nextTick()
  clampPanel()
  // On touch, focusing would pop the keyboard over the panel.
  if (!isTouchDevice.value) searchInput.value?.focus()
}

const closeMenu = (): void => {
  if (!open.value) return
  open.value = false
  armed.value = null
  // A stale shift would flash for one frame on the next open if the trigger
  // moved while closed.
  panelShift.value = 0
  window.removeEventListener('resize', clampPanel)
}

onUnmounted(() => window.removeEventListener('resize', clampPanel))

useOverlay({ elementRef: rootRef, isOpen: open, onClose: closeMenu })

// Memoized in the lib on the immutable data string.
const sideOf = (team: SavedTeam): Team | null => savedTeamSide(team.data)

const byRecency = (a: SavedTeam, b: SavedTeam): number => b.updatedAt - a.updatedAt

const eligible = computed(() => library.teams.filter((team) => sideOf(team) !== null))
// Mode-matched teams first, then the 1v1 group; the search composable
// preserves input order, so the groups split back apart after filtering.
const searchable = computed(() => {
  const modeTeams = eligible.value.filter((team) => team.mode === activeMode).sort(byRecency)
  const duelTeams =
    activeMode === '1v1' ? [] : eligible.value.filter((team) => team.mode === '1v1').sort(byRecency)
  return [...modeTeams, ...duelTeams]
})

const { query, matchedHeroes, results } = useSavedTeamSearch(() => searchable.value)

const groups = computed(() =>
  [
    {
      key: 'mode',
      label: null,
      items: results.value.filter(({ team }) => team.mode === activeMode),
    },
    {
      key: '1v1',
      label: activeMode === '1v1' ? null : i18n.t('app.load-team-1v1-group'),
      items: activeMode === '1v1' ? [] : results.value.filter(({ team }) => team.mode === '1v1'),
    },
  ].filter((group) => group.items.length > 0),
)

const invert = ref(false)

// A mode-matched record targets all boards; a 1v1 record in any other mode
// targets the active board only.
const scopeOf = (team: SavedTeam): SideLoadOptions['scope'] =>
  team.mode === activeMode ? 'all' : 'active'

const destOf = (team: SavedTeam): Team => {
  const side = sideOf(team) ?? Team.ALLY
  return invert.value ? getOpposingTeam(side) : side
}

const sideName = (team: Team): string => i18n.t(team === Team.ALLY ? 'app.ally' : 'app.enemy')

const modeChip = (team: SavedTeam): string => i18n.t(TEAM_MODES[team.mode].labelKey)

const { armed, confirm } = useArmedConfirm()

// Flipping the destination mid-confirm would repoint an armed click.
watch(invert, () => {
  armed.value = null
})

const confirmText = (team: SavedTeam): string =>
  i18n.t(destOf(team) === Team.ALLY ? 'app.confirm-replace-ally' : 'app.confirm-replace-enemy')

const handlePick = (team: SavedTeam): void => {
  // The load clears the destination side, so it confirms only when that side
  // holds something on the boards it will touch (the store's read-only mirror).
  if (grids.sideLoadWouldReplace(destOf(team), scopeOf(team)) && !confirm(team.id)) return
  const plan = buildSideLoadPlan(team.data, TEAM_MODES[activeMode].allowSynergy)
  if (!plan) return
  const { skipped } = grids.loadTeamSide(plan, { invert: invert.value, scope: scopeOf(team) })
  // Bulk removal may have deleted the unit a pending tap/lift gesture
  // references, so the gesture state drops with it.
  clearTargetHex()
  clearLiftedHex()
  closeMenu()
  success(skipped > 0 ? i18n.t('app.team-loaded-skipped', { skipped }) : i18n.t('app.team-loaded'))
}

const {
  anchor: tipAnchor,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<'load' | 'invert'>()

const tipText = computed((): string =>
  tip.value === 'load'
    ? i18n.t('app.tooltip-load-team')
    : tip.value === 'invert'
      ? i18n.t('app.tooltip-invert-load')
      : '',
)
</script>

<template>
  <!-- Hidden on degraded startup (game data failed): the boards are display-only
       placeholders with no persistence, so a load would silently evaporate; the
       saved tab's load path gates on the same flag. -->
  <span v-if="gameData.dataLoaded" ref="rootRef" class="team-load-menu">
    <button
      ref="triggerRef"
      type="button"
      class="control-btn secondary"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="i18n.t('app.load')"
      @click="open ? closeMenu() : openMenu()"
      @mouseenter="showTip($event, 'load')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconFolderOpen :size="14" class="btn-icon" />
      <span class="btn-text">{{ i18n.t('app.load') }}</span>
    </button>

    <div
      v-if="open"
      ref="panelRef"
      class="load-panel"
      role="dialog"
      :aria-label="i18n.t('app.load')"
      :style="{ '--panel-shift': `${panelShift}px` }"
    >
      <div class="panel-head">
        <input
          ref="searchInput"
          v-model="query"
          class="panel-search"
          type="search"
          :placeholder="i18n.t('app.search-teams')"
          :aria-label="i18n.t('app.search-teams')"
          spellcheck="false"
        />
        <label
          class="invert-pill"
          :class="{ active: invert }"
          @mouseenter="showTip($event, 'invert')"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <input v-model="invert" type="checkbox" class="invert-checkbox" />
          {{ i18n.t('app.invert') }}
        </label>
      </div>

      <div class="panel-hint" :class="{ inverted: invert }">
        {{ i18n.t(invert ? 'app.load-team-hint-invert' : 'app.load-team-hint') }}
      </div>

      <div class="panel-body">
        <p v-if="searchable.length === 0" class="panel-empty">
          {{ i18n.t('app.load-team-empty') }}
        </p>
        <p v-else-if="groups.length === 0" class="panel-empty">
          {{ i18n.t('app.teams-no-matches') }}
        </p>
        <template v-else>
          <template v-for="group in groups" :key="group.key">
            <div v-if="group.label" class="panel-group">{{ group.label }}</div>
            <div class="team-cards">
              <button
                v-for="{ team, name } in group.items"
                :key="team.id"
                type="button"
                class="load-card"
                :class="{ armed: armed === team.id }"
                :title="i18n.t('app.load')"
                @click="handlePick(team)"
              >
                <span class="card-thumb">
                  <TeamPreview :team :highlight-heroes="matchedHeroes" />
                  <span v-if="armed === team.id" class="card-confirm">{{ confirmText(team) }}</span>
                </span>
                <span class="card-name">
                  {{ name.pre }}<mark v-if="name.match">{{ name.match }}</mark
                  >{{ name.post }}
                </span>
                <span class="card-meta">
                  <span class="side-badge" :class="destOf(team) === Team.ALLY ? 'ally' : 'enemy'">
                    <template v-if="invert">
                      {{ sideName(sideOf(team) ?? Team.ALLY) }}
                      <span class="badge-arrow">&rarr;</span>
                      {{ sideName(destOf(team)) }}
                    </template>
                    <template v-else>{{ sideName(destOf(team)) }}</template>
                  </span>
                  <span class="card-mode">{{ modeChip(team) }}</span>
                  <span v-if="teamHasSynergy(team.data)" class="card-mode">
                    {{ i18n.t('app.synergy') }}
                  </span>
                  <span class="card-when">{{ updatedLabel(team.updatedAt) }}</span>
                </span>
              </button>
            </div>
          </template>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <TooltipPopup v-if="tip && tipAnchor" :target-element="tipAnchor" variant="detailed">
        <template #content>{{ tipText }}</template>
      </TooltipPopup>
    </Teleport>
  </span>
</template>

<style scoped>
.team-load-menu {
  position: relative;
  display: inline-flex;
}

.load-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(calc(-50% + var(--panel-shift, 0px)));
  z-index: var(--z-dropdown);
  width: min(640px, calc(100vw - 16px));
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm);
}

.panel-search {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 0.85rem;
  padding: 5px 12px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-primary);
}

.panel-search:focus {
  outline: none;
  border-color: var(--color-primary);
}

.invert-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 4px 12px;
  background: var(--color-bg-white);
  transition: all var(--transition-fast);
}

.invert-pill:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.invert-pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.invert-checkbox {
  width: 0.85rem;
  height: 0.85rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

.panel-hint {
  padding: 0 var(--spacing-md) var(--spacing-sm);
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-primary);
}

.panel-hint.inverted {
  color: var(--color-primary);
  font-weight: 600;
}

.panel-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  max-height: min(56vh, 480px);
}

.panel-empty {
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  margin: var(--spacing-md);
}

.panel-group {
  padding: 4px var(--spacing-md);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.team-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

@media (max-width: 640px) {
  .team-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.load-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  text-align: left;
  font: inherit;
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-sm);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
  /* Offscreen cards skip layout/paint inside the scrolling body. */
  content-visibility: auto;
  contain-intrinsic-size: auto 200px;
}

.load-card:hover {
  border-color: var(--color-primary);
}

.load-card.armed {
  border-color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-secondary));
}

.card-name {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-name mark {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  padding: 1px 3px;
  border-radius: 4px;
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px var(--spacing-sm);
}

.side-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1.5px solid;
  border-radius: 999px;
  padding: 0 7px;
  white-space: nowrap;
}

.side-badge.ally {
  color: var(--color-ally);
  border-color: var(--color-ally);
}

.side-badge.enemy {
  color: var(--color-enemy);
  border-color: var(--color-enemy);
}

.badge-arrow {
  font-weight: 400;
  opacity: 0.7;
}

/* Deliberately quieter than SavedTeamsList's primary-colored mode chip: the
   side badge is the loud element on these cards. */
.card-mode {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 0 6px;
  white-space: nowrap;
}

.card-when {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.card-thumb {
  position: relative;
  display: block;
}

/* The armed confirm overlays the thumbnail rather than occupying a footer:
   no layout shift, so the grid can't move between the arming click and the
   confirming one. The second click anywhere on the card loads. */
.card-confirm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-sm);
  /* Matches the thumbnail's own rounding. */
  border-radius: var(--radius-medium);
  background: color-mix(in srgb, var(--color-danger) 85%, transparent);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
}
</style>
