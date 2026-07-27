<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Satrana.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          The 2-tile range covers the 6 tiles adjacent to Satrana (labeled 1 below) and the circle
          around them (labeled 2); any ally standing on one of those tiles receives Sparks.
        </p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
