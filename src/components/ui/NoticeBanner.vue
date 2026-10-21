<script setup lang="ts">
/* A dismissible one-line notice with an icon: the season notice above the
   boards, and (`dark`) the skill reader's language hint on its dark panel. */

import type { Component } from 'vue'

defineProps<{
  icon: Component
  message: string
  dark?: boolean
}>()

const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="notice-banner" :class="{ dark }">
    <component :is="icon" :size="15" class="notice-banner-icon" aria-hidden="true" />
    <span>{{ message }}</span>
    <button type="button" class="notice-banner-dismiss" aria-label="Close" @click="emit('dismiss')">
      ✕
    </button>
  </div>
</template>

<style scoped>
.notice-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  border-radius: var(--radius-medium);
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-white));
  color: var(--color-text-primary);
  font-size: 12.5px;
}

.notice-banner.dark {
  margin-bottom: var(--spacing-lg);
  border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-accent-text);
}

.notice-banner-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.dark .notice-banner-icon {
  color: inherit;
}

.notice-banner-dismiss {
  margin-left: auto;
  padding: 0 2px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.notice-banner-dismiss:hover {
  color: var(--color-text-primary);
}

.dark .notice-banner-dismiss {
  color: rgba(255, 255, 255, 0.5);
}

.dark .notice-banner-dismiss:hover {
  color: rgba(255, 255, 255, 0.9);
}
</style>
