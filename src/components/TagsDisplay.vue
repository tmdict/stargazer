<script setup lang="ts">
import { computed } from 'vue'

import FilterPills from './ui/FilterPills.vue'
import type { FilterPill } from './ui/FilterPills.vue'
import type { TagType } from '../lib/types/character'
import { useI18nStore } from '../stores/i18n'
import { loadTags } from '../utils/dataLoader'

// Using defineModel for v-model support
const modelValue = defineModel<string | null>({ default: null })

const i18n = useI18nStore()

const tags = computed<TagType[]>(() => {
  return loadTags()
})

// Transform tags to FilterPill format
const tagPills = computed<FilterPill[]>(() => {
  return tags.value.map((tag) => ({
    name: tag.name,
    label: i18n.t(`app.${tag.name}`),
  }))
})
</script>

<template>
  <FilterPills v-model="modelValue" :pills="tagPills" />
</template>
