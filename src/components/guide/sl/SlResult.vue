<script lang="ts">
import type { SlFamily } from '@/lib/pvp/data/types'
import type { BoardDraw, BoardFormation } from '@/lib/pvp/generator/formation'
import type { SwapPreview } from '@/lib/pvp/generator/swapPreview'
import type { SlChoiceTeam } from '@/lib/pvp/generator/types'
import type { TeamModeKey, VariantMatch } from '@/lib/teams/modes'

// A chosen team as the page shows it, read off the data file once, with its
// board's formations.
export interface SlShownTeam
  extends Pick<SlChoiceTeam, 'comp' | 'core' | 'flex' | 'pairs' | 'chance'>, BoardDraw {
  // The map's place in the set's type's list.
  map: number
  group: Pick<SlFamily, 'name' | 'core'> | null
  // The lineups the visit found the board's map does not take, for the debug
  // view.
  refused: number[][]
  // A swap tried on the board in the engine's formation or the recorded one,
  // null when the worker cannot answer.
  trySwap: (out: number[], into: number[], engineOn: boolean) => Promise<SwapPreview | null>
}

export interface SlShown {
  // The mode and maps the set was chosen for, null maps for the boards of the
  // Arena or Teams page.
  mode: TeamModeKey
  variant: VariantMatch
  chance: number
  // The chance of winning each number of maps, from none to all.
  odds: number[]
  teams: SlShownTeam[]
  // The set as one encoded team with each board in the formation given, as
  // the page draws it and Open in Teams opens it.
  encode: (formations: readonly Pick<BoardFormation, 'units'>[]) => string
}
</script>

<script setup lang="ts">
/* The chosen set: the explanation, Open in Teams and one column per board. */

import { computed, ref } from 'vue'

import SlExplanation from './SlExplanation.vue'
import SlMapColumn from './SlMapColumn.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import IconArrowUpRight from '@/components/ui/IconArrowUpRight.vue'
import IconHelpSmall from '@/components/ui/IconHelpSmall.vue'
import { shownFormation } from '@/lib/pvp/generator/formation'
import { teamPreviewBoards } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'

// data: the set encoded with each board as drawn. debug: every board with two
// formations gets the switch between them.
const { shown, data, openArmed, debug } = defineProps<{
  shown: SlShown
  data: string
  openArmed: boolean
  debug: boolean
}>()

const emit = defineEmits<{ open: [] }>()

// A board switched by hand, by index; one left alone shows the comparison's.
const engineOn = defineModel<(boolean | undefined)[]>('engineOn', { required: true })

const i18n = useI18nStore()
const boards = computed(() => teamPreviewBoards(data) ?? [])
const onEngine = computed(() =>
  shown.teams.map((team, index) => engineOn.value[index] ?? !team.showsPlayed),
)
const why = computed(() =>
  shown.teams.map((team, index) => shownFormation(team, onEngine.value[index]).why),
)
const switchBoard = (index: number, on: boolean): void => {
  const next = shown.teams.map((_, i) => engineOn.value[i])
  next[index] = on
  engineOn.value = next
}
const explaining = ref(false)
const oneBoard = computed(() => shown.teams.length === 1)
</script>

<template>
  <section class="sl-panel sl-band">
    <div class="sl-band-head">
      <span class="sl-actions">
        <button type="button" class="solid-btn sl-action outline" @click="explaining = true">
          <IconHelpSmall :size="14" />
          {{ i18n.t('app.sl-explain') }}
        </button>
        <button
          type="button"
          class="solid-btn sl-action"
          :class="{ 'confirm-armed': openArmed }"
          :title="openArmed ? i18n.t('app.sl-open-replaces', { mode: shown.mode }) : undefined"
          @click="emit('open')"
        >
          <IconArrowUpRight :size="14" />
          <ConfirmLabel :armed="openArmed" :label="i18n.t('app.sl-open-in')" />
        </button>
      </span>
      <p class="sl-line sl-data-limit">{{ i18n.t('app.sl-data-limit') }}</p>
    </div>
    <div class="sl-maps-box" :class="{ one: oneBoard }">
      <div class="sl-maps">
        <SlMapColumn
          v-for="(team, index) in shown.teams"
          :key="index"
          :team
          :board="boards[index]"
          :why="why[index]"
          :engine-on="onEngine[index]"
          :debug
          @switch="switchBoard(index, $event)"
        />
      </div>
    </div>

    <SlExplanation :show="explaining" :shown @close="explaining = false" />
  </section>
</template>

<style scoped>
.sl-band {
  overflow: hidden;
}

.sl-maps-box {
  container-type: inline-size;
}

.sl-maps-box.one {
  max-width: 710px;
  margin-inline: auto;
}

.sl-band-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 9px 18px;
  background: var(--color-bg-raised);
  border-bottom: 1px solid var(--color-border-primary);
}

.sl-band-head .sl-data-limit {
  margin-left: auto;
  text-align: right;
}

.sl-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sl-maps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 24px;
  padding: 24px 16px;
}

@container (min-width: 1171px) {
  .sl-maps > :first-child:nth-last-child(3) {
    grid-column-start: 2;
  }
}

@container (max-width: 1360px) {
  .sl-maps {
    --pt: 34px;
    --pt-gap: 8px;
  }
}

/* Six half columns, so a last row of two sits centred. */
@container (max-width: 1170px) {
  .sl-maps {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .sl-maps > * {
    grid-column: span 2;
  }
  .sl-maps > :nth-child(3n + 1):nth-last-child(2) {
    grid-column: 2 / span 2;
  }
}

@container (max-width: 710px) {
  .sl-maps {
    --pt: 40px;
    --pt-gap: 15px;
    --sl-aside-offset: 0;
    grid-template-columns: minmax(0, 420px);
    justify-content: center;
    row-gap: 32px;
  }
  .sl-maps > *,
  .sl-maps > :nth-child(3n + 1):nth-last-child(2) {
    grid-column: auto;
  }
}

@container (max-width: 600px) {
  .sl-maps {
    padding: 18px 10px;
  }
}

@media (max-width: 768px) {
  .sl-panel.sl-band {
    border-color: transparent;
  }
}
</style>
