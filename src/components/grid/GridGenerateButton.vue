<script setup lang="ts">
/* Generate on the Arena and Teams: fills the ally side of every board on the
   page with the set the PvP team generator draws for those boards and the
   active roster, ticks Placement tips in Grid Info, and links to the
   generator page on the same boards. */

import { computed, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import IconArrowUpRight from '@/components/ui/IconArrowUpRight.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useFillSide } from '@/composables/useGeneratedSide'
import { useGridInfoPrefs } from '@/composables/useGridInfoPrefs'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useSlEngine } from '@/composables/useSlEngine'
import { useToast } from '@/composables/useToast'
import { getCharacterTeam } from '@/lib/characters/character'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import { gridLayout, type MapLayout } from '@/lib/maps'
import type { GeneratorFrom } from '@/lib/pvp/generator/handover'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

const { from } = defineProps<{ from: GeneratorFrom }>()

const gameData = useGameDataStore()
const grids = useGrids()
const i18n = useI18nStore()
const rosters = useRosters()
const { show, success, error } = useToast()
const fillSide = useFillSide()
const { tickRules } = useGridInfoPrefs()
const { armed, confirm, disarm } = useArmedConfirm()
// An armed press confirms only on the boards it was armed for, so a switch of
// mode, map or boards disarms it.
watch(
  [() => from, () => grids.contexts.map((ctx) => `${ctx.id}:${ctx.currentMap}`).join(' ')],
  disarm,
)
const { fill } = useSlEngine({ startOnMount: false })

type TipId = 'generate' | 'open'
const {
  anchor: tipTarget,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<TipId>()

const tipText = computed((): string => {
  if (tip.value === 'open') return i18n.t('app.sl-open-generator-tip')
  return i18n.t(armed.value !== null ? 'app.confirm' : 'app.sl-generate-tip')
})

const busy = ref(false)
// The working look waits this long, so a quick press does not flash it.
const SLOW_MS = 300
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined
let live = true
onScopeDispose(() => {
  live = false
  clearTimeout(slowTimer)
})

const boardLayouts = (): MapLayout[] => grids.contexts.map((ctx) => gridLayout(ctx.grid))

// The maps and the ally side of every board, which a set is drawn for and
// replaces.
const boardsKey = (): string =>
  grids.contexts
    .map((ctx) => {
      const ally = [...ctx.placements]
        .filter(([hexId]) => getCharacterTeam(ctx.grid, hexId) === Team.ALLY)
        .sort(([a], [b]) => a - b)
      return `${gridLayout(ctx.grid).key}|${ctx.artifacts.ally}|${ally.join(';')}`
    })
    .join(' ')

const generate = async (): Promise<void> => {
  if (busy.value) return
  if (grids.sideHasContent(Team.ALLY, 'all') && !confirm('generate')) return
  busy.value = true
  slowTimer = setTimeout(() => (slow.value = true), SLOW_MS)
  const layouts = boardLayouts()
  const pressed = boardsKey()
  const roster = rosters.active
  const rosterName = roster?.name ?? i18n.t('app.all-heroes')
  try {
    // A worker takes plain data only, and a roster kept in memory when storage
    // fails holds its levels as reactive objects.
    const levels = roster
      ? Object.fromEntries(Object.entries(roster.heroes).map(([id, attrs]) => [id, { ...attrs }]))
      : null
    const team = await fill(levels, layouts)
    if (!live) return
    // The set was drawn for the boards as they stood at the press, so it never
    // replaces a side placed or loaded during the wait.
    if (boardsKey() !== pressed) {
      show(i18n.t('app.sl-boards-changed'), 'info')
      return
    }
    if (team === null) {
      error(
        layouts.length === 1
          ? i18n.t('app.sl-no-team')
          : i18n.t('app.sl-no-set', { count: layouts.length }),
      )
      return
    }
    if (fillSide(team)) {
      tickRules()
      success(i18n.t('app.sl-filled', { roster: rosterName }))
    }
  } catch {
    if (live) error(i18n.t('app.sl-load-failed'))
  } finally {
    clearTimeout(slowTimer)
    busy.value = false
    slow.value = false
  }
}
</script>

<template>
  <span v-if="gameData.dataLoaded" class="generate">
    <button
      type="button"
      class="control-btn generate-main"
      :class="{ 'confirm-armed': armed !== null, busy: slow }"
      :aria-busy="busy"
      :aria-label="i18n.t(armed !== null ? 'app.confirm' : 'app.sl-generate')"
      @click="generate"
      @mouseenter="showTip($event, 'generate')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconSparkle :size="20" class="btn-icon" aria-hidden="true" />
    </button>
    <RouterLink
      :to="{ path: SL_GENERATOR_PATH, state: { generatorFrom: from } }"
      class="control-btn generate-open"
      :aria-label="i18n.t('app.sl-open-generator')"
      @mouseenter="showTip($event, 'open')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    >
      <IconArrowUpRight :size="14" class="btn-icon" aria-hidden="true" />
    </RouterLink>
    <Teleport to="body">
      <TooltipPopup v-if="tip && tipTarget" :target-element="tipTarget" variant="detailed">
        <template #content>{{ tipText }}</template>
      </TooltipPopup>
    </Teleport>
  </span>
</template>

<style scoped>
.generate {
  display: inline-flex;
  flex-shrink: 0;
}

.generate .control-btn {
  background: var(--color-generate);
  border: 1px solid var(--color-generate-hover);
  color: var(--color-generate-text);
}

.generate .control-btn:hover,
.generate .confirm-armed {
  background: var(--color-generate-hover);
}

.generate-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.generate-main .btn-icon {
  color: var(--color-header-gold);
}

.generate-main.busy {
  opacity: 0.75;
  cursor: progress;
}

.generate-open {
  margin-left: 1px;
  padding-left: 7px;
  padding-right: 7px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left-color: color-mix(in srgb, var(--color-generate-text) 28%, transparent);
  text-decoration: none;
}
</style>
