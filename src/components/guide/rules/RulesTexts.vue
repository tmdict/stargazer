<script setup lang="ts">
/* A part of the page that is text alone: the map's rules or the questions,
   each item a heading and its text. */

import { useRulesNames } from './useRules'

const { view, count } = defineProps<{ view: 'map' | 'questions'; count: number }>()

const { t } = useRulesNames()
</script>

<template>
  <section class="rules-view">
    <h2>{{ t(`rules-${view}`) }}</h2>
    <div v-for="n in count" :key="n" class="rules-box">
      <h3>{{ t(`rules-${view}-${n}`) }}</h3>
      <p>{{ t(`rules-${view}-${n}-text`) }}</p>
    </div>
  </section>
</template>

<style scoped>
h3 {
  margin: 0;
}

h3 + p {
  margin-top: 4px;
}
</style>
