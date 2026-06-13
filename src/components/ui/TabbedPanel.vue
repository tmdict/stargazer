<script setup lang="ts">
import TabBar from './TabBar.vue'

// A self-contained tabbed card: the shared TabBar over a bordered, padded
// content panel. For standalone pages (e.g. /teams); arena embeds TabBar in its
// own scrolling panel instead.
interface Tab {
  key: string
  label: string
  hidden?: boolean
  hideMobile?: boolean
}

defineProps<{
  tabs: Tab[]
}>()

const active = defineModel<string>({ required: true })
</script>

<template>
  <div class="tabbed-panel">
    <TabBar v-model="active" :tabs />
    <div class="tab-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tabbed-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.tab-content {
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border-primary);
  border-top: none;
  border-radius: 0 0 var(--radius-large) var(--radius-large);
  padding: var(--spacing-2xl);
}

@media (max-width: 768px) {
  .tab-content {
    padding: var(--spacing-lg);
  }
}

@media (max-width: 480px) {
  .tab-content {
    padding: var(--spacing-md);
  }
}
</style>
