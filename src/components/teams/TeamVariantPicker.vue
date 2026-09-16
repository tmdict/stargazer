<script setup lang="ts">
/* Segmented type picker beside the mode picker: Default plus the mode's named
   types (Supreme League, Guild Duel). The lit option is derived from the live
   boards' maps, so hand-picked maps light nothing. Selecting rebuilds every
   board on the chosen list, which drops their content, hence the two-step
   confirm whenever a board holds anything. Hidden where there is nothing to
   choose (1v1 has no named types). */

import { computed, watch } from 'vue'

import { useArmedConfirm } from '@/composables/useArmedConfirm'
import {
  DEFAULT_VARIANT,
  variantsForMode,
  type TeamModeKey,
  type TeamVariantChoice,
  type VariantMatch,
} from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { activeMode, match, sourceId, wouldReplace } = defineProps<{
  activeMode: TeamModeKey
  // The live boards' type; null = custom maps, nothing lit.
  match: VariantMatch
  // The saved team the boards came from; a change means they were replaced.
  sourceId: string | null
  // Whether the rebuild would drop anything, gating the confirm.
  wouldReplace: boolean
}>()

const emit = defineEmits<{
  selectVariant: [choice: TeamVariantChoice]
}>()

const i18n = useI18nStore()

const choices = computed((): { key: TeamVariantChoice; label: string }[] => [
  { key: DEFAULT_VARIANT, label: i18n.t('app.default') },
  ...variantsForMode(activeMode).map((variant) => ({
    key: variant.key,
    label: i18n.t(variant.labelKey),
  })),
])

// An armed click must not outlive the boards it was armed for: the key is
// scoped to the mode, so arming Default on 5v5 can never confirm Default on
// 3v3, and any board replacement (a switch, Load, New, import, or this
// picker's own rebuild) disarms.
const { armed, confirm, disarm } = useArmedConfirm()
watch([() => activeMode, () => match, () => sourceId], disarm)

const armedKey = (choice: TeamVariantChoice): string => `${activeMode}:${choice}`

const select = (choice: TeamVariantChoice): void => {
  if (choice === match) return
  if (wouldReplace && !confirm(armedKey(choice))) return
  emit('selectVariant', choice)
}
</script>

<template>
  <!-- Toggle-button semantics, like TeamModePicker: plain buttons already give
       the full keyboard interaction. -->
  <div
    v-if="choices.length > 1"
    class="variant-picker"
    role="group"
    :aria-label="i18n.t('app.type')"
  >
    <button
      v-for="choice in choices"
      :key="choice.key"
      type="button"
      :aria-pressed="match === choice.key"
      class="variant-seg"
      :class="{ active: match === choice.key, armed: armed === armedKey(choice.key) }"
      @click="select(choice.key)"
    >
      {{ armed === armedKey(choice.key) ? i18n.t('app.confirm') : choice.label }}
    </button>
  </div>
</template>

<style scoped>
/* Mirrors TeamModePicker so the two read as one control pair. */
.variant-picker {
  display: inline-flex;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border-primary);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.variant-seg {
  border: none;
  background: transparent;
  border-radius: 999px;
  padding: 5px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.variant-seg:hover:not(.active):not(.armed) {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.variant-seg.active {
  background: var(--color-primary);
  color: #fff;
}

/* Danger-tinted like every armed destructive control. */
.variant-seg.armed {
  background: var(--color-danger-hover);
  color: #fff;
}

@media (max-width: 480px) {
  .variant-seg {
    padding: 4px 10px;
    font-size: 0.78rem;
  }
}
</style>
