<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Cassadee.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="how-it-works">
        <p>
          Cassadee looks for teammate characters starting from tiles adjacent to her and expanding
          outwards, prioritizing characters in the back. When multiple characters are in the same
          row, Cassadee will prioritize the character to the right (lower hex ID):
        </p>
        <ul>
          <li>
            <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from rearmost row to
            frontmost row, and right to left (lower hex ID).
          </li>
          <li>
            <strong>Ring 2:</strong> 12 tiles at distance 2, starting from rearmost row to frontmost
            row, and right to left (lower hex ID).
          </li>
          <li>And so on...</li>
        </ul>
        <p>
          When on enemy team, Cassadee prioritize teammates with the higher hex ID (180° rotation).
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
