<script setup lang="ts">
/* Generate on the Arena and Teams: fills the ally side of every board on the
   page with the set the PvP team generator draws for those boards and the
   active roster, and links to the generator page on the same boards. */

import { onScopeDispose, ref, toRaw } from 'vue'
import { RouterLink } from 'vue-router'

import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import IconArrowUpRight from '@/components/ui/IconArrowUpRight.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useFillSide } from '@/composables/useGeneratedSide'
import { useSlEngine } from '@/composables/useSlEngine'
import { useToast } from '@/composables/useToast'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import { tilesLayout, type MapLayout } from '@/lib/maps'
import type { GeneratorFrom } from '@/lib/pvp/sl/generator/handover'
import { State } from '@/lib/types/state'
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
const { success, error } = useToast()
const fillSide = useFillSide()
const { armed, confirm } = useArmedConfirm()
const { fill } = useSlEngine({ startOnMount: false })

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

const boardLayouts = (): MapLayout[] =>
  grids.contexts.map((ctx) =>
    tilesLayout(
      ctx.grid
        .getAllTiles()
        .flatMap((tile) => (tile.state === State.DEFAULT ? [] : [[tile.hex.getId(), tile.state]])),
    ),
  )

const layoutKeys = (layouts: readonly MapLayout[]): string =>
  layouts.map((layout) => layout.key).join(' ')

const generate = async (): Promise<void> => {
  if (busy.value) return
  if (grids.sideHasContent(Team.ALLY, 'all') && !confirm('generate')) return
  busy.value = true
  slowTimer = setTimeout(() => (slow.value = true), SLOW_MS)
  const layouts = boardLayouts()
  const roster = rosters.active
  const rosterName = roster?.name ?? i18n.t('app.all-heroes')
  try {
    const team = await fill(roster ? toRaw(roster.heroes) : null, layouts)
    // The set was drawn for the boards as they stood at the press, so it is
    // dropped if the page was left or a board changed map meanwhile.
    if (!live || layoutKeys(boardLayouts()) !== layoutKeys(layouts)) return
    if (team === null) {
      error(
        layouts.length === 1
          ? i18n.t('app.sl-no-team')
          : i18n.t('app.sl-no-set', { count: layouts.length }),
      )
      return
    }
    if (fillSide(team)) success(i18n.t('app.sl-filled', { roster: rosterName }))
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
      :title="i18n.t(armed !== null ? 'app.confirm' : 'app.sl-generate')"
      @click="generate"
    >
      <IconSparkle :size="14" class="btn-icon" aria-hidden="true" />
      <span class="btn-text">
        <ConfirmLabel
          :armed="armed !== null"
          :label="i18n.t(slow ? 'app.sl-generating' : 'app.sl-generate')"
        />
      </span>
    </button>
    <RouterLink
      :to="{ path: SL_GENERATOR_PATH, state: { generatorFrom: from } }"
      class="control-btn generate-open"
      :title="i18n.t('app.sl-open-generator')"
      :aria-label="i18n.t('app.sl-open-generator')"
    >
      <IconArrowUpRight :size="14" class="btn-icon" aria-hidden="true" />
    </RouterLink>
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
