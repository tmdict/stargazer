<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Silvina.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="mechanic-targeting">
        <p>
          Silvina first checks her symmetrical tile (the mirror position across the grid's center).
          If an opponent is there, they become the target.
        </p>
        <p>
          If the symmetrical tile is empty, Silvina searches for the nearest opponent in a clockwise
          spiral expanding from that tile's position:
        </p>
        <ul>
          <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
          <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
          <li>And so on...</li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
        <p>
          Ally (targeting opponent) walks clockwise from top-right, while Enemy (targeting opponent)
          walks counter-clockwise from bottom-left (180° rotation).
        </p>
        <p>(Credit: rkkñ for documenting Silvina's targeting mechanics)</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
