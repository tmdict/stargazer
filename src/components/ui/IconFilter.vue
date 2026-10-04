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
    <path d="M2 4h12M4.5 8h7M7 12h2" />
  </svg>
</template>
