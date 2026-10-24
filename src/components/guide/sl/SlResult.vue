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
import IconHelp from '@/components/ui/IconHelp.vue'
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
  <section class="sl-result">
    <div class="sl-result-head">
      <span class="sl-chance">
        <button
          type="button"
          class="sl-chance-label"
          @mouseenter="tipOpen"
          @mouseleave="tipClose"
          @focus="tipOpen"
          @blur="tipClose"
          @click="tipToggle"
          @touchstart.passive="tipTouchStart"
        >
          {{ i18n.t('app.sl-chance') }}
          <IconHelp :size="14" />
        </button>
        <b class="sl-chance-value">{{ slPercent(shown.chance) }}</b>
      </span>
      <span class="sl-actions">
        <button type="button" class="solid-btn secondary sl-action" @click="explaining = true">
          {{ i18n.t('app.sl-explain') }}
        </button>
        <button type="button" class="solid-btn sl-action" @click="emit('save')">
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
        max-width="280px"
      >
        <template #content>{{ i18n.t('app.sl-chance-tip') }}</template>
      </TooltipPopup>
    </Teleport>
  </section>
</template>

<style scoped>
.sl-result {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  container-type: inline-size;
}

.sl-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.sl-chance {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-md);
}

.sl-chance-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 1rem;
  color: var(--color-text-secondary);
  cursor: help;
}

.sl-chance-value {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.sl-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sl-action {
  padding: 4px 12px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.sl-action.secondary {
  background: var(--color-bg-primary);
  color: var(--color-primary);
}

.sl-action.secondary:hover {
  background: var(--color-bg-tertiary);
}

.sl-maps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--spacing-xl) var(--spacing-lg);
}

/* Two to a row on a phone, three on a tablet. */
@container (max-width: 900px) {
  .sl-maps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (max-width: 560px) {
  .sl-maps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--spacing-md);
  }
}
</style>
