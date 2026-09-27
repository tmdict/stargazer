<script setup lang="ts">
const { size = 12 } = defineProps<{ size?: number }>()
</script>

<template>
  <svg
    :width="size"
    :height="(size * 8) / 12"
    viewBox="0 0 12 8"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M1 4h9M7 1l3 3-3 3" />
  </svg>
</template>
