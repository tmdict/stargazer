<script lang="ts">
import type { SlFamily } from '@/lib/pvp/sl/data/types'
import type { BoardDraw, BoardFormation } from '@/lib/pvp/sl/generator/formation'
import type { SlSetType } from '@/lib/pvp/sl/generator/setType'
import type { SwapPreview } from '@/lib/pvp/sl/generator/swapPreview'
import type { SlChoiceTeam } from '@/lib/pvp/sl/generator/types'

// A chosen team as the page shows it, read off the data file once, with its
// board's formations.
export interface SlShownTeam
  extends Pick<SlChoiceTeam, 'comp' | 'core' | 'flex' | 'pairs' | 'chance'>, BoardDraw {
  // The map's place in the set's type's list.
  map: number
  group: Pick<SlFamily, 'name' | 'core'> | null
  // A swap tried on the board in the engine's formation or as first drawn,
  // null when the worker cannot answer.
  trySwap: (out: number[], into: number[], engineOn: boolean) => Promise<SwapPreview | null>
}

export interface SlShown {
  // The type the set was chosen for.
  type: SlSetType
  chance: number
  // The chance of winning each number of maps, from none to all.
  odds: number[]
  // Under this many Celestial and Hypogean heroes last season's teams join;
  // null when the data file has none.
  beforeUnder: number | null
  teams: SlShownTeam[]
  // The set as one encoded team with each board in the formation given, as
  // the page draws it and Save as team stores it.
  encode: (formations: readonly Pick<BoardFormation, 'units'>[]) => string
}
</script>

<script setup lang="ts">
/* The chosen set: its chance to win the match with a tooltip and a line on
   what it is measured against, the explanation, Save as team, and one column
   per board. */

import { computed, ref } from 'vue'

import SlExplanation from './SlExplanation.vue'
import SlMapColumn from './SlMapColumn.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import IconHelpSmall from '@/components/ui/IconHelpSmall.vue'
import IconSavePlus from '@/components/ui/IconSavePlus.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { shownFormation } from '@/lib/pvp/sl/generator/formation'
import { slSetMode } from '@/lib/pvp/sl/generator/setType'
import { winsNeeded } from '@/lib/pvp/sl/model/odds'
import { teamPreviewBoards } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'
import { slMood, slPercent } from './useSlNames'

// data: the set encoded with each board as drawn.
const { shown, data, saveArmed } = defineProps<{
  shown: SlShown
  data: string
  saveArmed: boolean
}>()

const emit = defineEmits<{ save: [] }>()

const engineOn = defineModel<boolean[]>('engineOn', { required: true })

const i18n = useI18nStore()
const boards = computed(() => teamPreviewBoards(data) ?? [])
const why = computed(() =>
  shown.teams.map((team, index) => shownFormation(team, !!engineOn.value[index]).why),
)
const switchBoard = (index: number, on: boolean): void => {
  const next = shown.teams.map((_, i) => !!engineOn.value[i])
  next[index] = on
  engineOn.value = next
}
const explaining = ref(false)

const {
  anchor: tipAnchor,
  hoverOpen: tipOpen,
  hoverClose: tipClose,
  toggle: tipToggle,
  onTouchStart: tipTouchStart,
} = useInfoTip()
</script>

<template>
  <section class="sl-panel sl-band">
    <div class="sl-band-head">
      <span class="sl-chance">
        <span class="sl-chance-line">
          <button
            type="button"
            class="sl-help"
            @mouseenter="tipOpen"
            @mouseleave="tipClose"
            @focus="tipOpen"
            @blur="tipClose"
            @click="tipToggle"
            @touchstart.passive="tipTouchStart"
          >
            {{ i18n.t('app.sl-chance')
            }}<IconHelpSmall :size="14" class="sl-help-mark" aria-hidden="true" />
          </button>
          <span class="sl-chance-value">
            <b>{{ slPercent(shown.chance) }}</b>
            <span class="sl-mood" aria-hidden="true">{{ slMood(shown.chance) }}</span>
          </span>
        </span>
        <small class="sl-chance-note">{{ i18n.t('app.sl-chance-note') }}</small>
      </span>
      <span class="sl-actions">
        <button type="button" class="solid-btn sl-action outline" @click="explaining = true">
          <IconHelpSmall :size="14" />
          {{ i18n.t('app.sl-explain') }}
        </button>
        <button
          type="button"
          class="solid-btn sl-action"
          :class="{ 'confirm-armed': saveArmed }"
          :title="
            saveArmed ? i18n.t('app.sl-save-replaces', { mode: slSetMode(shown.type) }) : undefined
          "
          @click="emit('save')"
        >
          <IconSavePlus :size="14" />
          <ConfirmLabel :armed="saveArmed" :label="i18n.t('app.sl-save')" />
        </button>
      </span>
    </div>
    <div class="sl-maps">
      <SlMapColumn
        v-for="(team, index) in shown.teams"
        :key="index"
        :team
        :board="boards[index]"
        :why="why[index]"
        :engine-on="!!engineOn[index]"
        @switch="switchBoard(index, $event)"
      />
    </div>

    <SlExplanation :show="explaining" :shown @close="explaining = false" />
    <Teleport to="body">
      <TooltipPopup v-if="tipAnchor" :target-element="tipAnchor" variant="detailed">
        <template #content>
          {{
            i18n.t('app.sl-chance-tip', {
              needed: winsNeeded(shown.teams.length),
              boards: shown.teams.length,
            })
          }}
        </template>
      </TooltipPopup>
    </Teleport>
  </section>
</template>

<style scoped>
.sl-band {
  overflow: hidden;
  container-type: inline-size;
}

.sl-band-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 9px 18px;
  background: var(--color-bg-raised);
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 20px;
}

.sl-chance {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--color-text-secondary);
}

.sl-chance-line {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 10px;
}

.sl-chance-value {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.sl-chance-note {
  font-size: 13px;
  line-height: 1.4;
}

.sl-mood {
  font-size: 22px;
  line-height: 1;
}

.sl-chance b {
  color: var(--color-text-primary);
  font-size: 24px;
}

.sl-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sl-maps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
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
    row-gap: 24px;
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
