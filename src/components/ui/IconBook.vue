<script setup lang="ts">
import { useId } from 'vue'

const { size = 24 } = defineProps<{
  size?: number
}>()

const id = useId()
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <mask :id>
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <path fill="black" d="M6 8C7.9 7.2 9.8 7.4 11.4 8.4V16.6C9.8 15.7 7.9 15.5 6 16.2Z" />
        <path fill="black" d="M18 8C16.1 7.2 14.2 7.4 12.6 8.4V16.6C14.2 15.7 16.1 15.5 18 16.2Z" />
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" :mask="`url(#${id})`" />
  </svg>
</template>
