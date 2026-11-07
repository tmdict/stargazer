<script setup lang="ts">
/* Segmented type picker beside the mode picker: Default plus the mode's named
   types (Supreme League, Guild Duel). The lit option is derived from the live
   boards' maps, so hand-picked maps light nothing. Selecting moves every
   board onto the chosen list's map; a hero keeps its tile only where the new
   map has it, hence the two-step confirm whenever a board holds anything.
   Hidden where there is nothing to choose (1v1 has no named types). The
   generator page adds a choice for the boards of the Arena or Teams page that
   match no list, and lights those itself. */

import { computed, watch } from 'vue'

import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import SegmentedPicker, { type Segment } from '@/components/ui/SegmentedPicker.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import {
  DEFAULT_VARIANT,
  variantsForMode,
  type TeamModeKey,
  type TeamVariantChoice,
  type VariantMatch,
} from '@/lib/teams/modes'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { appKeyLabel } from '@/utils/skillLabels'

const {
  activeMode,
  match,
  sourceId,
  hasContent,
  custom = [],
  lang,
} = defineProps<{
  activeMode: TeamModeKey
  // The live boards' type; null = custom maps, no list lit.
  match: VariantMatch
  // The saved team the boards came from; a change means they were replaced.
  sourceId: string | null
  // Whether any board holds anything, gating the confirm.
  hasContent: boolean
  custom?: readonly Segment[]
  // A picture of the picker names its options in the picture's language.
  lang?: AppLocale
}>()

const emit = defineEmits<{
  selectVariant: [choice: TeamVariantChoice]
  selectCustom: [key: string]
}>()

const i18n = useI18nStore()
const label = (key: string): string => (lang ? appKeyLabel(key, lang) : i18n.t(key))

const variants = computed((): { key: TeamVariantChoice; label: string }[] => [
  { key: DEFAULT_VARIANT, label: label('app.default') },
  ...variantsForMode(activeMode).map((variant) => ({
    key: variant.key,
    label: label(variant.labelKey),
  })),
])

const choices = computed((): Segment[] => [
  ...variants.value.map((variant) => ({ ...variant, selected: match === variant.key })),
  ...custom,
])

// An armed click must not outlive the boards it was armed for: the key is
// scoped to the mode, so arming Default on 5v5 can never confirm Default on
// 3v3, and any change of the boards' mode, type or source (a switch, Load,
// New, import, or this picker's own switch) disarms.
const { armed, confirm, disarm } = useArmedConfirm()
watch([() => activeMode, () => match, () => sourceId], disarm)

const armedKey = (key: string): string => `${activeMode}:${key}`

const segments = computed(() =>
  choices.value.map((choice) => ({ ...choice, armed: armed.value === armedKey(choice.key) })),
)

const select = (key: string): void => {
  if (choices.value.find((choice) => choice.key === key)?.selected) return
  if (hasContent && !confirm(armedKey(key))) return
  const variant = variants.value.find((choice) => choice.key === key)
  if (variant) emit('selectVariant', variant.key)
  else emit('selectCustom', key)
}
</script>

<template>
  <SegmentedPicker
    v-if="segments.length > 1"
    :segments
    :aria-label="i18n.t('app.type')"
    v-slot="{ segment }"
    @select="select"
  >
    <ConfirmLabel :armed="segment.armed" :label="segment.label" />
  </SegmentedPicker>
</template>
