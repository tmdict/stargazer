<script setup lang="ts">
import { useArrowLayer } from '@/composables/useArrowLayer'

const { svgDimensions, layerStyle, layerTransform } = useArrowLayer()
</script>

<template>
  <svg
    class="grid-arrow-layer"
    :width="svgDimensions.width"
    :height="svgDimensions.height"
    :style="layerStyle"
  >
    <g :transform="layerTransform">
      <slot />
    </g>
  </svg>
</template>

<style scoped>
.grid-arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}

.switching .grid-arrow-layer {
  opacity: 0;
  transition: none;
}
</style>
