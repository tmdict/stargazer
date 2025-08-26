<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { DOCUMENTED_SKILLS } from '@/lib/skill'

interface Props {
  name?: string
}

const props = defineProps<Props>()

const route = useRoute()
const locale = useRouteLocale()

// Use the prop if provided, otherwise fall back to route params
const skillName = computed(() => props.name || (route.params.name as string) || 'undefined')

// Normalize skill name with proper casing for filename
const normalizedSkillName = computed(() => {
  const name = skillName.value?.toLowerCase()
  if (!name) return ''

  // Build name map from DOCUMENTED_SKILLS
  const nameMap: Record<string, string> = {}
  DOCUMENTED_SKILLS.forEach((skill) => {
    nameMap[skill] = skill.charAt(0).toUpperCase() + skill.slice(1)
  })

  return nameMap[name] || name || 'undefined' // 'undefined': fallback for missing skill names
})

// Pass the computed ref directly so it's reactive
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: normalizedSkillName,
  locale,
})
</script>

<template>
  <PageContainer maxWidth="800px">
    <component v-if="ContentComponent" :is="ContentComponent" />
    <div v-else>
      <h1>Skill Not Found</h1>
      <p>The skill "{{ skillName }}" was not found.</p>
    </div>
  </PageContainer>
</template>
