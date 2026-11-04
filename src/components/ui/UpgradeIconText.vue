<script setup lang="ts">
/* Text with each {paragon} and {refinement} token drawn as its upgrade icon. */

import { computed } from 'vue'

import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'

const props = defineProps<{ text: string }>()

type Part = { text: string } | { icon: 'paragon' | 'refinement'; beforeLevel: boolean }

// Splitting on a captured group puts each token's name at the odd places.
const parts = computed((): Part[] => {
  const pieces = props.text.split(/\{(paragon|refinement)\}/)
  return pieces.map((piece, i): Part =>
    i % 2
      ? { icon: piece as 'paragon' | 'refinement', beforeLevel: /^\d/.test(pieces[i + 1]!) }
      : { text: piece },
  )
})
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <UpgradeIcon v-if="'icon' in part" :kind="part.icon" :before-level="part.beforeLevel" />
    <template v-else>{{ part.text }}</template>
  </template>
</template>
