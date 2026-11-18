<script setup lang="ts">
/* The odds view: what each of the shop's eight sources makes at each shop
   level, as Toto measured it, with the range round each measured figure. It
   always shows the table kept in this repo. */

import { computed, ref, watch } from 'vue'

import BaseModal from '@/components/modals/BaseModal.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import { useI18nStore } from '@/stores/i18n'
import { goodName } from '@/utils/shopGoodNames'

const { show, level } = defineProps<{
  show: boolean
  // The shop level of the round entered, which the view opens on.
  level: number
}>()

const emit = defineEmits<{ close: [] }>()

const i18n = useI18nStore()
const shown = ref(level)
watch(
  () => show,
  (open) => {
    if (open) shown.value = level
  },
)

const levels = computed(() =>
  MEASURED_ODDS.levels.map((_, index) => ({
    key: String(index + 1),
    label: i18n.t('app.shop-level', { level: index + 1 }),
    short: i18n.t('app.shop-level-short', { level: index + 1 }),
    selected: shown.value === index + 1,
  })),
)

const sources = computed(() => MEASURED_ODDS.levels[shown.value - 1] ?? [])
</script>

<template>
  <BaseModal :show :label="i18n.t('app.shop-odds-title')" @close="emit('close')">
    <h1>{{ i18n.t('app.shop-odds-title') }}</h1>
    <p>{{ i18n.t('app.shop-odds-lead') }}</p>
    <p class="reading-secondary">{{ i18n.t('app.shop-odds-range') }}</p>
    <!-- A popup is dark in both looks, so what follows the look takes its dark colours. -->
    <div data-theme="dark">
      <SegmentedPicker
        v-slot="{ segment }"
        class="levels"
        :segments="levels"
        small
        @select="shown = Number($event)"
      >
        <span class="wide">{{ segment.label }}</span>
        <span class="narrow">{{ segment.short }}</span>
      </SegmentedPicker>
    </div>
    <table class="shop-odds" data-theme="dark">
      <tbody>
        <tr v-for="(entries, index) in sources" :key="index">
          <th scope="row">{{ i18n.t('app.shop-odds-source', { n: index + 1 }) }}</th>
          <td>
            <span v-for="entry in entries" :key="entry.good" class="entry">
              <span>{{ goodName(entry.good, i18n.currentLocale) }}</span>
              <b>{{ entry.percent }}%</b>
              <span v-if="entry.low !== undefined && entry.high !== undefined" class="reading-meta">
                ({{ entry.low }} – {{ entry.high }})
              </span>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </BaseModal>
</template>

<style scoped>
.levels {
  margin: 12px 0;
}

.narrow {
  display: none;
}

@media (max-width: 520px) {
  .wide {
    display: none;
  }

  .narrow {
    display: inline;
  }

  .levels {
    display: flex;
  }

  .levels :deep(.segment) {
    flex: 1 1 auto;
    min-width: 0;
    padding-inline: 4px;
  }
}

.shop-odds {
  width: 100%;
  border-collapse: collapse;
}

.shop-odds th,
.shop-odds td {
  padding: 8px 8px 8px 0;
  border-top: 1px solid var(--color-border-primary);
  text-align: left;
  vertical-align: top;
}

.shop-odds th {
  width: 1%;
  white-space: nowrap;
  font-weight: 600;
}

.entry {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
}

.entry b {
  font-variant-numeric: tabular-nums;
}
</style>
