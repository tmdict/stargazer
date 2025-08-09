<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  targetElement: HTMLElement
  // Content props for simple text mode
  text?: string
  // Positioning options
  offset?: number
  placement?: 'top' | 'bottom' | 'auto'
  // Visual variants
  variant?: 'simple' | 'detailed'
  // Custom styling options
  minWidth?: string
  maxWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  offset: 8,
  placement: 'auto',
  variant: 'simple',
  minWidth: 'auto',
  maxWidth: '300px',
})

const tooltipRef = ref<HTMLElement>()
const position = ref({ x: 0, y: 0 })

const formattedText = computed(() => {
  if (!props.text) return ''
  return props.text
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
})

const updatePosition = () => {
  if (!props.targetElement || !tooltipRef.value) return

  const rect = props.targetElement.getBoundingClientRect()
  const tooltipRect = tooltipRef.value.getBoundingClientRect()

  // Position above the element by default
  let x = rect.left + rect.width / 2 - tooltipRect.width / 2
  let y = rect.top - tooltipRect.height - props.offset

  // Adjust if tooltip goes off screen
  if (x < 10) x = 10
  if (x + tooltipRect.width > window.innerWidth - 10) {
    x = window.innerWidth - tooltipRect.width - 10
  }

  // If tooltip would go above the viewport, position it below
  if (y < 10) {
    y = rect.bottom + props.offset
  }

  position.value = { x, y }
}

onMounted(() => {
  updatePosition()
  window.addEventListener('scroll', updatePosition)
  window.addEventListener('resize', updatePosition)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div
    ref="tooltipRef"
    :class="['tooltip', `tooltip-${variant}`]"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      minWidth: minWidth,
      maxWidth: maxWidth,
    }"
  >
    <!-- Simple text mode -->
    <template v-if="text">
      {{ formattedText }}
    </template>

    <!-- Slot mode for complex content -->
    <template v-else>
      <slot name="content" />
    </template>
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

.tooltip-simple {
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  white-space: nowrap;
  animation: tooltipFadeIn 0.15s ease-out;
}

.tooltip-detailed {
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 200px;
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
