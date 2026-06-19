<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Himmel.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          When a battle starts, Himmel forms a Hero Party with one Tank, one Mage, and one Support
          ally among the teammates on tiles adjacent to him. If any of the three classes is missing
          from his neighbors, no party forms.
        </p>
        <p>
          For each class, Himmel prioritizes characters in the back. When multiple characters of
          that class are in the same row, Himmel will prioritize the character to the left (higher
          hex ID).
        </p>
        <p>
          When on enemy team, Himmel prioritizes teammates with the lower hex ID (180° rotation).
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
