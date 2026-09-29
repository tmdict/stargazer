<script setup lang="ts">
import IconArrowRight from '@/components/ui/IconArrowRight.vue'
</script>

<template>
  <div class="help-scene" inert>
    <slot name="from" />
    <IconArrowRight :size="20" class="help-scene-arrow" />
    <slot name="to" />
  </div>
</template>

<style scoped>
.help-scene {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  font-family: var(--font-ui);
  background: var(--help-panel);
  border-radius: var(--radius-large);
}

.help-scene-arrow {
  flex-shrink: 0;
  color: var(--reading-muted);
}

@container help (max-width: 560px) {
  .help-scene {
    flex-direction: column;
    align-items: stretch;
  }

  .help-scene-arrow {
    align-self: center;
    transform: rotate(90deg);
  }
}
</style>
