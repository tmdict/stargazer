<script setup lang="ts">
import { computed } from 'vue'

import SkillsBrowser from '@/components/skill/SkillsBrowser.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'

// `name` is the route param (route has `props: true`).
const props = defineProps<{ name?: string }>()

const lang = useRouteLocale()
const slug = computed(() => (props.name ?? '').toLowerCase())
</script>

<template>
  <!-- An unknown slug degrades to the empty reader prompt + the full grid,
       so a stale/typo'd URL lands on a usable page rather than a dead end. -->
  <SkillsBrowser :slug :lang />
</template>
