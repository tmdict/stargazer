<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageContainer from '@/components/ui/PageContainer.vue'
import { useContentComponent } from '@/composables/useContentComponent'

interface Props {
  name?: string
}

const props = defineProps<Props>()

const route = useRoute()
// Use the prop if provided, otherwise fall back to route params
const skillName = computed(() => props.name || (route.params.name as string))

// Normalize skill name with proper casing for filename
const normalizedSkillName = computed(() => {
  const name = skillName.value?.toLowerCase()
  if (!name) return ''

  // Map lowercase names to properly cased filenames
  const nameMap: Record<string, string> = {
    silvina: 'Silvina',
    vala: 'Vala',
    reinier: 'Reinier',
    dunlingr: 'Dunlingr',
  }

  return nameMap[name] || name
})

// Pass the computed ref directly so it's reactive
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: normalizedSkillName,
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
