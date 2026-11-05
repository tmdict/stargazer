<script setup lang="ts">
/* The generator's roster bar, with the Teams page's mode and maps pickers
   for the boards to generate on. Picking or importing a roster makes it the
   active one, which the page copies. */

import RosterMenu from '@/components/RosterMenu.vue'
import RosterTransferActions from '@/components/RosterTransferActions.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
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
    <span class="sl-bar-group sl-bar-roster">
      <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
      <RosterMenu />
    </span>
    <span class="sl-bar-group">
      <RosterTransferActions />
    </span>
    <span class="sl-bar-group">
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
    </span>
    <button
      type="button"
      class="solid-btn sl-action generate-btn"
      :disabled="!ready || busy"
      :aria-busy="busy"
      @click="emit('generate')"
    >
      <IconSparkle :size="16" class="generate-sparkle" aria-hidden="true" />
      {{
        i18n.t(busy ? 'app.sl-generating' : waiting ? 'app.sl-getting-ready' : 'app.sl-generate')
      }}
    </button>
  </div>
</template>

<style scoped>
.sl-bar,
.sl-bar-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.sl-bar {
  gap: var(--spacing-sm) var(--spacing-lg);
}

@media (max-width: 768px) {
  .sl-bar-roster {
    flex: 1;
    flex-wrap: nowrap;
  }
  .sl-bar :deep(.roster-menu) {
    flex: 1;
    min-width: 0;
    --dropdown-trigger-width: 100%;
    --dropdown-trigger-min-width: 0;
  }
  .sl-bar .sl-action {
    margin-left: auto;
  }
}

@media (max-width: 480px) {
  .sl-bar {
    gap: var(--spacing-sm);
  }
  .sl-bar-roster {
    flex-basis: 100%;
  }
  .sl-bar-group:not(.sl-bar-roster) {
    display: contents;
  }
}
</style>
