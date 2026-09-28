<script setup lang="ts">
/* The one set of inspect modals (useInspect), mounted at the app root. Only
   the current target's kind is mounted, so nothing renders until the first
   inspect. */

import ArtifactModal from './ArtifactModal.vue'
import PhantimalModal from './PhantimalModal.vue'
import SkillModal from './SkillModal.vue'
import { useInspect } from '@/composables/useInspect'

const { target, open, close } = useInspect()
</script>

<template>
  <SkillModal
    v-if="target?.kind === 'hero'"
    :show="open"
    :skill-name="target.slug"
    :initial-chip="target.chip"
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
