<script setup lang="ts">
import { useId } from 'vue'

const { size = 24 } = defineProps<{ size?: number }>()

const id = useId()
</script>

<template>
  <!-- Masked cut-out, as in IconCheckCircle. -->
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
    <mask :id>
      <rect width="24" height="24" fill="#fff" />
      <path
        d="M8.5 8.5l7 7M15.5 8.5l-7 7"
        fill="none"
        stroke="#000"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </mask>
    <circle cx="12" cy="12" r="10" :mask="`url(#${id})`" />
  </svg>
</template>
