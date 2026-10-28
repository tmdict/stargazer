<script setup lang="ts">
/* Small-scale warning mark: IconHelpSmall's ring and stroke weights with an
   exclamation mark, so the two read as a pair. */

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
    <path d="M12 6.8v6.6" stroke-width="2.4" />
    <path d="M12 17.4h.01" stroke-width="2.6" />
  </svg>
</template>
