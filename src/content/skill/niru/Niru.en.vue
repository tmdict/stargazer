<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Niru.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Niru looks for teammate characters starting from tiles adjacent to him and expanding
          outwards, prioritizing characters in the back. When multiple characters are in the same
          row, Niru will prioritize the character to the left (higher hex ID):
        </p>
        <ul>
          <li>
            <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from rearmost row to
            frontmost row, and left to right (higher hex ID).
          </li>
          <li>
            <strong>Ring 2:</strong> 12 tiles at distance 2, starting from rearmost row to frontmost
            row, and left to right (higher hex ID).
          </li>
          <li>And so on...</li>
        </ul>
        <p>When on enemy team, Niru prioritizes teammates with the lower hex ID (180° rotation)</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
        <p>
          Niru can also target summons and clones, such as Phraesto's clone or Elijah &amp; Lailah's
          Lailah (pink twin).
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
