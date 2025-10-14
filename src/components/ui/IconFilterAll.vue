<script setup lang="ts">
interface Props {
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 24,
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none">
    <g transform="translate(12, 12)">
      <!-- Vertical line -->
      <line
        x1="0"
        y1="-5.5"
        x2="0"
        y2="5.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- 60 degree line -->
      <line
        x1="-4.76"
        y1="-2.75"
        x2="4.76"
        y2="2.75"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- 120 degree line -->
      <line
        x1="-4.76"
        y1="2.75"
        x2="4.76"
        y2="-2.75"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <!-- Center dot -->
      <circle cx="0" cy="0" r="1.2" fill="currentColor" />
    </g>
  </svg>
</template>
