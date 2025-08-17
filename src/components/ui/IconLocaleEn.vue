<script setup lang="ts">
interface Props {
  size?: number
}

withDefaults(defineProps<Props>(), {
  size: 24,
})
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
      <mask id="en-mask">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <text
          x="12"
          y="16.5"
          text-anchor="middle"
          fill="black"
          font-size="11"
          font-weight="900"
          font-family="system-ui, -apple-system, sans-serif"
        >
          EN
        </text>
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" mask="url(#en-mask)" />
  </svg>
</template>
