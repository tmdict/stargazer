<script setup lang="ts">
import { computed } from 'vue'

import FilterPills from './ui/FilterPills.vue'
import type { FilterPill } from './ui/FilterPills.vue'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  characters: readonly CharacterType[]
}>()

// Using defineModel for v-model support
const modelValue = defineModel<string | null>({ default: null })

const i18n = useI18nStore()

// Derive unique tag names from characters
const tagPills = computed<FilterPill[]>(() => {
  const names = new Set<string>()
  for (const char of props.characters) {
    for (const tag of char.tags) names.add(tag)
  }
  return [...names].sort().map((name) => ({
    name,
    label: i18n.t(`app.${name}`),
  }))
})
</script>

<template>
  <FilterPills v-model="modelValue" :pills="tagPills" />
</template>
