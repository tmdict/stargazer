<script setup lang="ts">
const { size = 24 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
</template>
