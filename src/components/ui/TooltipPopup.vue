<script setup lang="ts">
// Positioning shell for tooltips; show/hide policy lives in the pairing
// composables: useHoverTooltip for action triggers, useInfoTip for info-only
// triggers (its header documents the full policy).
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { clampX } from '@/utils/viewport'

const {
  targetElement,
  offset = 10,
  maxWidth = '300px',
} = defineProps<{
  // Only read via getBoundingClientRect, so SVG triggers (icon components)
  // anchor as well as HTML ones.
  targetElement: Element
  variant: 'simple' | 'detailed'
  offset?: number
  maxWidth?: string
}>()

const VIEWPORT_MARGIN = 10

const tooltipRef = ref<HTMLElement>()
const position = ref({ x: 0, y: 0 })

const updatePosition = () => {
  if (!targetElement || !tooltipRef.value) return

  const rect = targetElement.getBoundingClientRect()
  const tooltipRect = tooltipRef.value.getBoundingClientRect()

  // Centered on the trigger (left-aligned for wide triggers), above it,
  // flipping below when there is no room above.
  const isWide = rect.width > tooltipRect.width * 1.5
  const x = clampX(
    isWide ? rect.left : rect.left + rect.width / 2 - tooltipRect.width / 2,
    tooltipRect.width,
    VIEWPORT_MARGIN,
  )
  let y = rect.top - tooltipRect.height - offset
  if (y < VIEWPORT_MARGIN) y = rect.bottom + offset

  position.value = { x, y }
}

// Callers may retarget a mounted instance (e.g. hovering across keyword
// spans); flush post so the measurement sees the re-rendered content.
watch(() => targetElement, updatePosition, { flush: 'post' })

// Live content can resize a mounted tooltip (TeamSaveActions' New flips to
// Confirm while hovered); re-center on the trigger when it does.
let contentObserver: ResizeObserver | null = null

onMounted(() => {
  updatePosition()
  // Capture phase: scroll events don't bubble, so this is the only way to
  // hear scrolls inside nested containers (e.g. the roster panel) and keep
  // the tooltip anchored to its target.
  window.addEventListener('scroll', updatePosition, { capture: true })
  window.addEventListener('resize', updatePosition)
  if (typeof ResizeObserver !== 'undefined' && tooltipRef.value) {
    contentObserver = new ResizeObserver(updatePosition)
    contentObserver.observe(tooltipRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, { capture: true })
  window.removeEventListener('resize', updatePosition)
  contentObserver?.disconnect()
})
</script>

<template>
  <div
    ref="tooltipRef"
    :class="['tooltip', `tooltip-${variant}`]"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      maxWidth: maxWidth,
    }"
  >
    <slot name="content" />
  </div>
</template>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 9999;
  background: rgba(20, 20, 20, 0.75);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  pointer-events: none;
  color: #fff;
}

.tooltip :deep(*) {
  color: inherit;
}

.tooltip-simple {
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  white-space: nowrap;
  animation: tooltipFadeIn 0.15s ease-out;
}

/* Prose typography inherits into slot content, so callers don't restate it. */
.tooltip-detailed {
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 0.85rem;
  line-height: 1.4;
  animation: tooltipFadeIn 0.2s ease-out;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
