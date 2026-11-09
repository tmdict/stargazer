<script setup lang="ts">
/* How the set is picked, what its boards show, and its chance to win and how
   that is worked out, with the set's own numbers. */

import { computed } from 'vue'

import SlIcon from './SlIcon.vue'
import SlMeter, { METER_FROM } from './SlMeter.vue'
import type { SlShown } from './SlResult.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import { winsNeeded } from '@/lib/pvp/model/odds'
import { DEFAULT_VARIANT } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'
import { slPercent as percent, useSlNames } from './useSlNames'

const { shown } = defineProps<{ show: boolean; shown: SlShown }>()

const emit = defineEmits<{ close: [] }>()

const i18n = useI18nStore()
const { groupName } = useSlNames()

const boards = computed(() => shown.teams.length)
const oneBoard = computed(() => boards.value === 1)
const needed = computed(() => winsNeeded(boards.value))

const outcomes = computed(() =>
  Array.from({ length: boards.value - needed.value + 1 }, (_, i) => {
    const won = boards.value - i
    const key = i ? 'app.sl-explain-won-exact' : 'app.sl-explain-won-all'
    return { label: i18n.t(key, { count: won }), chance: shown.odds[won] ?? 0 }
  }),
)

type Piece = { text: string } | { icon: 'players' | 'games' }

// The text's {players} and {games} are the icons under each board.
const iconLine = computed(() =>
  i18n
    .t('app.sl-explain-boards')
    .split(/\{(players|games)\}/)
    .map((piece, i): Piece =>
      i % 2 ? { icon: piece === 'players' ? 'players' : 'games' } : { text: piece },
    ),
)

// Each bar count leads the games it stands for, in the site language's list.
const scale = computed(() => {
  const ranges = METER_FROM.map((from, i) => {
    const next = METER_FROM[i + 1]
    return next
      ? i18n.t('app.sl-meter-range', { from, to: next - 1 })
      : i18n.t('app.sl-meter-from', { from })
  })
  let bar = 0
  return new Intl.ListFormat(i18n.currentLocale, { type: 'conjunction' })
    .formatToParts(ranges)
    .map(({ type, value }) => ({ text: value, games: type === 'element' ? METER_FROM[bar++] : 0 }))
})
const meterLine = computed(() => i18n.t('app.sl-explain-meter').split('{scale}'))
</script>

<template>
  <BaseModal :show :label="i18n.t('app.sl-explain-title')" @close="emit('close')">
    <h1>{{ i18n.t('app.sl-explain-title') }}</h1>

    <h2>{{ i18n.t('app.sl-explain-search-head') }}</h2>
    <p>{{ i18n.t(oneBoard ? 'app.sl-explain-search-one' : 'app.sl-explain-search') }}</p>
    <p v-if="!oneBoard && shown.variant === DEFAULT_VARIANT">
      {{ i18n.t('app.sl-explain-set-mode', { mode: shown.mode, boards }) }}
    </p>
    <p>{{ i18n.t('app.sl-explain-artifact') }}</p>
    <p>{{ i18n.t('app.sl-explain-roster') }}</p>

    <h2>{{ i18n.t('app.sl-explain-boards-head') }}</h2>
    <p>
      <template v-for="(piece, index) in iconLine" :key="index">
        <SlIcon v-if="'icon' in piece" :name="piece.icon" class="inline-icon" />
        <template v-else>{{ piece.text }}</template>
      </template>
    </p>
    <p>
      {{ meterLine[0]
      }}<template v-for="(part, index) in scale" :key="index"
        ><SlMeter v-if="part.games" :games="part.games" class="sl-inline-meter" />{{
          part.text
        }}</template
      >{{ meterLine[1] }}
    </p>

    <h2>{{ i18n.t('app.sl-explain-chance-head') }}</h2>
    <p>{{ i18n.t(oneBoard ? 'app.sl-explain-intro-one' : 'app.sl-explain-intro') }}</p>
    <p v-if="!oneBoard">{{ i18n.t('app.sl-explain-sum-lead') }}</p>
    <div class="sl-table-wrap">
      <table class="sl-table">
        <thead>
          <tr>
            <th>{{ i18n.t('app.sl-explain-map') }}</th>
            <th>{{ i18n.t('app.sl-explain-comp') }}</th>
            <th>{{ i18n.t('app.sl-explain-record') }}</th>
            <th class="sl-chance">{{ i18n.t('app.sl-explain-chance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(team, index) in shown.teams" :key="index">
            <td class="sl-num">{{ team.map + 1 }}</td>
            <td>{{ groupName(team.group) }}</td>
            <td class="sl-num">{{ team.comp ? `${team.comp[1]}–${team.comp[2]}` : '–' }}</td>
            <td class="sl-num sl-chance">
              <strong>{{ percent(team.chance) }}</strong>
            </td>
          </tr>
        </tbody>
        <tbody v-if="!oneBoard" class="sl-total">
          <tr v-for="row in outcomes" :key="row.label">
            <th scope="row" colspan="3">{{ row.label }}</th>
            <td class="sl-num sl-chance">{{ percent(row.chance) }}</td>
          </tr>
          <tr class="sl-match">
            <th scope="row" colspan="3">
              {{ i18n.t('app.sl-explain-won-match', { count: needed }) }}
            </th>
            <td class="sl-num sl-chance">
              <strong>{{ percent(shown.chance) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>{{ i18n.t('app.sl-explain-steps-head') }}</h2>
    <p>{{ i18n.t('app.sl-explain-steps-lead') }}</p>
    <ol>
      <li>{{ i18n.t('app.sl-explain-step-1') }}</li>
      <li>{{ i18n.t('app.sl-explain-step-2') }}</li>
      <li>{{ i18n.t('app.sl-explain-step-3') }}</li>
      <li>{{ i18n.t('app.sl-explain-step-4') }}</li>
    </ol>
    <p>{{ i18n.t('app.sl-explain-steps') }}</p>

    <h2>{{ i18n.t('app.sl-explain-formation-head') }}</h2>
    <p>
      {{
        i18n.t('app.sl-explain-formation', {
          recorded: i18n.t('app.sl-formation-recorded'),
          suggested: i18n.t('app.sl-formation-suggested'),
        })
      }}
    </p>
    <p class="reading-secondary">{{ i18n.t('app.sl-explain-limits') }}</p>
  </BaseModal>
</template>

<style scoped>
.sl-inline-meter {
  margin: 0 0.3em 0 0.2em;
  vertical-align: -0.1em;
}

.sl-table-wrap {
  overflow-x: auto;
}

.sl-table {
  border-collapse: collapse;
  margin: 4px 0 12px;
  font-size: 0.9rem;
  color: var(--reading-text);
}

.sl-table :is(th, td) {
  padding: 6px 16px 6px 0;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.sl-table th {
  font-weight: 600;
  color: var(--reading-muted);
}

.sl-table .sl-num {
  white-space: nowrap;
}

.sl-table .sl-chance {
  padding-right: 0;
  text-align: right;
}

.sl-total tr:first-child > * {
  border-top: 2px solid rgba(255, 255, 255, 0.28);
}

.sl-total th {
  font-weight: 500;
}

.sl-total .sl-match > * {
  color: var(--reading-text);
  font-weight: 600;
  border-bottom: 0;
}
</style>
