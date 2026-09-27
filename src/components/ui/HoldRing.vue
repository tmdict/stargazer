<script setup lang="ts">
// Long-press progress ring. Mounted when the ring delay passes, it fills over
// the rest of the hold so it completes exactly when the hold fires.
import { LONG_PRESS_MS, LONG_PRESS_RING_DELAY_MS } from '@/composables/useLongPress'

const fillMs = `${LONG_PRESS_MS - LONG_PRESS_RING_DELAY_MS}ms`
</script>

<template>
  <svg class="hold-ring capture-exclude" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r="46" />
    <circle class="fill" cx="50" cy="50" r="46" pathLength="100" />
  </svg>
</template>

<style scoped>
.hold-ring {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  overflow: visible;
  pointer-events: none;
  transform: rotate(-90deg);
}

circle {
  fill: none;
  stroke-width: 7;
}

.track {
  stroke: rgba(0, 0, 0, 0.18);
}

.fill {
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-dasharray: 100;
  animation: hold-fill v-bind(fillMs) linear forwards;
}

@keyframes hold-fill {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
