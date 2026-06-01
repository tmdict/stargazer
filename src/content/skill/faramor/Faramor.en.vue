<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Faramor.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          Faramor looks for teammate characters on tiles adjacent to him, prioritizing characters in
          the back. When multiple characters are in the same row, Faramor will prioritize the
          character to the right (lower hex ID).
        </p>
        <p>
          When on enemy team, Faramor prioritize teammates with the higher hex ID (180° rotation).
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
