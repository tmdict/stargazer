<script setup lang="ts">
import IconSearch from '@/components/ui/IconSearch.vue'
import { useSearchOverlay, useShortcutLabel } from '@/composables/useSearchOverlay'
import { useI18nStore } from '@/stores/i18n'

// With `select`, the overlay opens in select mode and hands the chosen slug
// to this handler instead of navigating (the arena roster placing a hero).
const { select } = defineProps<{
  select?: (slug: string) => void
}>()

const { open, openSelect } = useSearchOverlay()
const i18n = useI18nStore()
const shortcut = useShortcutLabel()

const onClick = () => {
  if (select) openSelect(select)
  else open()
}
</script>

<template>
  <button type="button" class="search-trigger" aria-haspopup="dialog" @click="onClick">
    <IconSearch :size="17" class="trigger-icon" />
    <span class="trigger-label">{{ i18n.t('app.skill-search-placeholder') }}</span>
    <!-- The keyboard shortcut opens the navigate flavor, so a select-mode
         trigger must not advertise it. -->
    <kbd v-if="!select" class="trigger-kbd">{{ shortcut }}</kbd>
  </button>
</template>

<style scoped>
/* A button dressed as a search input; the real input lives in the overlay. */
.search-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 640px;
  padding: 0.45rem 0.9rem;
  font: inherit;
  font-size: 1rem;
  color: var(--color-text-secondary);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.search-trigger:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-small);
}

.search-trigger:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(54, 149, 142, 0.22);
}

.trigger-icon {
  flex-shrink: 0;
  color: #a09a8c;
}

.trigger-label {
  flex: 1;
  text-align: left;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The min-width absorbs the "Ctrl K" to "⌘ K" swap on Macs. */
.trigger-kbd {
  flex-shrink: 0;
  min-width: 46px;
  text-align: center;
  font-family: inherit;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: #857f72;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 5px;
  padding: 2px 7px;
}

/* Shortcut chips mean nothing on touch devices. */
@media (hover: none) {
  .trigger-kbd {
    display: none;
  }
}
</style>
