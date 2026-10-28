<script setup lang="ts">
/* Segmented type picker beside the mode picker: Default plus the mode's named
   types (Supreme League, Guild Duel). The lit option is derived from the live
   boards' maps, so hand-picked maps light nothing. Selecting moves every
   board onto the chosen list's map; a hero keeps its tile only where the new
   map has it, hence the two-step confirm whenever a board holds anything.
   Hidden where there is nothing to choose (1v1 has no named types). The
   Supreme League generator picks the type of set it makes with it, with
   nothing to confirm. */

import { computed, watch } from 'vue'

import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import {
  DEFAULT_VARIANT,
  variantsForMode,
  type TeamModeKey,
  type TeamVariantChoice,
  type VariantMatch,
} from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { activeMode, match, sourceId, hasContent } = defineProps<{
  activeMode: TeamModeKey
  // The live boards' type; null = custom maps, nothing lit.
  match: VariantMatch
  // The saved team the boards came from; a change means they were replaced.
  sourceId: string | null
  // Whether any board holds anything, gating the confirm.
  hasContent: boolean
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
// 3v3, and any change of the boards' mode, type or source (a switch, Load,
// New, import, or this picker's own switch) disarms.
const { armed, confirm, disarm } = useArmedConfirm()
watch([() => activeMode, () => match, () => sourceId], disarm)

const armedKey = (choice: TeamVariantChoice): string => `${activeMode}:${choice}`

const segments = computed(() =>
  choices.value.map((choice) => ({
    ...choice,
    selected: match === choice.key,
    armed: armed.value === armedKey(choice.key),
  })),
)

const select = (choice: TeamVariantChoice): void => {
  if (choice === match) return
  if (hasContent && !confirm(armedKey(choice))) return
  emit('selectVariant', choice)
}
</script>

<template>
  <SegmentedPicker
    v-if="segments.length > 1"
    :segments
    :aria-label="i18n.t('app.type')"
    @select="select"
  >
    <template #default="{ segment }">
      <ConfirmLabel :armed="segment.armed" :label="segment.label" />
    </template>
  </SegmentedPicker>
</template>
