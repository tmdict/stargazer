<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import CharmHeroList from '@/components/charm/CharmHeroList.vue'
import IconThumbsUp from '@/components/ui/IconThumbsUp.vue'
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
// skill modal; the group headings are chrome, in the site language.
const { selected, applied, failed, apply } = useModalSkillLocale(() => props.show)

const text = computed(() =>
  applied.value ? getSkillLanguage(applied.value)?.charmTypes[props.type] : undefined,
)
const title = computed(() => text.value?.name ?? i18n.t('app.mythic-charm-types'))

const heroes = computed(() => {
  const users = Object.entries(loadHeroCharms()).filter(([, hero]) =>
    hero.types?.includes(props.type),
  )
  const named = (recommended: boolean): string[] =>
    oldestFirst(
      users
        .filter(([, hero]) => (hero.recommended === props.type) === recommended)
        .map(([slug]) => slug),
    )
  return { recommended: named(true), others: named(false) }
})
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
          <section v-if="heroes.recommended.length">
            <h2 :lang="i18n.currentLocale">
              <IconThumbsUp :size="18" class="thumb" />{{ i18n.t('app.recommended') }}
            </h2>
            <CharmHeroList :heroes="heroes.recommended" :lang="applied" />
          </section>
          <section v-if="heroes.others.length">
            <h2 :lang="i18n.currentLocale">{{ i18n.t('app.other-heroes') }}</h2>
            <CharmHeroList :heroes="heroes.others" :lang="applied" />
          </section>
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

.thumb {
  margin-right: 6px;
  vertical-align: -0.15em;
  color: var(--color-accent);
}
</style>
