<script setup lang="ts">
/* The Seasonal tab's charm part: the season's charms, then its charm types.
   Names and text come from the skill text, so they show in the reader's skill
   language once the app has fetched it. */

import { computed } from 'vue'

import CharmChip from './CharmChip.vue'
import CharmTypeIcon from './CharmTypeIcon.vue'
import { oldestFirst } from '@/lib/heroAge'
import { CURRENT_SEASON } from '@/lib/seasonal'
import type { CharmData } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { getSkillLanguage } from '@/utils/skillLocale'

const { charms, showTypes } = defineProps<{
  charms: readonly CharmData[]
  showTypes: boolean
}>()

const i18n = useI18nStore()

const lang = computed(() => i18n.effectiveSkillLocale)
const language = computed(() => getSkillLanguage(lang.value))

const types = computed(() =>
  showTypes
    ? Object.entries(language.value?.charmTypes ?? {}).map(([type, text]) => ({ type, ...text }))
    : [],
)

const rows = computed(() =>
  charms.map((charm) => ({
    charm,
    heroes: oldestFirst(charm.heroes),
    text: language.value?.charms?.charms[charm.id]?.at(-1),
  })),
)

const heading = (label: string): string =>
  `${i18n.t('game.season')} ${CURRENT_SEASON} ${i18n.t(label)}`
</script>

<template>
  <div v-if="types.length || rows.length" class="charm-selection">
    <section v-if="rows.length" class="charm-group">
      <h3 class="seasonal-title">{{ heading('app.charms') }}</h3>
      <div class="charm-chips">
        <CharmChip
          v-for="{ charm, heroes, text } in rows"
          :key="charm.id"
          :charm
          :heroes
          :text
          :lang
        />
      </div>
    </section>
    <section v-if="types.length" class="charm-group">
      <h3 class="seasonal-title">{{ heading('app.mythic-charm-types') }}</h3>
      <div class="seasonal-cells">
        <div v-for="{ type, name, bonus } in types" :key="type" class="seasonal-cell">
          <CharmTypeIcon :type :name :bonus />
          <span class="seasonal-cell-name" :lang>{{ name }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.charm-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.charm-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.charm-chips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(228px, 100%), 1fr));
  gap: 10px;
  padding: var(--spacing-lg);
}

@media (max-width: 768px) {
  .charm-chips {
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .charm-selection {
    gap: var(--spacing-md);
  }

  .charm-chips {
    padding: var(--spacing-sm);
  }
}
</style>
