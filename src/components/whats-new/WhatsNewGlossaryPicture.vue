<script setup lang="ts">
/* The Glossary in small: its search box and the first terms with a line or two
   of description each. */

import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { appLabel, gameLabel } from '@/utils/skillLabels'

const lang = useHelpLocale()

// Each term with the widths of its description's lines, in percent.
const TERMS = [
  { key: 'hp', lines: [92, 40] },
  { key: 'atk', lines: [64] },
  { key: 'phys-def', lines: [80] },
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock>
        <div class="find"><IconSearch :size="13" />{{ appLabel('find-a-term', lang) }}</div>
        <div v-for="term in TERMS" :key="term.key" class="term">
          <span class="name">{{ gameLabel(term.key, lang) }}</span>
          <span class="lines">
            <i v-for="(width, i) in term.lines" :key="i" :style="{ width: `${width}%` }"></i>
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.find {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding: 5px 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.term {
  display: grid;
  grid-template-columns: 30% 1fr;
  align-items: start;
  gap: 8px;
  padding: 4px 2px;
  border-top: 1px solid var(--color-border-primary);
}

.name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
}

.lines {
  display: grid;
  gap: 6px;
  padding-top: 4px;
}

.lines i {
  height: 5px;
  border-radius: 3px;
  background: var(--color-text-secondary);
  opacity: 0.35;
}
</style>
