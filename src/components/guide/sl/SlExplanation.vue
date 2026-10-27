<script setup lang="ts">
/* What the set's chance to win means and how it is worked out, with the
   set's own numbers. */

import { computed } from 'vue'

import type { SlShown } from './SlResult.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import { useI18nStore } from '@/stores/i18n'
import { slPercent as percent, useSlNames } from './useSlNames'

const { shown } = defineProps<{ show: boolean; shown: SlShown }>()

const emit = defineEmits<{ close: [] }>()

const i18n = useI18nStore()
const { groupName } = useSlNames()

const outcomes = computed(() => [
  { label: 'app.sl-explain-won-5', chance: shown.odds[5] ?? 0 },
  { label: 'app.sl-explain-won-4', chance: shown.odds[4] ?? 0 },
  { label: 'app.sl-explain-won-3', chance: shown.odds[3] ?? 0 },
])
</script>

<template>
  <BaseModal
    :show
    :label="i18n.t('app.sl-explain-title')"
    max-width="1000px"
    @close="emit('close')"
  >
    <h1>{{ i18n.t('app.sl-explain-title') }}</h1>

    <h2>{{ i18n.t('app.sl-explain-meaning-head') }}</h2>
    <p>{{ i18n.t('app.sl-explain-intro', { chance: percent(shown.chance) }) }}</p>
    <p>{{ i18n.t('app.sl-explain-typical') }}</p>
    <p>{{ i18n.t('app.sl-explain-forecast') }}</p>

    <h2>{{ i18n.t('app.sl-explain-teams-head') }}</h2>
    <p>{{ i18n.t('app.sl-explain-set') }}</p>
    <div class="sl-table-wrap">
      <table class="sl-table">
        <thead>
          <tr>
            <th class="sl-num">{{ i18n.t('app.sl-explain-map') }}</th>
            <th>{{ i18n.t('app.sl-explain-comp') }}</th>
            <th>{{ i18n.t('app.sl-explain-record') }}</th>
            <th>{{ i18n.t('app.sl-explain-chance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in shown.teams" :key="team.map">
            <td class="sl-num">{{ team.map + 1 }}</td>
            <td>{{ groupName(team.group) }}</td>
            <td class="sl-num">{{ team.comp ? `${team.comp[1]}–${team.comp[2]}` : '–' }}</td>
            <td class="sl-num">
              <strong>{{ percent(team.chance) }}</strong>
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
    <p>{{ i18n.t('app.sl-explain-weights') }}</p>

    <h2>{{ i18n.t('app.sl-explain-sum-head') }}</h2>
    <p>{{ i18n.t('app.sl-explain-sum-lead') }}</p>
    <div class="sl-table-wrap">
      <table class="sl-table">
        <tbody>
          <tr v-for="row in outcomes" :key="row.label">
            <th scope="row">{{ i18n.t(row.label) }}</th>
            <td class="sl-num">{{ percent(row.chance) }}</td>
          </tr>
          <tr class="sl-total">
            <th scope="row">{{ i18n.t('app.sl-explain-won-match') }}</th>
            <td class="sl-num">
              <strong>{{ percent(shown.chance) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>{{ i18n.t('app.sl-explain-search-head') }}</h2>
    <p>{{ i18n.t('app.sl-explain-search') }}</p>
    <p v-if="shown.beforeUnder !== null">
      {{ i18n.t('app.sl-explain-before', { count: shown.beforeUnder }) }}
    </p>
    <p>{{ i18n.t('app.sl-explain-roster') }}</p>
    <p class="reading-secondary">{{ i18n.t('app.sl-explain-limits') }}</p>
  </BaseModal>
</template>

<style scoped>
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

.sl-table .sl-total :is(th, td) {
  color: var(--reading-text);
  border-bottom: 0;
}
</style>
