<script setup lang="ts">
/* Every list the rules read, the shared ones first, each with who reads it. */

import { computed } from 'vue'

import RulesLinks from './RulesLinks.vue'
import RulesListChip from './RulesListChip.vue'
import { SL_LISTS_PATH } from '@/lib/guide'
import { useRulesNames } from './useRules'

const { names } = defineProps<{ names: string[]; openList: string | null }>()

const emit = defineEmits<{ go: [unit: string]; open: [list: string] }>()

const { t, listLines } = useRulesNames()

const lists = computed(() => names.map((name) => ({ name, lines: listLines(name) })))
</script>

<template>
  <section class="rules-view">
    <h2>{{ t('rules-lists') }}</h2>
    <p>{{ t('rules-lists-intro') }}</p>
    <div class="grid">
      <div v-for="list in lists" :key="list.name" class="rules-box">
        <RulesListChip
          :name="list.name"
          :pressed="openList === list.name"
          class="chip"
          @open="emit('open', $event)"
        />
        <RulesLinks
          v-for="(line, index) in list.lines"
          :key="index"
          :parts="line"
          class="read"
          @go="emit('go', $event)"
          @open="emit('open', $event)"
        />
      </div>
    </div>
    <p class="reading-meta edit">
      <RouterLink :to="SL_LISTS_PATH">{{ t('rules-lists-edit') }}</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
}

.grid .rules-box {
  margin: 0;
  padding: 10px;
}

.chip {
  width: 100%;
}

.chip :deep(.words) {
  flex: 1;
}

.read {
  margin: 6px 2px 0;
}

.edit {
  margin-top: 16px;
}
</style>
