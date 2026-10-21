<script setup lang="ts">
import { computed, ref } from 'vue'

import ArtifactSelection from './ArtifactSelection.vue'
import PhantimalSelection from './PhantimalSelection.vue'
import FilterChip from './ui/FilterChip.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useI18nStore } from '@/stores/i18n'
import { tagLabel } from '@/utils/skillLabels'

const {
  artifacts,
  phantimals,
  isDraggable,
  // See CharacterSelection: off when the picker flows in normal page height (5 v 5).
  scrollable = true,
} = defineProps<{
  artifacts: readonly ArtifactType[]
  phantimals: readonly PhantimalType[]
  isDraggable?: boolean
  scrollable?: boolean
}>()

const i18n = useI18nStore()

type Tagged = { tags?: readonly string[] }

const picked = ref<readonly string[]>([])

const toggle = (tag: string) => {
  picked.value = picked.value.includes(tag)
    ? picked.value.filter((t) => t !== tag)
    : [...picked.value, tag]
}

const chips = computed(() => {
  const items: Tagged[] = [...phantimals, ...artifacts]
  const tags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort()
  return tags.map((tag) => ({
    tag,
    label: tagLabel(tag, i18n.currentLocale),
    count: items.filter((item) => item.tags?.includes(tag)).length,
  }))
})

const shown = <T extends Tagged>(items: readonly T[]): readonly T[] =>
  picked.value.length
    ? items.filter((item) => picked.value.some((tag) => item.tags?.includes(tag)))
    : items

const shownPhantimals = computed(() => shown(phantimals))
const shownArtifacts = computed(() => shown(artifacts))
</script>

<template>
  <div v-scroll-chain class="seasonal-selection" :class="{ scrollable }">
    <div v-if="chips.length" class="tag-chips">
      <span class="tag-chips-label">{{ i18n.t('app.filters') }}</span>
      <FilterChip
        v-for="chip in chips"
        :key="chip.tag"
        :label="chip.label"
        :count="chip.count"
        :active="picked.includes(chip.tag)"
        @click="toggle(chip.tag)"
      />
    </div>
    <PhantimalSelection :phantimals="shownPhantimals" :is-draggable />
    <ArtifactSelection :artifacts="shownArtifacts" />
  </div>
</template>

<style scoped>
.seasonal-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.tag-chips-label {
  margin-right: 4px;
  font-size: var(--chip-font-size);
  font-weight: 600;
  color: var(--color-text-secondary);
  opacity: 0.75;
}

@media (min-width: 1220px) {
  .seasonal-selection.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

@media (max-width: 768px) {
  .tag-chips {
    padding-top: var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .seasonal-selection {
    gap: var(--spacing-md);
  }
}
</style>
