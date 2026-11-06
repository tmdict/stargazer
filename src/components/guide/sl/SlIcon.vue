<script setup lang="ts">
/* The icons on and under a generated set's boards. */

import { SPARKLE_PATH } from '@/components/ui/IconSparkle.vue'

const { name, label } = defineProps<{
  name: 'players' | 'games' | 'lock' | 'swap' | 'arrow' | 'check' | 'sparkle'
  label?: string
}>()
</script>

<template>
  <svg
    class="sl-icon"
    viewBox="0 0 24 24"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <template v-if="name === 'players'">
      <circle cx="9" cy="8" r="3.3" fill="currentColor" />
      <path d="M2.8 19.5c0-3.6 2.8-6.1 6.2-6.1s6.2 2.5 6.2 6.1z" fill="currentColor" />
      <circle cx="16.8" cy="9" r="2.7" fill="currentColor" />
      <path d="M16.3 13.6c3.1-.3 5.4 2 5.4 5.9h-4.6c0-2.4-.3-4.2-.8-5.9z" fill="currentColor" />
    </template>
    <g
      v-else-if="name === 'games'"
      fill="none"
      stroke="currentColor"
      stroke-width="2.6"
      stroke-linecap="round"
    >
      <path d="M3 3l9.75 9.75M21 3l-9.75 9.75" />
      <path
        d="M5.25 14.25l4.5 4.5M18.75 14.25l-4.5 4.5M3.3 20.7l3.45-3.45M20.7 20.7l-3.45-3.45"
        stroke-width="2.4"
      />
    </g>
    <template v-else-if="name === 'lock'">
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2" />
    </template>
    <path
      v-else-if="name === 'swap'"
      d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'check'"
      d="M6 12.5l4 4 8-9"
      fill="none"
      stroke="currentColor"
      stroke-width="2.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path v-else-if="name === 'sparkle'" :d="SPARKLE_PATH" fill="currentColor" />
    <path
      v-else
      d="M5 6l6 6-6 6M13 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.sl-icon {
  flex: none;
  width: 24px;
  height: 24px;
}
</style>
