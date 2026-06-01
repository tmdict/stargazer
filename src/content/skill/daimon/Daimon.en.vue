<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Daimon.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          Daimon looks for teammate characters on tiles immediately behind him, when multiple
          characters are in the same row, Daimon will prioritize the character to the left (higher
          hex ID).
        </p>
        <p>
          When on enemy team, Daimon prioritize teammates with the lower hex ID (180° rotation).
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
