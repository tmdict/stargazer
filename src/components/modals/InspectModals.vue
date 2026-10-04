<script setup lang="ts">
/* The one set of inspect modals (useInspect), mounted at the app root. Only
   the current target's kind is mounted, so nothing renders until the first
   inspect. */

import { watch } from 'vue'
import { useRoute } from 'vue-router'

import ArtifactModal from './ArtifactModal.vue'
import PhantimalModal from './PhantimalModal.vue'
import SkillModal from './SkillModal.vue'
import { useInspect } from '@/composables/useInspect'

const { target, open, close } = useInspect()

// Living at the root, the modal outlives the page that opened it, so any
// navigation (a tag chip link inside the skill page, browser Back) closes it,
// as the search overlay does.
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    if (open.value) close()
  },
)
</script>

<template>
  <SkillModal
    v-if="target?.kind === 'hero'"
    :show="open"
    :skill-name="target.slug"
    :initial-chips="target.chips"
    @close="close"
  />
  <PhantimalModal
    v-else-if="target?.kind === 'phantimal'"
    :show="open"
    :phantimal="target.phantimal"
    @close="close"
  />
  <ArtifactModal
    v-else-if="target?.kind === 'artifact'"
    :show="open"
    :artifact="target.artifact"
    @close="close"
  />
</template>
