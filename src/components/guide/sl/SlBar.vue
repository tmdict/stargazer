<script setup lang="ts">
/* The generator's roster bar, with the type of set to generate. Picking or
   importing a roster makes it the active one, which the page copies. */

import RosterMenu from '@/components/RosterMenu.vue'
import RosterTransferActions from '@/components/RosterTransferActions.vue'
import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import type { TeamVariantChoice } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

// waiting: the Supreme League worker is still learning the model.
const { busy, ready, waiting } = defineProps<{ busy: boolean; ready: boolean; waiting: boolean }>()

const emit = defineEmits<{ generate: [] }>()

const variant = defineModel<TeamVariantChoice>('variant', { required: true })

const i18n = useI18nStore()
</script>

<template>
  <div class="sl-bar">
    <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
    <RosterMenu />
    <span class="sl-bar-actions">
      <RosterTransferActions />
      <TeamVariantPicker
        active-mode="5v5"
        :match="variant"
        :source-id="null"
        :has-content="false"
        @select-variant="variant = $event"
      />
      <button
        type="button"
        class="solid-btn sl-action"
        :disabled="!ready || busy"
        :aria-busy="busy"
        @click="emit('generate')"
      >
        {{
          i18n.t(busy ? 'app.sl-generating' : waiting ? 'app.sl-getting-ready' : 'app.sl-generate')
        }}
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
    grid-column: 1 / -1;
  }
  .sl-bar-actions .sl-action {
    margin-left: auto;
  }
}
</style>
