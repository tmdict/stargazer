<script setup lang="ts">
/* Small-scale help mark: an outlined ring with a question mark heavier than
   the ring, which stays legible at 14 to 16px where IconHelp's cut-out mark
   reads poorly. Larger surfaces keep IconHelp. */

const { size = 16 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" stroke-width="1.75" />
    <path d="M8.91 8.47A3.2 3.2 0 1 1 14.9 10.65C14.4 12 12 12.3 12 14.6" stroke-width="2.4" />
    <path d="M12 18.2h.01" stroke-width="2.6" />
  </svg>
</template>
