<script setup lang="ts">
/* Per-board edit dock for hero upgrade attrs: per-team clear and bulk actions
   flank a centered layer selector. Every board mounts its own dock (actions
   stay adjacent to the heroes they change), while the ALL / P / R choice is
   one page-global value (useAttrLayerSelection) shared by all docks and panels. */

import { computed } from 'vue'

import IconTrashSmall from '@/components/ui/IconTrashSmall.vue'
import UpgradeBulkActions from '@/components/ui/UpgradeBulkActions.vue'
import UpgradeDock from '@/components/ui/UpgradeDock.vue'
import UpgradeDockChip from '@/components/ui/UpgradeDockChip.vue'
import UpgradeDockDivider from '@/components/ui/UpgradeDockDivider.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import UpgradeLayerChips from '@/components/ui/UpgradeLayerChips.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import type { GridContext } from '@/composables/useGridContext'
import { useSelectionState } from '@/composables/useSelectionState'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { getTilesWithCharactersByTeam, isRealHeroId } from '@/lib/characters/character'
import { Team } from '@/lib/types/team'
import { artifactSlot } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  context: GridContext
  showUpgrades: boolean
}>()

const i18n = useI18nStore()
const { select, effectiveLayers, litChoice } = useAttrLayerSelection()

// Bulk actions and the lit chip both follow the effective set, so what the
// dock shows selected is exactly what it will edit.
const visibleAttrIds = computed(() => (props.showUpgrades ? [ATTR_PARAGON, ATTR_REFINEMENT] : []))
const editLayers = computed(() => effectiveLayers(visibleAttrIds.value))

// The bulk upgrade actions edit real heroes only, but the clear wipes the
// whole side: a side holding just placeholders, phantimals, or an artifact
// must still be clearable.
const sideState = (team: Team): { heroIds: number[]; hasContent: boolean } => {
  const tiles = getTilesWithCharactersByTeam(props.context.grid, team)
  return {
    heroIds: tiles
      .filter((tile) => tile.characterId !== undefined && isRealHeroId(tile.characterId))
      .map((tile) => tile.characterId!),
    hasContent: tiles.length > 0 || artifactSlot(props.context.artifacts, team) !== null,
  }
}

// The enemy half hides under team view: destructive and bulk controls must not
// target units the crop has hidden.
const sides = computed(() => {
  const all = [
    { team: Team.ALLY, klass: 'ally', label: i18n.t('app.ally'), ...sideState(Team.ALLY) },
    { team: Team.ENEMY, klass: 'enemy', label: i18n.t('app.enemy'), ...sideState(Team.ENEMY) },
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
  for (const id of heroIds) {
    for (const attrId of editLayers.value) props.context.setAttr(team, id, attrId, 0)
  }
}

const maxAll = (team: Team, heroIds: number[]): void => {
  for (const id of heroIds) {
    for (const attrId of editLayers.value) props.context.setAttr(team, id, attrId, attrMax(attrId))
  }
}

// Clamped, unlike the per-hero cycle: a batch wrap would zero a maxed team.
const raiseAll = (team: Team, heroIds: number[]): void => {
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
  props.context.clearTeam(team)
  clearTargetHex()
  clearLiftedHex()
}
</script>

<template>
  <UpgradeDock class="tp-dock capture-exclude">
    <div v-for="side in sides" :key="side.klass" class="dock-cluster" :class="side.klass">
      <UpgradeDockChip
        danger
        :armed="armed === String(side.team)"
        :disabled="!side.hasContent"
        :tip="i18n.t('app.clear-team')"
        @click="clearTeam(side.team)"
      >
        <IconTrashSmall :size="12" />
      </UpgradeDockChip>
      <UpgradeDockDivider />
      <UpgradeDockLabel>{{ side.label }}</UpgradeDockLabel>
      <UpgradeBulkActions
        v-if="editLayers.length > 0"
        :can-reset="canReset(side.heroIds, side.team)"
        :can-raise="canRaise(side.heroIds, side.team)"
        @reset="resetAll(side.team, side.heroIds)"
        @raise="raiseAll(side.team, side.heroIds)"
        @max="maxAll(side.team, side.heroIds)"
      />
    </div>

    <UpgradeLayerChips
      v-if="showUpgrades"
      class="dock-selector"
      :lit="litChoice(visibleAttrIds)"
      @select="select"
    />
  </UpgradeDock>
</template>

<style scoped>
/* Relative so the selector can center on the bar's true midline regardless
   of how the flanking clusters differ in width. With team view's single
   cluster, space-between keeps it at the start, clear of the selector. */
.tp-dock {
  container-type: inline-size;
  position: relative;
  justify-content: space-between;
  width: 100%;
}

.dock-cluster {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}
/* Mirror the enemy side: trash at the outer edge, max innermost, matching the
   ally order read outward-in. */
.dock-cluster.enemy {
  flex-direction: row-reverse;
}

/* Centered on the bar's midline; the flanking clusters flow around it. The
   lit chip's fill is the whole selection signal: the portrait pills stay
   plain labels and the bulk chips stay neutral regardless of layer. */
.dock-selector {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

/* Narrow boards (the 5 v 5 columns): the labels go first, then gaps tighten,
   so the ~12 controls never wrap the bar. */
@container (max-width: 479px) {
  .dock-label {
    display: none;
  }
}
@container (max-width: 359px) {
  .dock-cluster {
    gap: var(--spacing-xs);
  }
  .dock-divider {
    display: none;
  }
  /* Three chips must still clear the flanking clusters. */
  .tp-dock .dock-selector {
    gap: 4px;
  }
  .dock-selector :deep(.layer-chip) {
    padding: 2px 9px;
  }
}
</style>
