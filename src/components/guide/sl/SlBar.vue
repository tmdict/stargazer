<script setup lang="ts">
/* The generator's roster bar, with the Teams page's mode and maps pickers
   for the boards to generate on. Picking or importing a roster makes it the
   active one, which the page copies. */

import RosterMenu from '@/components/RosterMenu.vue'
import RosterTransferActions from '@/components/RosterTransferActions.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import type { TeamModeKey, VariantMatch } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { busy, ready, waiting, custom } = defineProps<{
  busy: boolean
  ready: boolean
  // The Supreme League worker is still reading the data file.
  waiting: boolean
  // The maps picker's choice for boards handed over from the Arena or Teams.
  custom?: string
}>()

const emit = defineEmits<{ generate: [] }>()

const mode = defineModel<TeamModeKey>('mode', { required: true })
// Null for the handed-over boards' own maps.
const variant = defineModel<VariantMatch>('variant', { required: true })

const i18n = useI18nStore()
</script>

<template>
  <div class="sl-bar">
    <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
    <RosterMenu />
    <span class="sl-bar-actions">
      <RosterTransferActions />
      <TeamModePicker :active-mode="mode" @switch-mode="mode = $event" />
      <TeamVariantPicker
        :active-mode="mode"
        :match="variant"
        :source-id="null"
        :has-content="false"
        :custom
        @select-variant="variant = $event"
        @select-custom="variant = null"
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
