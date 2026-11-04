<script lang="ts">
export const SPARKLE_PATH =
  'M11 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18 14.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9z'
</script>

<script setup lang="ts">
const { size = 24 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24">
    <path :d="SPARKLE_PATH" fill="currentColor" />
  </svg>
</template>
