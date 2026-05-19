<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import SkillSections from '@/components/skill/SkillSections.vue'
import PageContainer from '@/components/ui/PageContainer.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { hasSkillLocale, loadSkillLocales } from '@/utils/dataLoader'

interface Props {
  name?: string
}

const props = defineProps<Props>()

const route = useRoute()
const locale = useRouteLocale()
const lang = computed<'en' | 'zh'>(() => (locale.value === 'zh' ? 'zh' : 'en'))

const skillName = computed(() => props.name || (route.params.name as string) || '')
const slug = computed(() => skillName.value.toLowerCase())

const hasLocaleData = computed(
  () => hasSkillLocale(slug.value) && !!loadSkillLocales()[lang.value]?.[slug.value],
)
</script>

<template>
  <PageContainer maxWidth="960px" :top-anchor="true">
    <SkillSections v-if="hasLocaleData" :slug="slug" :lang="lang" />
    <div v-else class="skill-not-found">
      <h1>Skill Not Found</h1>
      <p>The skill "{{ skillName }}" was not found.</p>
      <img src="@/assets/rowan.gif" alt="logo" class="rowan-gif" />
    </div>
  </PageContainer>
</template>

<style scoped>
.skill-not-found {
  text-align: center;
  padding: 60px 40px;
}

.skill-not-found h1 {
  margin-bottom: 16px;
  color: var(--color-heading);
}

.skill-not-found p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  margin: 0 0 24px 0;
}

.rowan-gif {
  display: inline-block;
  width: 120px;
  height: auto;
  border-radius: 8px;
  margin-top: 20px;
}
</style>
