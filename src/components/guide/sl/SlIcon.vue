<script setup lang="ts">
/* The icons on and under a generated set's boards. */

import { computed } from 'vue'

const {
  name,
  label,
  share = 0,
} = defineProps<{
  name: 'players' | 'record' | 'chance' | 'lock' | 'swap' | 'arrow' | 'check' | 'sparkle'
  label?: string
  // How much of the chance icon's ring is filled, from 0 to 1.
  share?: number
}>()

const WEDGE = 5.4
// Clockwise from the top.
const wedge = computed(() => {
  const turn = share * 2 * Math.PI
  const x = (12 + WEDGE * Math.sin(turn)).toFixed(2)
  const y = (12 - WEDGE * Math.cos(turn)).toFixed(2)
  return `M12 12V${12 - WEDGE}A${WEDGE} ${WEDGE} 0 ${share > 0.5 ? 1 : 0} 1 ${x} ${y}z`
})
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
    <template v-else-if="name === 'record'">
      <path d="M7 3.5h10v5.2a5 5 0 0 1-10 0z" fill="currentColor" />
      <path
        d="M7 5.5H4.2c0 3 1.2 4.7 3.4 5.1M17 5.5h2.8c0 3-1.2 4.7-3.4 5.1M12 13.5v3.5M8 20.5h8"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="name === 'chance'">
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2" />
      <circle v-if="share >= 1" cx="12" cy="12" :r="WEDGE" fill="currentColor" />
      <path v-else-if="share > 0" :d="wedge" fill="currentColor" />
    </template>
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
    <path
      v-else-if="name === 'sparkle'"
      d="M11 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18 14.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9z"
      fill="currentColor"
    />
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
