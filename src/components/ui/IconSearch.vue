<script setup lang="ts">
const { size = 17 } = defineProps<{
  size?: number
}>()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.386 14.386l4.088 4.088-4.088-4.088c-2.942 2.942-7.712 2.942-10.653 0-2.942-2.942-2.942-7.712 0-10.653 2.941-2.942 7.711-2.942 10.653 0 2.942 2.941 2.942 7.711 0 10.653z"
    />
  </svg>
</template>
