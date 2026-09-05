<script setup lang="ts">
/* Per-board edit dock for hero upgrade attrs: per-team clear and bulk actions
   flank a centered layer selector. Every board mounts its own dock (actions
   stay adjacent to the heroes they change), while the P/R selection is one
   page-global set (useAttrLayerSelection) shared by all docks and panels. */

import { computed } from 'vue'

import IconChevronsUp from '@/components/ui/IconChevronsUp.vue'
import IconReset from '@/components/ui/IconReset.vue'
import IconTrashSmall from '@/components/ui/IconTrashSmall.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import type { GridContext } from '@/composables/useGridContext'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useSelectionState } from '@/composables/useSelectionState'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { getTilesWithCharactersByTeam, isRealHeroId } from '@/lib/characters/character'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  context: GridContext
  showParagon: boolean
  showRefinement?: boolean
}>()

const i18n = useI18nStore()
const { toggle, effectiveLayers } = useAttrLayerSelection()

const layerChips = computed(() => [
  ...(props.showParagon ? [{ attrId: ATTR_PARAGON, label: 'P', name: 'app.paragon' }] : []),
  ...(props.showRefinement
    ? [{ attrId: ATTR_REFINEMENT, label: 'R', name: 'app.refinement' }]
    : []),
])

// Bulk actions and the lit chips both follow the effective set, so what the
// dock shows armed is exactly what it will edit.
const visibleAttrIds = computed(() => layerChips.value.map((chip) => chip.attrId))
const editLayers = computed(() => effectiveLayers(visibleAttrIds.value))
const chipLit = (attrId: number): boolean => editLayers.value.includes(attrId)
const toggleChip = (attrId: number): void => toggle(attrId, visibleAttrIds.value)

const realHeroIds = (team: Team): number[] =>
  getTilesWithCharactersByTeam(props.context.grid, team)
    .filter((tile) => tile.characterId !== undefined && isRealHeroId(tile.characterId))
    .map((tile) => tile.characterId!)

// The enemy half hides under team view: destructive and bulk controls must not
// target units the crop has hidden.
const sides = computed(() => {
  const all = [
    { team: Team.ALLY, klass: 'ally', label: i18n.t('app.ally'), heroIds: realHeroIds(Team.ALLY) },
    {
      team: Team.ENEMY,
      klass: 'enemy',
      label: i18n.t('app.enemy'),
      heroIds: realHeroIds(Team.ENEMY),
    },
  ]
  return props.context.teamView ? all.filter((side) => side.team === Team.ALLY) : all
})

const canRaise = (heroIds: number[], team: Team): boolean =>
  heroIds.some((id) =>
    editLayers.value.some((attrId) => props.context.getAttr(team, id, attrId) < attrMax(attrId)),
  )

const canReset = (heroIds: number[], team: Team): boolean =>
  heroIds.some((id) =>
    editLayers.value.some((attrId) => props.context.getAttr(team, id, attrId) > 0),
  )

const resetAll = (team: Team, heroIds: number[]): void => {
  hideActionTip()
  for (const id of heroIds) {
    for (const attrId of editLayers.value) props.context.setAttr(team, id, attrId, 0)
  }
}

const maxAll = (team: Team, heroIds: number[]): void => {
  hideActionTip()
  for (const id of heroIds) {
    for (const attrId of editLayers.value) props.context.setAttr(team, id, attrId, attrMax(attrId))
  }
}

// Clamped, unlike the per-hero cycle: a batch wrap would zero a maxed team.
const raiseAll = (team: Team, heroIds: number[]): void => {
  hideActionTip()
  for (const id of heroIds) {
    for (const attrId of editLayers.value) {
      props.context.setAttr(team, id, attrId, props.context.getAttr(team, id, attrId) + 1)
    }
  }
}

// Per-team wipe, two-step armed like every destructive control. Bulk removal
// may delete the unit a pending tap/lift gesture references, so the gesture
// state drops with it.
const { armed, confirm } = useArmedConfirm()
const { clearTargetHex, clearLiftedHex } = useSelectionState()
const clearTeam = (team: Team): void => {
  if (!confirm(String(team))) return
  hideActionTip()
  props.context.clearTeam(team)
  clearTargetHex()
  clearLiftedHex()
}

// Bulk-action tooltips: the handlers close the popup themselves, because a
// click can disable the hovered button, and it then never fires the closing
// mouseleave.
const {
  anchor: actionTipEl,
  payload: actionTipKey,
  onMouseEnter: showActionTip,
  onMouseLeave: hideActionTip,
  onTouchStart: onActionTouchStart,
} = useHoverTooltip<string>()

const actionTipText = computed((): string => (actionTipKey.value ? i18n.t(actionTipKey.value) : ''))
</script>

<template>
  <div class="tp-dock capture-exclude">
    <div
      v-for="side in sides"
      :key="side.klass"
      class="dock-cluster"
      :class="[side.klass, { lone: sides.length === 1 }]"
    >
      <button
        type="button"
        class="dock-chip dock-clear"
        :class="{ armed: armed === String(side.team) }"
        :disabled="side.heroIds.length === 0"
        :aria-label="i18n.t('app.clear-team')"
        @click="clearTeam(side.team)"
        @mouseenter="showActionTip($event, 'app.clear-team')"
        @touchstart.passive="onActionTouchStart"
        @mouseleave="hideActionTip"
      >
        <IconTrashSmall :size="12" />
      </button>
      <span class="dock-divider" />
      <span class="dock-side-label">{{ side.label }}</span>
      <template v-if="editLayers.length > 0">
        <button
          type="button"
          class="dock-chip"
          :disabled="!canReset(side.heroIds, side.team)"
          :aria-label="i18n.t('app.reset-upgrades')"
          @click="resetAll(side.team, side.heroIds)"
          @mouseenter="showActionTip($event, 'app.reset-upgrades')"
          @touchstart.passive="onActionTouchStart"
          @mouseleave="hideActionTip"
        >
          <IconReset :size="11" />
        </button>
        <button
          type="button"
          class="dock-chip"
          :disabled="!canRaise(side.heroIds, side.team)"
          :aria-label="i18n.t('app.max-upgrades')"
          @click="maxAll(side.team, side.heroIds)"
          @mouseenter="showActionTip($event, 'app.max-upgrades')"
          @touchstart.passive="onActionTouchStart"
          @mouseleave="hideActionTip"
        >
          <IconChevronsUp :size="11" />
        </button>
        <button
          type="button"
          class="dock-chip dock-plus"
          :disabled="!canRaise(side.heroIds, side.team)"
          :aria-label="i18n.t('app.raise-upgrades')"
          @click="raiseAll(side.team, side.heroIds)"
          @mouseenter="showActionTip($event, 'app.raise-upgrades')"
          @touchstart.passive="onActionTouchStart"
          @mouseleave="hideActionTip"
        >
          +1
        </button>
      </template>
    </div>

    <span v-if="layerChips.length > 0" class="dock-selector">
      <button
        v-for="chip in layerChips"
        :key="chip.attrId"
        type="button"
        class="layer-chip"
        :class="{ lit: chipLit(chip.attrId) }"
        :aria-pressed="chipLit(chip.attrId)"
        :aria-label="i18n.t(chip.name)"
        :title="i18n.t(chip.name)"
        @click="toggleChip(chip.attrId)"
      >
        {{ chip.label }}
      </button>
    </span>

    <Teleport to="body">
      <TooltipPopup
        v-if="actionTipKey && actionTipEl"
        :target-element="actionTipEl"
        variant="detailed"
      >
        <template #content>{{ actionTipText }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
/* A floating white card ("pop"): visually detached from the flat panel strip
   above it. Relative so the selector can center on the bar's true midline
   regardless of how the flanking clusters differ in width. */
.tp-dock {
  container-type: inline-size;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-large);
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.09);
}

.dock-cluster {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}
/* Mirror the enemy side: trash at the outer edge, +1 innermost, matching the
   ally order read outward-in. */
.dock-cluster.enemy {
  flex-direction: row-reverse;
}
/* Team view leaves one cluster; keep the centered selector clear of it. */
.dock-cluster.lone {
  margin-right: auto;
}

.dock-side-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin: 0 2px;
}

.dock-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.dock-plus {
  font-size: 0.62rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.dock-chip:hover:not(:disabled):not(.dock-clear) {
  background: rgba(0, 0, 0, 0.11);
  color: var(--color-text-primary);
}
.dock-chip:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Sets the destructive clear apart from the repeatable bulk cluster. */
.dock-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border-primary);
}
.dock-clear {
  width: 18px;
  height: 18px;
  color: var(--color-danger);
}
.dock-clear:hover:not(:disabled),
.dock-clear.armed {
  background: var(--color-danger);
  color: #fff;
}
/* Armed step of the two-step confirm: ring plus the shared confirm-ping pulse
   (controls.css), so the state reads even at chip size. */
.dock-clear.armed {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 40%, transparent);
  animation: confirm-ping 0.9s ease-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .dock-clear.armed {
    animation: none;
  }
}

/* Centered on the bar's midline; the flanking clusters flow around it. The
   armed chip's fill (plus the badge rings above) is the whole armed signal —
   the bulk chips stay neutral regardless of layer. */
.dock-selector {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  gap: 6px;
}
.layer-chip {
  border: 1.5px solid var(--color-border-primary);
  background: var(--color-bg-white);
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 800;
  padding: 2px 13px;
  min-height: 22px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.layer-chip.lit {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

/* Narrow boards (the 5 v 5 columns): the labels go first, then gaps tighten,
   so the ~12 controls never wrap the bar. */
@container (max-width: 479px) {
  .dock-side-label {
    display: none;
  }
}
@container (max-width: 359px) {
  .tp-dock {
    padding: var(--spacing-sm) var(--spacing-sm);
  }
  .dock-cluster {
    gap: var(--spacing-xs);
  }
  .dock-divider {
    display: none;
  }
}
</style>
