<script setup lang="ts">
const { size = 24 } = defineProps<{
  size?: number
}>()

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="5" />
    <rect
      v-for="angle in RAY_ANGLES"
      :key="angle"
      x="11"
      y="2"
      width="2"
      height="3"
      :transform="`rotate(${angle} 12 12)`"
    />
  </svg>
</template>
