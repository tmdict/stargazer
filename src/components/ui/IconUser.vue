<script setup lang="ts">
const { size = 14 } = defineProps<{
  size?: number
}>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
  >
    <circle cx="8" cy="4.4" r="2.3" />
    <path d="M2.8 14a5.2 4.2 0 0 1 10.4 0" />
  </svg>
</template>
