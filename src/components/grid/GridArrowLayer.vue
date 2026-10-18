<script setup lang="ts">
import { useArrowLayer } from '@/composables/useArrowLayer'

const props = defineProps<{ defaultSvgHeight: number }>()

const { svgDimensions, layerStyle, layerTransform } = useArrowLayer(() => props.defaultSvgHeight)
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
/* Visible overflow: a lifted arrow to the far row rises above the box. */
.grid-arrow-layer {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.grid-arrow-layer > g {
  transition: transform var(--transition-perspective);
}
</style>
