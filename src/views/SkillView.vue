<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { DOCUMENTED_SKILLS } from '@/content/skill'

interface Props {
  name?: string
}

const props = defineProps<Props>()

const route = useRoute()
const locale = useRouteLocale()

// Use the prop if provided, otherwise fall back to route params
const skillName = computed(() => props.name || (route.params.name as string) || 'undefined')

// Validate the skill exists and pass it directly (in kebab-case)
const validatedSkillName = computed(() => {
  const name = skillName.value?.toLowerCase()
  if (!name) return ''

  // Check if it's a valid documented skill
  return DOCUMENTED_SKILLS.includes(name) ? name : 'undefined'
})

// Pass the original kebab-case name
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: validatedSkillName,
  locale,
})
</script>

<template>
  <PageContainer maxWidth="800px">
    <component v-if="ContentComponent" :is="ContentComponent" />
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
