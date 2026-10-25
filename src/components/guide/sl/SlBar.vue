<script setup lang="ts">
/* The generator's roster bar. Picking or importing a roster makes it the
   active one, which the page copies. */

import RosterMenu from '@/components/RosterMenu.vue'
import RosterTransferActions from '@/components/RosterTransferActions.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import { useI18nStore } from '@/stores/i18n'

const { busy, ready } = defineProps<{ busy: boolean; ready: boolean }>()

const emit = defineEmits<{ generate: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="sl-bar">
    <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
    <RosterMenu />
    <span class="sl-bar-actions">
      <RosterTransferActions />
      <button
        type="button"
        class="solid-btn sl-action"
        :disabled="!ready || busy"
        :aria-busy="busy"
        @click="emit('generate')"
      >
        {{ i18n.t(busy ? 'app.sl-generating' : 'app.sl-generate') }}
      </button>
    </span>
  </div>
</template>

<style scoped>
.sl-bar,
.sl-bar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

@media (max-width: 768px) {
  .sl-bar :deep(.roster-menu) {
    flex: 1;
    min-width: 0;
    --dropdown-trigger-width: 100%;
    --dropdown-trigger-min-width: 0;
  }
}

@media (max-width: 480px) {
  .sl-bar {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .sl-bar-actions {
    grid-column: 2;
  }
  .sl-bar-actions .sl-action {
    margin-left: auto;
  }
}
</style>
