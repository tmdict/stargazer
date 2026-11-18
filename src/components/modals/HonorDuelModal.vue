<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import SkillSection from '@/components/skill/SkillSection.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalDuelText } from '@/composables/useDuelText'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import { duelItemName, equipmentTierLabel } from '@/lib/hd/catalog'
import type { HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'

const props = defineProps<{
  show: boolean
  item: HonorDuelItem
}>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The name and effect text follow the skill-text language, as in the skill
// modal; the tier chip is chrome, in the site language.
const { selected, applied, failed: localeFailed, apply } = useModalSkillLocale(() => props.show)
const { loaded, failed: textFailed } = useModalDuelText(() => props.show, applied)
const failed = computed(() => localeFailed.value || textFailed.value)

const text = computed(() => {
  const all = loaded.value?.text
  if (!all) return undefined
  return props.item.kind === 'equipment'
    ? all.equipment[props.item.item.name]
    : all.artifacts[props.item.item.name]
})

const title = computed(() => text.value?.name || duelItemName(props.item, i18n.currentLocale))

const tier = computed(() =>
  props.item.kind === 'equipment'
    ? equipmentTierLabel(props.item.item.tier, i18n.currentLocale)
    : gameLabel('duel-artifact', i18n.currentLocale),
)

// Level 1 is the base effect, 2+ are upgrades. A level whose text repeats the
// one before it adds no effect of its own, so it is left out.
const levels = computed(() => {
  const entry = text.value
  if (!entry) return []
  const texts = 'levels' in entry ? entry.levels : [entry.description]
  return texts
    .map((description, i) => ({ level: i + 1, description }))
    .filter((row, i) => i === 0 || row.description !== texts[i - 1])
})

const settled = computed(() => failed.value || loaded.value !== null)
</script>

<template>
  <BaseModal :show :label="title" :locale-override="selected" @close="emit('close')">
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <template #default>
      <h1 class="detail-title">{{ title }}</h1>
      <div class="meta-chips" :lang="i18n.currentLocale">
        <span class="meta-chip">{{ tier }}</span>
      </div>

      <template v-if="settled">
        <SkillSection v-if="levels.length" :levels />
        <p v-else class="details-pending" :lang="i18n.currentLocale">
          {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
        </p>
      </template>
    </template>
  </BaseModal>
</template>
