<script setup lang="ts">
/* How the set's chance to win is worked out, with the set's own numbers:
   each map's chance beside its comp's record, how a chance is built, and the
   chance of winning all five maps, exactly four and exactly three. */

import type { SlShown } from './SlResult.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import { useI18nStore } from '@/stores/i18n'
import { slPercent as percent, useSlNames } from './useSlNames'

defineProps<{ show: boolean; shown: SlShown }>()

const emit = defineEmits<{ close: [] }>()

const i18n = useI18nStore()
const { groupName } = useSlNames()
</script>

<template>
  <BaseModal :show :label="i18n.t('app.sl-explain-title')" max-width="760px" @close="emit('close')">
    <h1>{{ i18n.t('app.sl-explain-title') }}</h1>
    <p>{{ i18n.t('app.sl-explain-intro', { chance: percent(shown.chance) }) }}</p>
    <div class="sl-table-wrap">
      <table class="sl-table">
        <thead>
          <tr>
            <th>{{ i18n.t('app.sl-explain-map') }}</th>
            <th>{{ i18n.t('app.sl-explain-comp') }}</th>
            <th>{{ i18n.t('app.sl-explain-record') }}</th>
            <th>{{ i18n.t('app.sl-explain-chance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="team in shown.teams" :key="team.map">
            <td>{{ team.map + 1 }}</td>
            <td>{{ groupName(team) }}</td>
            <td>{{ team.comp ? `${team.comp[1]}–${team.comp[2]}` : '–' }}</td>
            <td>
              <strong>{{ percent(team.chance) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      <strong>{{ i18n.t('app.sl-explain-steps-lead') }}</strong>
      {{ i18n.t('app.sl-explain-steps', { prior: shown.prior }) }}
    </p>
    <p>
      <strong>{{ i18n.t('app.sl-explain-few-lead') }}</strong>
      {{ i18n.t('app.sl-explain-few') }}
    </p>
    <p>
      <strong>{{ i18n.t('app.sl-explain-sum-lead') }}</strong>
      {{
        i18n.t('app.sl-explain-sum', {
          five: percent(shown.odds[5] ?? 0),
          four: percent(shown.odds[4] ?? 0),
          three: percent(shown.odds[3] ?? 0),
          chance: percent(shown.chance),
        })
      }}
    </p>
    <p>
      <strong>{{ i18n.t('app.sl-explain-search-lead') }}</strong>
      {{ i18n.t('app.sl-explain-search') }}
    </p>
    <p v-if="shown.beforeUnder !== null">
      {{ i18n.t('app.sl-explain-before', { count: shown.beforeUnder }) }}
    </p>
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
</style>
