<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseModal from './BaseModal.vue'
import CharmHeroList from '@/components/charm/CharmHeroList.vue'
import SkillCharmSection from '@/components/skill/SkillCharmSection.vue'
import SkillKeywordTooltip from '@/components/skill/SkillKeywordTooltip.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import { oldestFirst } from '@/lib/heroAge'
import type { CharmData } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { getSkillLanguage } from '@/utils/skillLocale'

const props = defineProps<{
  show: boolean
  charm: CharmData
}>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The tier text and hero names follow the skill-text language, as in the
// skill modal; the title is chrome, in the site language.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const title = computed(() => i18n.t('app.charm'))
const heroes = computed(() => oldestFirst(props.charm.heroes))

const language = computed(() => (applied.value ? getSkillLanguage(applied.value) : undefined))
const text = computed(() => language.value?.charms)
const tiersEl = ref<HTMLElement | null>(null)
const tiers = computed(() =>
  (text.value?.charms[props.charm.id] ?? []).map((description, i) => ({
    tier: i + 1,
    text: description,
  })),
)
</script>

<template>
  <BaseModal :show :label="title" :locale-override="selected" @close="emit('close')">
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <template #default>
      <h1 class="detail-title" :lang="i18n.currentLocale">{{ title }}</h1>
      <template v-if="applied || failed">
        <CharmHeroList v-if="applied" class="heroes" :heroes :lang="applied" />
        <div v-if="text && tiers.length" ref="tiersEl">
          <SkillCharmSection :tier-names="text.tiers" :tiers />
          <SkillKeywordTooltip
            v-if="applied && language"
            :lang="applied"
            :keywords="language.keywords"
            :container="tiersEl"
          />
        </div>
        <p v-else class="details-pending" :lang="i18n.currentLocale">
          {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
        </p>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.heroes {
  padding-bottom: 16px;
  border-bottom: 2px solid var(--color-border-primary);
}
</style>
