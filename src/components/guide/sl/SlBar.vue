<script setup lang="ts">
/* The generator's roster bar, with the Teams page's mode and maps pickers
   for the boards to generate on. Picking or importing a roster makes it the
   active one, which the page edits in place. Under All heroes, once the
   heroes on screen differ from every hero at the top levels, Save shows with
   the unsaved-changes dot and makes a new roster of them under a name it asks
   for. */

import { ref, watch } from 'vue'

import RosterMenu from '@/components/RosterMenu.vue'
import RosterTransferActions from '@/components/RosterTransferActions.vue'
import TeamModePicker from '@/components/teams/TeamModePicker.vue'
import TeamVariantPicker from '@/components/teams/TeamVariantPicker.vue'
import IconSave from '@/components/ui/IconSave.vue'
import IconSparkle from '@/components/ui/IconSparkle.vue'
import NamePopover from '@/components/ui/NamePopover.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import type { RostersExportFile } from '@/lib/rosters'
import type { TeamModeKey, VariantMatch } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { busy, ready, waiting, custom, dirty, newName, exportFile } = defineProps<{
  busy: boolean
  ready: boolean
  // The Supreme League worker is still reading the data file.
  waiting: boolean
  // The maps picker's choice for boards handed over from the Arena or Teams.
  custom?: string
  // Under All heroes, whether the heroes on screen differ from every hero.
  dirty: boolean
  newName: string
  exportFile?: () => RostersExportFile
}>()

const emit = defineEmits<{ generate: []; saveRoster: [name: string] }>()

const mode = defineModel<TeamModeKey>('mode', { required: true })
// Null for the handed-over boards' own maps.
const variant = defineModel<VariantMatch>('variant', { required: true })

const i18n = useI18nStore()

const naming = ref(false)
watch(
  () => dirty,
  () => (naming.value = false),
)

const {
  anchor: tipEl,
  payload: tipShown,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip()

const save = (): void => {
  hideTip()
  naming.value = true
}
</script>

<template>
  <div class="sl-bar">
    <span class="sl-bar-group sl-bar-roster">
      <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
      <RosterMenu />
      <NamePopover
        v-if="dirty"
        v-model:open="naming"
        :label="i18n.t('app.roster-name')"
        :name="newName"
        end
        @commit="emit('saveRoster', $event)"
      >
        <button
          type="button"
          class="control-btn compact"
          :aria-label="i18n.t('app.save')"
          @click="save"
          @mouseenter="showTip"
          @touchstart.passive="tipTouchStart"
          @mouseleave="hideTip"
        >
          <span class="dirty-dot" />
          <IconSave :size="13" class="btn-icon" />
          <span class="btn-text">{{ i18n.t('app.save') }}</span>
        </button>
      </NamePopover>
    </span>
    <span class="sl-bar-group">
      <RosterTransferActions :export-file />
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
    <Teleport to="body">
      <TooltipPopup v-if="tipShown && tipEl" :target-element="tipEl" variant="detailed">
        <template #content>{{ i18n.t('app.sl-save-roster-tip') }}</template>
      </TooltipPopup>
    </Teleport>
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
  column-gap: var(--spacing-lg);
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
    column-gap: var(--spacing-sm);
  }
  .sl-bar-roster {
    flex-basis: 100%;
  }
  .sl-bar-group:not(.sl-bar-roster) {
    display: contents;
  }
}
</style>
