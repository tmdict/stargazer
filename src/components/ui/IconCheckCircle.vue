<script setup lang="ts">
import { useId } from 'vue'

const { size = 24 } = defineProps<{ size?: number }>()

const id = useId()
</script>

<template>
  <!-- The mark is masked out of the disc, not painted, so it shows whatever
       sits behind the icon, as IconInfo's "i" does. -->
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor">
    <mask :id>
      <rect width="24" height="24" fill="#fff" />
      <path
        d="M7.5 12.3l3 3 6-6.3"
        fill="none"
        stroke="#000"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </mask>
    <circle cx="12" cy="12" r="10" :mask="`url(#${id})`" />
  </svg>
</template>
