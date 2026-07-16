<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Galahad.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Galahad looks for teammate characters starting from tiles adjacent to her and expanding
          outwards, prioritizing characters in the back. When multiple characters are in the same
          row, Galahad will prioritize the character to the right (lower hex ID):
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
          When on enemy team, Galahad prioritize teammates with the higher hex ID (180° rotation)
        </p>
        <GridSnippet :grid-style="gridStyles.main" :images />
        <p>
          Galahad will only target main characters, skipping summons and clones such as Phraesto's
          clone or Elijah &amp; Lailah's Lailah (pink twin).
        </p>
        <p>Both Galahad's shadow, as well as the marked ally's shadow, are considered summons.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
