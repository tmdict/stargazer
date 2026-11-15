<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import CharmHeroList from '@/components/charm/CharmHeroList.vue'
import SkillLocaleMenu from '@/components/ui/SkillLocaleMenu.vue'
import { useModalSkillLocale } from '@/composables/useModalSkillLocale'
import { loadHeroCharms } from '@/lib/dataLoader'
import { oldestFirst } from '@/lib/heroAge'
import { useI18nStore } from '@/stores/i18n'
import { getSkillLanguage } from '@/utils/skillLocale'

const props = defineProps<{
  show: boolean
  type: string
}>()
const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()

// The name, bonuses and hero names follow the skill-text language, as in the
// skill modal.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const text = computed(() =>
  applied.value ? getSkillLanguage(applied.value)?.charmTypes[props.type] : undefined,
)
const title = computed(() => text.value?.name ?? i18n.t('app.mythic-charm-types'))

const users = computed(() =>
  Object.entries(loadHeroCharms()).filter(([, hero]) => hero.types?.includes(props.type)),
)
const heroes = computed(() => oldestFirst(users.value.map(([slug]) => slug)))
const recommended = computed(() =>
  users.value.filter(([, hero]) => hero.recommended === props.type).map(([slug]) => slug),
)
</script>

<template>
  <BaseModal :show :label="title" :locale-override="selected" @close="emit('close')">
    <template #header-buttons>
      <SkillLocaleMenu mode="select" :current="selected" @select="apply" />
    </template>

    <template #default>
      <h1 class="detail-title">{{ title }}</h1>
      <template v-if="applied || failed">
        <template v-if="applied && text">
          <div class="bonuses meta-chips">
            <span v-for="line in text.bonus" :key="line" class="meta-chip">{{ line }}</span>
          </div>
          <CharmHeroList v-if="heroes.length" class="heroes" :heroes :recommended :lang="applied" />
        </template>
        <p v-else class="details-pending" :lang="i18n.currentLocale">
          {{ i18n.t(failed ? 'app.skill-load-failed' : 'app.skill-details-pending') }}
        </p>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.bonuses {
  padding-bottom: 16px;
  border-bottom: 2px solid var(--color-border-primary);
}

.heroes {
  padding-top: 16px;
}
</style>
