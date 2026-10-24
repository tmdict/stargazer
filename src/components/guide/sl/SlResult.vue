<script lang="ts">
import type { SlFamily } from '@/lib/pvp/sl/types'

// A chosen team as the page shows it, read off the data file once.
export interface SlShownTeam {
  // Index into the data file's maps.
  map: number
  group: Pick<SlFamily, 'name' | 'core'> | null
  // The comp's [players, wins, losses] on this map.
  comp: [number, number, number] | null
  core: number[]
  flex: { out: number; options: number[] }[]
  chance: number
}

export interface SlShown {
  chance: number
  // The chance of winning each number of maps, 0 to 5.
  odds: number[]
  // The notional games each chance starts with.
  prior: number
  // Under this many Celestial and Hypogean heroes last season's teams join;
  // null when the data file has none.
  beforeUnder: number | null
  teams: SlShownTeam[]
  // The set as one encoded 5v5 team: the boards drawn here, and what Save as
  // team stores.
  data: string
}
</script>

<script setup lang="ts">
/* The chosen set: its chance to win the match with a tooltip, the
   explanation, Save as team, and one column per map. */

import { computed, ref } from 'vue'

import SlExplanation from './SlExplanation.vue'
import SlMapColumn from './SlMapColumn.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { teamPreviewBoards } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'
import { slPercent } from './useSlNames'

const { shown } = defineProps<{ shown: SlShown }>()

const emit = defineEmits<{ save: [] }>()

const i18n = useI18nStore()
const boards = computed(() => teamPreviewBoards(shown.data) ?? [])
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
  <section class="sl-band">
    <div class="sl-band-head">
      <span class="sl-chance">
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
          {{ i18n.t('app.sl-chance') }}<span aria-hidden="true" />
        </button>
        <b>{{ slPercent(shown.chance) }}</b>
      </span>
      <span class="sl-actions">
        <button type="button" class="sl-btn" @click="explaining = true">
          {{ i18n.t('app.sl-explain') }}
        </button>
        <button type="button" class="sl-btn" @click="emit('save')">
          {{ i18n.t('app.sl-save') }}
        </button>
      </span>
    </div>
    <div class="sl-maps">
      <SlMapColumn v-for="(team, index) in shown.teams" :key="index" :team :board="boards[index]" />
    </div>

    <SlExplanation :show="explaining" :shown @close="explaining = false" />
    <Teleport to="body">
      <TooltipPopup
        v-if="tipAnchor"
        :target-element="tipAnchor"
        variant="detailed"
        max-width="290px"
      >
        <template #content>{{ i18n.t('app.sl-chance-tip') }}</template>
      </TooltipPopup>
    </Teleport>
  </section>
</template>

<style scoped>
.sl-band {
  border: 1px solid var(--sl-line2);
  border-radius: 14px;
  background: var(--sl-panel);
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
  background: var(--sl-panel2);
  border-bottom: 1px solid var(--sl-line2);
  font-size: 20px;
}

.sl-chance {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  color: var(--sl-dim);
}

.sl-chance b {
  color: var(--sl-fg);
  font-size: 24px;
}

/* The report's help mark: a question mark in a small ring after the label. */
.sl-help {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  white-space: nowrap;
  cursor: help;
}

.sl-help > span {
  position: relative;
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  border: 1px solid var(--sl-line2);
  border-radius: 50%;
  vertical-align: calc(0.5cap - 7px);
}

.sl-help > span::before {
  content: '?';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
}

.sl-help:focus-visible {
  outline: 2px solid var(--sl-accent);
  outline-offset: 3px;
  border-radius: 2px;
}

.sl-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sl-maps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  padding: 12px 16px 16px;
}

/* Three to a row on a tablet and two on a phone, with smaller portraits. */
@container (max-width: 1100px) {
  .sl-maps {
    --pt: 34px;
    --pt-gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 24px;
  }
}

@container (max-width: 600px) {
  .sl-maps {
    --pt: 26px;
    --pt-gap: 5px;
    --sl-aside-offset: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 10px;
    padding: 10px;
  }
}
</style>
