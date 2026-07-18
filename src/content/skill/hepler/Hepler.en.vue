<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Hepler.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Hepler looks for teammate characters on tiles adjacent to him, prioritizing characters in
          the front. When multiple characters are in the same row, Hepler will prioritize the
          character to the left (higher hex ID).
        </p>
        <p>
          When on enemy team, Hepler prioritizes teammates with the lower hex ID (180° rotation).
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
