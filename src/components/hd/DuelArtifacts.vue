<script setup lang="ts">
/* The Honor Duel board's artifact layer, on the two places the Arena's
   artifacts take: each side's artifact with one to three marks for its level,
   and by it the side's faction bonus. A place opens the artifact picker; the
   bonus only reports. */

import { computed, ref } from 'vue'

import DuelArtifactPopup from './DuelArtifactPopup.vue'
import HonorDuelTooltip from './HonorDuelTooltip.vue'
import GridPointer from '@/components/grid/GridPointer.vue'
import HoldRing from '@/components/ui/HoldRing.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArtifactPlaces } from '@/composables/useArtifactPlaces'
import { useDuelText } from '@/composables/useDuelText'
import { useGridContext } from '@/composables/useGridContext'
import { useGridHoverTooltip } from '@/composables/useGridHoverTooltip'
import { useInfoTip } from '@/composables/useInfoTip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import type { DuelArtifactSlot } from '@/lib/hd/board'
import { duelArtifactById, duelItemImage, duelItemName } from '@/lib/hd/catalog'
import type { Point } from '@/lib/layout'
import type { HonorDuelItem } from '@/lib/types/honorDuel'
import { Team } from '@/lib/types/team'
import { duelFactionBonus } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { artifactSlot } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'

import '@/styles/grid-artifact.css'

const props = defineProps<{
  // Gates the artifact's hover card only.
  showHover: boolean
  readonly?: boolean
}>()

const ctx = useGridContext()
const gameData = useGameDataStore()
const i18n = useI18nStore()
const text = useDuelText()
const places = useArtifactPlaces(ctx)

interface Held {
  slot: DuelArtifactSlot
  item: HonorDuelItem
  label: string
  image: string | undefined
}

// A slot whose id names no artifact shows as an empty place.
const heldOf = (team: Team): Held | null => {
  const slot = artifactSlot(ctx.duelArtifacts, team)
  const artifact = slot && duelArtifactById(slot.id)
  if (!slot || !artifact) return null
  const item: HonorDuelItem = { kind: 'artifact', item: artifact }
  return { slot, item, label: duelItemName(item, i18n.currentLocale), image: duelItemImage(item) }
}

const sides = computed(() =>
  [
    { team: Team.ALLY, place: places.ally, front: places.allyInFront.value, visible: true },
    {
      team: Team.ENEMY,
      place: places.enemy,
      front: places.enemyInFront.value,
      visible: places.enemyVisible.value,
    },
  ]
    .filter((side) => side.visible)
    .map(({ team, place, front }) => ({
      team,
      front,
      points: place.points.value,
      style: place.style.value,
      held: heldOf(team),
      bonus: duelFactionBonus(ctx, team),
    })),
)

const {
  hoveredEl,
  hovered,
  show,
  hide: hideCard,
} = useGridHoverTooltip<Held>(() => [ctx.duelArtifacts.ally, ctx.duelArtifacts.enemy])

const hoveredText = computed(() => {
  const item = hovered.value?.item
  return item && text.value?.artifacts[item.item.name]
})

// Inspect: long-press or right-click opens the artifact's details.
const { inspect } = useInspect()
const {
  pressing: holdingTeam,
  start: startHold,
  onContextMenu,
} = useLongPress<Team>((team) => {
  const held = heldOf(team)
  if (!held) return
  hideCard()
  void inspect({ kind: 'honorDuel', item: held.item })
})

const picking = ref<{ team: Team; position: Point } | null>(null)

const openPicker = (event: MouseEvent, team: Team): void => {
  if (props.readonly) return
  hideCard()
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  picking.value = { team, position: { x: rect.right + 6, y: rect.top - 20 } }
}

const bonusTip = useInfoTip<Team>()
const bonusShown = computed(() => sides.value.find((side) => side.team === bonusTip.payload.value))
const bonusRows = computed(() =>
  (bonusShown.value?.bonus.counts ?? []).map(({ faction, count }) => ({
    label: gameLabel(faction, i18n.currentLocale),
    value: count,
    icon: gameData.getIcon(`faction-${faction}`),
  })),
)
</script>

<template>
  <div class="grid-artifacts">
    <svg
      v-if="!readonly"
      class="artifact-cell-layer"
      :width="places.gridPixelSize.value"
      :height="places.gridPixelSize.value"
    >
      <polygon
        v-for="side in sides"
        :key="side.team"
        class="artifact-cell"
        :class="{ clickable: !side.held }"
        :points="side.points"
        @click="!side.held && openPicker($event, side.team)"
      />
    </svg>

    <div
      v-for="side in sides"
      :key="side.team"
      class="grid-artifact duel-place"
      :class="{ front: side.front }"
      :style="side.style"
    >
      <div
        v-if="side.held"
        class="duel-artifact inspectable"
        :class="{ readonly }"
        @click="openPicker($event, side.team)"
        @mouseenter="showHover && show($event, side.held)"
        @mouseleave="hideCard"
        @pointerdown="startHold($event, side.team)"
        @contextmenu="onContextMenu($event, side.team)"
      >
        <div class="artifact-circle">
          <img v-if="side.held.image" :src="side.held.image" :alt="side.held.label" />
        </div>
        <span class="level-marks">
          <i v-for="level in side.held.slot.level" :key="level" />
        </span>
        <HoldRing v-if="holdingTeam === side.team" />
      </div>
      <GridPointer v-if="ctx.perspective && side.held" />
      <button
        v-if="side.bonus.percent > 0"
        type="button"
        class="bonus"
        :class="side.front ? 'under' : 'over'"
        @mouseenter="bonusTip.hoverOpen($event, side.team)"
        @mouseleave="bonusTip.hoverClose"
        @focus="bonusTip.hoverOpen($event, side.team)"
        @blur="bonusTip.hoverClose"
        @click="bonusTip.toggle($event, side.team)"
      >
        +{{ side.bonus.percent }}%
      </button>
    </div>

    <HonorDuelTooltip
      v-if="hovered && hoveredEl"
      :item="hovered.item"
      :target-element="hoveredEl"
      :text="hoveredText"
      :level="hovered.slot.level"
    />

    <TooltipPopup
      v-if="bonusShown && bonusTip.anchor.value"
      :target-element="bonusTip.anchor.value"
    >
      <template #content>
        <TooltipCard
          :name="`${i18n.t('app.faction-bonus')} +${bonusShown.bonus.percent}%`"
          :rows="bonusRows"
        />
      </template>
    </TooltipPopup>

    <DuelArtifactPopup
      v-if="picking"
      :position="picking.position"
      :held="artifactSlot(ctx.duelArtifacts, picking.team)"
      @pick="ctx.setDuelArtifact(picking.team, $event)"
      @close="picking = null"
    />
  </div>
</template>

<style scoped>
.duel-place {
  pointer-events: none;
  cursor: default;
}

.duel-artifact {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: pointer;
}

.duel-artifact.readonly {
  cursor: default;
}

.artifact-circle img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.level-marks {
  position: absolute;
  left: 50%;
  bottom: calc(var(--artifact-border-width) * -1.5);
  display: flex;
  gap: calc(var(--artifact-border-width) * 0.75);
  transform: translateX(-50%);
  pointer-events: none;
}

.level-marks i {
  width: calc(var(--artifact-border-width) * 3.5);
  height: calc(var(--artifact-border-width) * 3.5);
  border: var(--artifact-border-width) solid var(--color-bg-raised);
  border-radius: 50%;
  background: var(--duel-level-mark);
  box-sizing: content-box;
}

.bonus {
  position: absolute;
  left: 50%;
  padding: 1px 7px;
  border: none;
  border-radius: 999px;
  background: var(--color-bg-raised);
  box-shadow: 0 0 0 1px var(--color-border-primary);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: auto;
  cursor: help;
}

.bonus.under {
  top: calc(100% + 8px);
}

.bonus.over {
  bottom: calc(100% + 8px);
}
</style>
