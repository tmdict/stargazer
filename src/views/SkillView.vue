<script setup lang="ts">
import { computed } from 'vue'

import SkillsBrowser from '@/components/skill/SkillsBrowser.vue'
import type { SkillLocale } from '@/lib/types/i18n'

// Route params (route has `props: true`); the prefix is the skill-text
// language, already validated by the route's param regex.
const props = defineProps<{ name?: string; textLocale?: string }>()

const lang = computed<SkillLocale>(() => (props.textLocale ?? 'en') as SkillLocale)
const slug = computed(() => (props.name ?? '').toLowerCase())
</script>

<template>
  <!-- An unknown slug degrades to the empty reader prompt + the full grid,
       so a stale/typo'd URL lands on a usable page rather than a dead end. -->
  <SkillsBrowser :slug :lang />
</template>
